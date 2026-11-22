import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { confirmReport } from '@/api/ReportAPI'
import { useAuth } from '@/hooks/useAuth'
import { CONFIRMABLE_STATUSES } from '@/lib/labels'
import { timeAgo } from '@/lib/date'
import Modal from '@/components/ui/Modal'
import type { Report, VoteValue } from '@/types'

const ANSWER: Record<VoteValue, { label: string; done: string; title: string; text: string; placeholder: string }> = {
  solucionado: {
    label: 'Confirmar que se resolvió',
    done: 'Confirmaste que el problema se resolvió',
    title: 'Confirmar que se resolvió',
    text: 'Tu confirmación ayuda al área responsable a cerrar el reporte. No cambia el estado por sí sola.',
    placeholder: 'Comentario (opcional)',
  },
  sin_solucion: {
    label: 'El problema continúa',
    done: 'Indicaste que el problema continúa',
    title: 'El problema continúa',
    text: 'Avisaremos a la administración y al área responsable para que lo revisen.',
    placeholder: '¿Qué sigue pasando? (opcional)',
  },
}

/**
 * Confirmación ciudadana del resultado. Es una pregunta con dos respuestas, no una votación:
 * no muestra conteos en los botones y la respuesta se puede cambiar.
 * El estado oficial solo lo cambia el personal (el backend lo garantiza).
 */
export default function CitizenConfirmation({ report }: { report: Report }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [answer, setAnswer] = useState<VoteValue | null>(null)
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState('')

  const { mutate, isPending } = useMutation({
    mutationFn: confirmReport,
    onError: (e) => toast.error(e.message),
    onSuccess: (res) => {
      toast.success(res?.message)
      queryClient.invalidateQueries({ queryKey: ['report', report.id] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      setAnswer(null)
      setEditing(false)
      setNote('')
    },
  })

  // El personal registra la atención desde la bandeja; quien atiende no "confirma" su propio trabajo
  const staff = user?.role === 'admin' || user?.role === 'operativo'
  if (staff || report.canManage || !CONFIRMABLE_STATUSES.includes(report.status)) return null

  const resolved = report.status === 'resuelto'
  const mine = report.votes.mine
  const open = (value: VoteValue) => (user ? setAnswer(value) : navigate('/auth/login'))

  return (
    <section className="card space-y-3" aria-labelledby="confirmacion">
      <div>
        <h2 id="confirmacion" className="text-sm font-bold text-slate-900">
          {resolved ? '¿Se resolvió el problema?' : '¿Ya se resolvió el problema?'}
        </h2>
        <p className="mt-0.5 text-sm text-slate-600">
          {resolved
            ? 'El área responsable marcó este reporte como resuelto. Confírmalo o avísanos si sigue igual.'
            : 'Si ya lo arreglaron o sigue igual, avísanos. El estado oficial lo actualiza el área responsable.'}
        </p>
      </div>

      {mine && !editing ? (
        <div className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm ring-1 ring-inset ${mine === 'solucionado' ? 'bg-emerald-50 text-emerald-900 ring-emerald-200' : 'bg-amber-50 text-amber-900 ring-amber-200'}`}>
          <p className="flex items-center gap-2">
            {mine === 'solucionado' ? <CheckCircleIcon className="size-5 shrink-0" aria-hidden /> : <ExclamationTriangleIcon className="size-5 shrink-0" aria-hidden />}
            <span>
              <b className="font-semibold">{ANSWER[mine].done}</b>
              {report.votes.mineAt && <span className="text-xs opacity-80"> · {timeAgo(report.votes.mineAt)}</span>}
            </span>
          </p>
          <button onClick={() => setEditing(true)} className="btn-link text-sm">Cambiar respuesta</button>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <button onClick={() => open('solucionado')} className="btn-secondary w-full justify-center !text-emerald-800 hover:!bg-emerald-50">
            <CheckCircleIcon className="size-5" aria-hidden /> {ANSWER.solucionado.label}
          </button>
          <button onClick={() => open('sin_solucion')} className="btn-secondary w-full justify-center !text-amber-800 hover:!bg-amber-50">
            <ExclamationTriangleIcon className="size-5" aria-hidden /> {ANSWER.sin_solucion.label}
          </button>
          {editing && (
            <button onClick={() => setEditing(false)} className="btn-link justify-self-start text-sm sm:col-span-2">Mantener mi respuesta</button>
          )}
        </div>
      )}

      <Modal open={!!answer} onClose={() => setAnswer(null)} title={answer ? ANSWER[answer].title : ''}>
        {answer && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">{ANSWER[answer].text}</p>
            <label className="block">
              <span className="sr-only">{ANSWER[answer].placeholder}</span>
              <textarea rows={3} className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder={ANSWER[answer].placeholder} />
            </label>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button onClick={() => setAnswer(null)} className="btn-secondary">Cancelar</button>
              <button disabled={isPending} onClick={() => mutate({ id: report.id, value: answer, note: note.trim() || undefined })} className="btn-primary">
                {isPending ? 'Enviando…' : ANSWER[answer].label}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  )
}

/**
 * Para el personal: qué respondieron los ciudadanos y si hay que revisar el reporte.
 * Solo se muestra si hay respuestas.
 */
export function CitizenFeedbackSummary({ report }: { report: Report }) {
  const v = report.votes
  const after = v.afterResolution ?? { solucionado: 0, sin_solucion: 0 }
  const total = v.solucionado + v.sin_solucion
  if (!report.canManage || (total === 0 && !report.needsReview)) return null
  const resolved = report.status === 'resuelto' || report.status === 'cerrado'
  const ownerText = v.owner === 'solucionado' ? 'confirmó que se resolvió' : v.owner === 'sin_solucion' ? 'indica que el problema continúa' : null

  return (
    <section className="card space-y-2" aria-labelledby="respuesta-ciudadana">
      <h2 id="respuesta-ciudadana" className="text-sm font-bold text-slate-900">Respuesta ciudadana</h2>
      <ul className="space-y-1 text-sm text-slate-700">
        {ownerText && <li>Quien hizo el reporte <b className="font-semibold">{ownerText}</b>.</li>}
        {resolved ? (
          <li>
            Desde que se resolvió: <b className="font-semibold">{after.solucionado}</b> {after.solucionado === 1 ? 'confirmación' : 'confirmaciones'} ·{' '}
            <b className="font-semibold">{after.sin_solucion}</b> {after.sin_solucion === 1 ? 'aviso' : 'avisos'} de que continúa
          </li>
        ) : (
          <li>
            <b className="font-semibold">{v.solucionado}</b> {v.solucionado === 1 ? 'persona indica' : 'personas indican'} que ya se resolvió ·{' '}
            <b className="font-semibold">{v.sin_solucion}</b> que sigue sin resolverse
          </li>
        )}
      </ul>
      <p className="text-xs text-slate-500">Es informativo: el estado oficial solo cambia desde "Actualizar estado".</p>
    </section>
  )
}

/** Aviso destacado cuando un reporte resuelto tiene la señal "el problema continúa" */
export function NeedsReviewAlert({ report }: { report: Report }) {
  if (!report.needsReview) return null
  const n = report.votes.afterResolution?.sin_solucion ?? 1
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-inset ring-amber-300">
      <ExclamationTriangleIcon className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
      <p>
        <b className="font-semibold">Requiere revisión:</b> figura como resuelto, pero {n === 1 ? 'un ciudadano indica' : `${n} ciudadanos indican`} que el problema continúa.
        {report.canManage && ' Revisa el caso y, si procede, cámbialo a "Atención en proceso".'}
      </p>
    </div>
  )
}
