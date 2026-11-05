import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { getAdminAreas, getAdminCategories, saveArea, saveCategory, type AreaInput } from '@/api/AttentionAPI'
import { AREA_TYPE } from '@/lib/labels'
import Modal from '@/components/ui/Modal'
import SelectBox from '@/components/ui/SelectBox'
import ErrorMessage from '@/components/ui/ErrorMessage'
import CategoryIcon from '@/components/CategoryIcon'
import { ErrorState, ListSkeleton } from '@/components/ui/States'
import type { Area, AreaType } from '@/types'

const TYPE_OPTIONS = (Object.keys(AREA_TYPE) as AreaType[]).map((value) => ({ value, label: AREA_TYPE[value].label }))

function AreaDialog({ area, open, onClose }: { area: Area | null; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [type, setType] = useState<AreaType>('municipal')
  const [active, setActive] = useState(true)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AreaInput>()

  useEffect(() => {
    if (!open) return
    reset({ name: area?.name ?? '', description: area?.description ?? '', contactEmail: area?.contactEmail ?? '' })
    setType(area?.type ?? 'municipal')
    setActive(area?.active ?? true)
  }, [open, area, reset])

  const { mutate, isPending } = useMutation({
    mutationFn: saveArea,
    onError: (e) => toast.error(e.message),
    onSuccess: () => {
      toast.success(area ? 'Área actualizada' : 'Área creada')
      queryClient.invalidateQueries({ queryKey: ['admin-areas'] })
      queryClient.invalidateQueries({ queryKey: ['areas'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      onClose()
    },
  })

  return (
    <Modal open={open} onClose={onClose} title={area ? `Editar ${area.name}` : 'Nueva área o dependencia'}>
      <form onSubmit={handleSubmit((f) => mutate({ ...f, type, active, id: area?.id }))} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="a-name">Nombre</label>
          <input id="a-name" className="input" placeholder="Ej. Dirección de Obras Públicas"
            {...register('name', { required: 'El nombre es obligatorio', minLength: { value: 3, message: 'Mínimo 3 caracteres' }, maxLength: 120 })} />
          {errors.name && <ErrorMessage>{errors.name.message}</ErrorMessage>}
        </div>
        <SelectBox label="Tipo" value={type} onChange={setType} options={TYPE_OPTIONS} />
        <p className="-mt-2 text-xs text-slate-500">
          "Otra autoridad" (estatal, federal, CFE…): los reportes asignados quedan como <b>canalizados</b>.
        </p>
        <div>
          <label className="label" htmlFor="a-desc">Descripción</label>
          <input id="a-desc" className="input" {...register('description', { maxLength: 300 })} />
        </div>
        <div>
          <label className="label" htmlFor="a-mail">Correo de contacto (para notificaciones)</label>
          <input id="a-mail" type="email" className="input" placeholder="area@municipio.gob.mx"
            {...register('contactEmail', { pattern: { value: /^$|\S+@\S+\.\S+/, message: 'Correo no válido' } })} />
          {errors.contactEmail && <ErrorMessage>{errors.contactEmail.message}</ErrorMessage>}
        </div>
        {area && (
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" className="size-4 accent-indigo-600" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Activa (si la desactivas ya no recibe asignaciones; su historial se conserva)
          </label>
        )}
        <button disabled={isPending} className="btn-primary w-full">{isPending ? 'Guardando…' : 'Guardar'}</button>
      </form>
    </Modal>
  )
}

export default function AdminAreasView() {
  const queryClient = useQueryClient()
  const areas = useQuery({ queryKey: ['admin-areas'], queryFn: getAdminAreas })
  const categories = useQuery({ queryKey: ['admin-categories'], queryFn: getAdminCategories })
  const [editing, setEditing] = useState<Area | null>(null)
  const [open, setOpen] = useState(false)

  const routeCategory = useMutation({
    mutationFn: saveCategory,
    onError: (e) => toast.error(e.message),
    onSuccess: () => {
      toast.success('Área responsable actualizada')
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] })
      queryClient.invalidateQueries({ queryKey: ['admin-areas'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })

  const areaOptions = useMemo(
    () => [{ value: 0, label: 'Sin asignación automática' }, ...(areas.data ?? []).filter((a) => a.active).map((a) => ({ value: a.id, label: a.name }))],
    [areas.data],
  )

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Áreas y categorías</h1>
          <p className="page-subtitle">Configura las dependencias responsables y la distribución automática de reportes.</p>
        </div>
        <button onClick={() => { setEditing(null); setOpen(true) }} className="btn-primary">Agregar área</button>
      </header>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">¿Quién atiende cada tipo de problema?</h2>
          <p className="text-sm text-slate-500">Los reportes nuevos de cada categoría se asignan automáticamente a esta área.</p>
        </div>
        {categories.isLoading ? (
          <ListSkeleton rows={4} />
        ) : categories.isError ? (
          <ErrorState onRetry={() => categories.refetch()} />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {categories.data!.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-2xl glass p-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: c.color }}>
                  <CategoryIcon slug={c.slug} className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">{c.name}</p>
                  <SelectBox
                    value={c.areaId ?? 0}
                    onChange={(v) => routeCategory.mutate({ id: c.id, areaId: v || null })}
                    options={areaOptions}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-900">Áreas y dependencias</h2>
        {areas.isLoading ? (
          <ListSkeleton rows={4} />
        ) : areas.isError ? (
          <ErrorState onRetry={() => areas.refetch()} />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {areas.data!.map((a) => (
              <li key={a.id} className={`flex flex-col gap-2 rounded-2xl glass p-4 ${a.active ? '' : 'opacity-60'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">{a.name}</p>
                    <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[11px] font-bold ${AREA_TYPE[a.type].className}`}>{AREA_TYPE[a.type].label}</span>
                    {!a.active && <span className="ml-1 rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-bold text-slate-600">Inactiva</span>}
                  </div>
                  <button onClick={() => { setEditing(a); setOpen(true) }} className="btn-secondary btn-compact shrink-0">Editar</button>
                </div>
                {a.description && <p className="text-sm text-slate-600">{a.description}</p>}
                <dl className="mt-auto grid grid-cols-3 gap-2 pt-2 text-center">
                  <div className="rounded-xl bg-white/50 p-2"><dt className="text-[11px] font-bold uppercase text-slate-500">Abiertos</dt><dd className="text-lg font-extrabold tabular-nums">{a.openReports}</dd></div>
                  <div className="rounded-xl bg-white/50 p-2"><dt className="text-[11px] font-bold uppercase text-slate-500">Personal</dt><dd className="text-lg font-extrabold tabular-nums">{a.membersCount}</dd></div>
                  <div className="rounded-xl bg-white/50 p-2"><dt className="text-[11px] font-bold uppercase text-slate-500">Categorías</dt><dd className="text-lg font-extrabold tabular-nums">{a.categoriesCount}</dd></div>
                </dl>
                {a.contactEmail && <p className="truncate text-xs text-slate-500">{a.contactEmail}</p>}
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-slate-500">El personal operativo se asigna a su área desde la sección Usuarios.</p>
      </section>

      <AreaDialog area={editing} open={open} onClose={() => setOpen(false)} />
    </div>
  )
}
