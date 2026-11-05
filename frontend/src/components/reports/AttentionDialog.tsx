import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Field, Label, Switch } from '@headlessui/react'
import { toast } from 'react-toastify'
import { addAttentionUpdate, assignReport, getPublicAreas, updateAttentionStatus } from '@/api/AttentionAPI'
import { useAuth } from '@/hooks/useAuth'
import { OPERATIVO_STATUSES, STATUS, STATUS_OPTIONS } from '@/lib/labels'
import Modal from '@/components/ui/Modal'
import SelectBox from '@/components/ui/SelectBox'
import PhotoAttach from './PhotoAttach'
import type { Report, ReportStatus } from '@/types'

export type AttentionMode = 'status' | 'update' | 'assign'

const TITLES: Record<AttentionMode, string> = {
  status: 'Actualizar estado',
  update: 'Agregar observación o evidencia',
  assign: 'Asignar área responsable',
}

/** Invalida solo lo que cambia (no toda la caché, que recargaba el mapa y las estadísticas) */
export function invalidateReport(queryClient: ReturnType<typeof useQueryClient>, id: number) {
  queryClient.invalidateQueries({ queryKey: ['report', id] })
  queryClient.invalidateQueries({ queryKey: ['attention'] })
  queryClient.invalidateQueries({ queryKey: ['reports'] })
}

type Props = { report: Report | null; mode: AttentionMode; onClose: () => void }

/**
 * Acciones del personal sobre un reporte. Las opciones se limitan según el rol,
 * pero el backend vuelve a validar todo (no depende de ocultar botones).
 */
export default function AttentionDialog({ report, mode, onClose }: Props) {
  const queryClient = useQueryClient()
  const { user, isAdmin } = useAuth()
  const [status, setStatus] = useState<ReportStatus>('en_proceso')
  const [areaId, setAreaId] = useState(0)
  const [note, setNote] = useState('')
  const [internal, setInternal] = useState(false)
  const [image, setImage] = useState<File | null>(null)

  const { data: areas = [] } = useQuery({ queryKey: ['areas', 'public'], queryFn: getPublicAreas, enabled: mode === 'assign', staleTime: 5 * 60_000 })

  useEffect(() => {
    if (!report) return
    setStatus(report.status)
    setAreaId(report.area?.id ?? 0)
    setNote('')
    setInternal(false)
    setImage(null)
  }, [report, mode])

  const statusOptions = useMemo(
    () => (user?.role === 'operativo' ? STATUS_OPTIONS.filter((o) => OPERATIVO_STATUSES.includes(o.value) || o.value === report?.status) : STATUS_OPTIONS),
    [user?.role, report?.status],
  )
  const areaOptions = useMemo(
    () => [{ value: 0, label: 'Sin área (por clasificar)' }, ...areas.map((a) => ({ value: a.id, label: a.type === 'externa' ? `${a.name} — canalizar` : a.name }))],
    [areas],
  )

  const done = (msg: string) => {
    toast.success(msg)
    if (report) invalidateReport(queryClient, report.id)
    onClose()
  }
  const statusM = useMutation({ mutationFn: updateAttentionStatus, onError: (e) => toast.error(e.message), onSuccess: done })
  const updateM = useMutation({ mutationFn: addAttentionUpdate, onError: (e) => toast.error(e.message), onSuccess: done })
  const assignM = useMutation({ mutationFn: assignReport, onError: (e) => toast.error(e.message), onSuccess: done })
  const pending = statusM.isPending || updateM.isPending || assignM.isPending

  if (mode === 'assign' && !isAdmin) return null

  const submit = () => {
    if (!report) return
    const text = note.trim() || undefined
    if (mode === 'status') statusM.mutate({ id: report.id, status, note: text, internal, image })
    if (mode === 'update') updateM.mutate({ id: report.id, note: text, internal, image })
    if (mode === 'assign') assignM.mutate({ id: report.id, areaId: areaId || null, note: text })
  }

  const disabled =
    pending ||
    (mode === 'status' && status === report?.status) ||
    (mode === 'update' && !note.trim() && !image) ||
    (mode === 'assign' && (areaId || null) === (report?.area?.id ?? null))

  const selectedArea = areas.find((a) => a.id === areaId)

  return (
    <Modal open={!!report} onClose={onClose} title={TITLES[mode]}>
      {report && (
        <div className="space-y-4">
          <p className="rounded-xl bg-white/60 px-3 py-2 text-sm text-slate-700">
            <b>#{report.id}</b> · {report.title}
            <span className="block text-xs text-slate-500">Estado actual: {STATUS[report.status].label}{report.area && ` · ${report.area.name}`}</span>
          </p>

          {mode === 'status' && (
            <>
              <SelectBox label="Nuevo estado" value={status} onChange={setStatus} options={statusOptions} />
              <p className="-mt-2 text-xs text-slate-500">{STATUS[status].help}</p>
            </>
          )}
          {mode === 'assign' && (
            <>
              <SelectBox label="Área o dependencia" value={areaId} onChange={setAreaId} options={areaOptions} />
              {selectedArea?.type === 'externa' && (
                <p className="-mt-2 rounded-lg bg-cyan-50 p-2 text-xs text-cyan-800">Es otra autoridad: el reporte quedará como "Canalizado a otra autoridad".</p>
              )}
            </>
          )}

          <div>
            <label className="label" htmlFor="att-note">{mode === 'update' ? 'Observación' : 'Observación (opcional)'}</label>
            <textarea id="att-note" rows={3} maxLength={600} className="input" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder={mode === 'assign' ? 'Ej. Corresponde a la red de alumbrado de la colonia' : 'Ej. Se reemplazó la luminaria y se probó el circuito'} />
          </div>

          {mode !== 'assign' && (
            <>
              <PhotoAttach value={image} onChange={setImage} label="Adjuntar evidencia (opcional)" />
              <Field className="flex items-center justify-between gap-3 rounded-xl bg-white/50 p-3">
                <Label className="text-sm">
                  <span className="font-bold text-slate-800">Nota interna</span>
                  <span className="block text-xs text-slate-500">El ciudadano no la verá</span>
                </Label>
                <Switch checked={internal} onChange={setInternal} className="group relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full bg-slate-300 transition data-[checked]:bg-slate-800">
                  <span className="pointer-events-none mt-0.5 ml-0.5 inline-block size-5 rounded-full bg-white shadow transition group-data-[checked]:translate-x-5" />
                </Switch>
              </Field>
            </>
          )}

          <button onClick={submit} disabled={disabled} className="btn-primary w-full">
            {pending ? 'Guardando…' : mode === 'assign' ? 'Guardar asignación' : 'Guardar'}
          </button>
        </div>
      )}
    </Modal>
  )
}
