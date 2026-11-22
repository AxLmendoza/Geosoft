import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { ArrowLeftIcon, CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/20/solid'
import {
  getStaff, getStaffActivity, getStaffMember, reassignStaffReports, resendInvitation, setStaffActive, updateStaff,
} from '@/api/StaffAPI'
import { getAdminAreas } from '@/api/AttentionAPI'
import { ACCOUNT_STATUS, HISTORY_KIND, ROLE, STATUS } from '@/lib/labels'
import { formatDateTime, formatShortDate, timeAgo } from '@/lib/date'
import SelectBox from '@/components/ui/SelectBox'
import ErrorMessage from '@/components/ui/ErrorMessage'
import { AccountStatusBadge, StatusBadge } from '@/components/ui/Badges'
import { ErrorState, Skeleton } from '@/components/ui/States'
import RolePicker from '@/components/staff/RolePicker'
import type { InvitationResult, StaffActivity, StaffDetail } from '@/types'

/* ------------------------------------------------------------------ */

function Section({ title, description, children, id }: { title: string; description?: string; children: ReactNode; id?: string }) {
  return (
    <section className="card" aria-labelledby={id}>
      <h2 id={id} className="card-title !mb-1">{title}</h2>
      {description && <p className="mb-4 text-sm text-slate-500">{description}</p>}
      <div className={description ? '' : 'mt-4'}>{children}</div>
    </section>
  )
}

/** Resultado de la invitación: dice la verdad sobre si salió o no */
function InvitationBanner({ result, created }: { result: InvitationResult; created?: boolean }) {
  if (result.sent) {
    return (
      <div role="status" className="flex gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950 ring-1 ring-inset ring-emerald-300">
        <CheckCircleIcon className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
        <div>
          <p className="font-semibold">{created ? 'Responsable registrado. Invitación enviada.' : 'Invitación enviada.'}</p>
          <p className="mt-0.5">{result.warning ?? 'La cuenta se activará cuando la persona cree su contraseña con el enlace del correo.'}</p>
        </div>
      </div>
    )
  }
  return (
    <div role="alert" className="flex gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-950 ring-1 ring-inset ring-amber-300">
      <ExclamationTriangleIcon className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
      <div>
        <p className="font-semibold">{created ? 'Responsable registrado, pero la invitación no se envió' : 'La invitación no se envió'}</p>
        <p className="mt-0.5">{result.reason}</p>
      </div>
    </div>
  )
}

/* ------------------------------ Datos ------------------------------ */

type DataForm = { name: string; email: string }

function DataSection({ member }: { member: StaffDetail }) {
  const queryClient = useQueryClient()
  const [role, setRole] = useState<'operativo' | 'moderador'>(member.role === 'moderador' ? 'moderador' : 'operativo')
  const [areaId, setAreaId] = useState(member.area?.id ?? 0)
  const [result, setResult] = useState<InvitationResult | null>(null)
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<DataForm>({ defaultValues: { name: member.name, email: member.email } })

  useEffect(() => {
    reset({ name: member.name, email: member.email })
    setRole(member.role === 'moderador' ? 'moderador' : 'operativo')
    setAreaId(member.area?.id ?? 0)
  }, [member, reset])

  const areas = useQuery({ queryKey: ['admin-areas'], queryFn: getAdminAreas, staleTime: 5 * 60_000 })
  const areaOptions = useMemo(
    () => [{ value: 0, label: 'Selecciona un área o servicio' }, ...(areas.data ?? []).filter((a) => (a.active && a.type !== 'externa') || a.id === member.area?.id).map((a) => ({ value: a.id, label: a.name }))],
    [areas.data, member.area?.id],
  )

  const isAdminTarget = member.role === 'admin'
  const canChangeRole = !member.isSelf && !isAdminTarget
  const canChangeEmail = !member.confirmed

  const name = watch('name')
  const email = watch('email')
  const changes: Record<string, unknown> = {}
  if (name.trim() !== member.name) changes.name = name.trim()
  if (canChangeEmail && email.trim().toLowerCase() !== member.email) changes.email = email.trim()
  if (canChangeRole && role !== member.role) changes.role = role
  if (canChangeRole && role === 'operativo' && areaId && areaId !== member.area?.id) changes.areaId = areaId
  const moving = 'role' in changes || 'areaId' in changes
  const hasChanges = Object.keys(changes).length > 0

  const { mutate, isPending } = useMutation({
    mutationFn: updateStaff,
    onError: (e) => toast.error(e.message),
    onSuccess: (data) => {
      toast.success(data.releasedReports ? `Cambios guardados. ${data.releasedReports} reportes volvieron a la bandeja de su área.` : 'Cambios guardados')
      setResult(data.invitation)
      queryClient.invalidateQueries({ queryKey: ['staff'] })
    },
  })

  const submit = () => {
    if (canChangeRole && role === 'operativo' && !areaId) {
      toast.error('Selecciona el área o servicio')
      return
    }
    mutate({ id: member.id, ...changes })
  }

  return (
    <Section id="sec-datos" title="Datos" description={isAdminTarget ? 'Las cuentas de administración solo permiten cambiar el nombre.' : member.isSelf ? 'No puedes cambiar tu propio rol ni tu área.' : undefined}>
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        {result && <InvitationBanner result={result} />}
        <div>
          <label className="label" htmlFor="d-name">Nombre completo</label>
          <input id="d-name" className="input" aria-invalid={!!errors.name}
            {...register('name', { required: 'Escribe el nombre completo', minLength: { value: 3, message: 'Mínimo 3 caracteres' }, maxLength: { value: 60, message: 'Máximo 60 caracteres' }, validate: (v) => !/[<>]/.test(v) || 'Caracteres no permitidos' })} />
          {errors.name && <ErrorMessage>{errors.name.message}</ErrorMessage>}
        </div>
        <div>
          <label className="label" htmlFor="d-email">Correo electrónico</label>
          <input id="d-email" type="email" className="input" readOnly={!canChangeEmail} aria-describedby="d-email-help" aria-invalid={!!errors.email}
            {...register('email', { required: 'Escribe el correo', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Correo no válido' } })} />
          <p id="d-email-help" className="mt-1.5 text-sm text-slate-500">
            {canChangeEmail
              ? 'Si lo corriges, se enviará una invitación nueva a la dirección correcta.'
              : 'Por seguridad, el correo de una cuenta activa no se cambia. Si cambió, desactiva esta cuenta y registra el nuevo correo.'}
          </p>
          {errors.email && <ErrorMessage>{errors.email.message}</ErrorMessage>}
        </div>

        {!isAdminTarget && (
          <div className="space-y-4 border-t border-line pt-4">
            <span className="label !mb-0">Rol en la plataforma</span>
            <RolePicker value={role} onChange={setRole} disabled={!canChangeRole} />
            {role === 'operativo' && (
              <div>
                {canChangeRole ? (
                  <SelectBox label="Área o servicio responsable" value={areaId} onChange={setAreaId} options={areaOptions} />
                ) : (
                  <p className="text-sm text-slate-700"><span className="label !mb-0.5">Área o servicio responsable</span>{member.area?.name ?? 'Sin área'}</p>
                )}
              </div>
            )}
          </div>
        )}

        {moving && member.openAssigned > 0 && (
          <p className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-inset ring-amber-300">
            <InformationCircleIcon className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
            Sus {member.openAssigned} reportes abiertos volverán a la bandeja general de {member.area?.name ?? 'su área'} para que alguien más los tome.
          </p>
        )}

        <div className="flex justify-end">
          <button type="submit" disabled={!hasChanges || isPending} className="btn-primary">{isPending ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </form>
    </Section>
  )
}

/* ------------------------------ Cuenta ------------------------------ */

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-2 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-800">{children}</dd>
    </div>
  )
}

const dateOrDash = (value: string | null) => (value ? <time dateTime={value} title={formatDateTime(value)}>{formatShortDate(value)}</time> : 'Nunca')

function AccountSection({ member, onInvitation }: { member: StaffDetail; onInvitation: (r: InvitationResult) => void }) {
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['staff'] })

  const toggle = useMutation({
    mutationFn: setStaffActive,
    onError: (e) => toast.error(e.message),
    onSuccess: (data) => {
      toast.success(data.message)
      setConfirming(false)
      refresh()
    },
  })
  const resend = useMutation({
    mutationFn: resendInvitation,
    onError: (e) => toast.error(e.message),
    onSuccess: (data) => {
      onInvitation(data.invitation)
      refresh()
    },
  })

  const pending = member.status === 'invitacion_pendiente' || member.status === 'invitacion_vencida' || member.status === 'sin_confirmar'

  return (
    <Section id="sec-cuenta" title="Cuenta">
      <div className="space-y-3">
        <AccountStatusBadge status={member.status} />
        <p className="text-sm text-slate-600">{ACCOUNT_STATUS[member.status].help}</p>
        {member.status === 'invitacion_pendiente' && member.inviteExpiresAt && (
          <p className="text-sm text-slate-600">El enlace vence {timeAgo(member.inviteExpiresAt)}.</p>
        )}
      </div>

      <dl className="mt-4 divide-y divide-line border-y border-line">
        <Fact label="Alta">{dateOrDash(member.createdAt)}</Fact>
        <Fact label="Última modificación">{dateOrDash(member.updatedAt)}</Fact>
        <Fact label="Último acceso">{dateOrDash(member.lastLoginAt)}</Fact>
        {member.invitedBy && <Fact label="Registrado por">{member.invitedBy.name}</Fact>}
      </dl>

      <div className="mt-4 space-y-2">
        {pending && member.active && (
          <button onClick={() => resend.mutate(member.id)} disabled={resend.isPending} className="btn-secondary w-full">
            {resend.isPending ? 'Enviando…' : 'Reenviar invitación'}
          </button>
        )}
        {member.isSelf ? (
          <p className="text-sm text-slate-500">No puedes desactivar tu propia cuenta.</p>
        ) : member.active ? (
          confirming ? (
            <div className="rounded-xl bg-red-50 p-3.5 ring-1 ring-inset ring-red-200" role="group" aria-label="Confirmar desactivación">
              <p className="text-sm text-red-950">
                <b className="font-semibold">{member.name} ya no podrá iniciar sesión.</b> Su historial se conserva
                {member.openAssigned > 0 ? ` y sus ${member.openAssigned} reportes abiertos volverán a la bandeja de su área.` : '.'}
              </p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => toggle.mutate({ id: member.id, active: false })} disabled={toggle.isPending} className="btn-danger btn-compact flex-1">
                  {toggle.isPending ? 'Desactivando…' : 'Sí, desactivar'}
                </button>
                <button onClick={() => setConfirming(false)} className="btn-secondary btn-compact flex-1">Cancelar</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirming(true)} className="btn-danger w-full">Desactivar cuenta</button>
          )
        ) : (
          <button onClick={() => toggle.mutate({ id: member.id, active: true })} disabled={toggle.isPending} className="btn-secondary w-full">
            {toggle.isPending ? 'Activando…' : 'Activar cuenta'}
          </button>
        )}
      </div>
    </Section>
  )
}

/* ------------------------- Reportes asignados ------------------------- */

function AssignedSection({ member }: { member: StaffDetail }) {
  const queryClient = useQueryClient()
  const [target, setTarget] = useState<number | -1>(-1)
  const colleagues = useQuery({
    queryKey: ['staff', { role: 'operativo', status: 'activo', areaId: member.area?.id }],
    queryFn: () => getStaff({ role: 'operativo', status: 'activo', areaId: member.area?.id }),
    enabled: member.openAssigned > 0 && !!member.area,
  })
  const options = useMemo(
    () => [
      { value: -1 as number, label: 'Elige a quién…' },
      { value: 0, label: `Bandeja general de ${member.area?.name ?? 'su área'}` },
      ...(colleagues.data ?? []).filter((c) => c.id !== member.id).map((c) => ({ value: c.id, label: `${c.name} (${c.openAssigned} abiertos)` })),
    ],
    [colleagues.data, member],
  )
  const reassign = useMutation({
    mutationFn: reassignStaffReports,
    onError: (e) => toast.error(e.message),
    onSuccess: (msg) => {
      toast.success(msg)
      setTarget(-1)
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      queryClient.invalidateQueries({ queryKey: ['attention'] })
    },
  })

  if (member.role !== 'operativo') {
    return (
      <Section id="sec-reportes" title="Reportes asignados">
        <p className="text-sm text-slate-600">{member.role === 'admin' ? 'La administración supervisa todas las áreas.' : 'Los moderadores no tienen reportes asignados.'}</p>
      </Section>
    )
  }

  return (
    <Section
      id="sec-reportes"
      title="Reportes asignados"
      description={member.area ? `${member.area.name} tiene ${member.areaOpenReports} reportes abiertos en total.` : 'Sin área asignada: no puede ver reportes.'}
    >
      {member.assignedReports.length === 0 ? (
        <p className="text-sm text-slate-600">No tiene reportes abiertos asignados a su nombre.</p>
      ) : (
        <>
          <ul className="-mx-2 divide-y divide-line">
            {member.assignedReports.map((r) => (
              <li key={r.id}>
                <Link to={`/reports/${r.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-slate-50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      <span className="font-normal text-slate-400">#{r.id}</span> {r.title}
                    </span>
                    <span className="block text-xs text-slate-500">Recibido {timeAgo(r.createdAt)}{r.severity === 'critica' ? ', gravedad crítica' : ''}</span>
                  </span>
                  <StatusBadge status={r.status} short />
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-line pt-4">
            <p className="label">Reasignar sus {member.openAssigned} reportes abiertos</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <SelectBox value={target} onChange={setTarget} options={options} className="flex-1" />
              <button
                onClick={() => reassign.mutate({ id: member.id, toUserId: target === 0 ? null : target })}
                disabled={target === -1 || reassign.isPending}
                className="btn-secondary"
              >
                {reassign.isPending ? 'Reasignando…' : 'Reasignar'}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">Solo aparece personal activo de la misma área.</p>
          </div>
        </>
      )}
    </Section>
  )
}

/* ------------------------------ Actividad ------------------------------ */

const AUDIT_LABEL: Record<string, string> = {
  'staff.created': 'Alta en la plataforma',
  'staff.updated': 'Datos actualizados',
  'staff.activated': 'Cuenta activada',
  'staff.deactivated': 'Cuenta desactivada',
  'staff.reports_reassigned': 'Reportes reasignados',
  'invitation.sent': 'Invitación enviada',
  'invitation.not_sent': 'Invitación no enviada: el correo no estaba disponible',
  'invitation.accepted': 'Aceptó la invitación y creó su contraseña',
  'user.role_changed': 'Cambio de rol',
  'user.banned': 'Cuenta suspendida por moderación',
  'user.unbanned': 'Suspensión retirada',
  'report.assigned': 'Asignó un reporte',
  'report.restored': 'Restauró un reporte',
  'report.destroyed': 'Eliminó un reporte definitivamente',
  'area.created': 'Creó un área',
  'area.updated': 'Editó un área',
  'category.created': 'Creó una categoría',
  'category.updated': 'Editó una categoría',
  'blacklist.added': 'Vetó un correo',
  'blacklist.removed': 'Retiró un correo vetado',
}

const FIELD_LABEL: Record<string, string> = { name: 'nombre', email: 'correo', role: 'rol', areaId: 'área' }

function auditText(entry: StaffActivity['audit'][number], memberId: number) {
  let text = AUDIT_LABEL[entry.action] ?? entry.action
  const changes = entry.details?.changes as Record<string, unknown> | undefined
  if (changes) text += `: ${Object.keys(changes).map((k) => FIELD_LABEL[k] ?? k).join(', ')}`
  if (entry.targetType === 'report' && entry.targetId) text += ` #${entry.targetId}`
  const byOther = entry.actor && entry.actor.id !== memberId
  return { text, by: byOther ? entry.actor!.name : null }
}

function ActivitySection({ member }: { member: StaffDetail }) {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['staff', member.id, 'activity'], queryFn: () => getStaffActivity(member.id) })
  const items = useMemo(() => {
    if (!data) return []
    const a = data.audit.map((e) => ({ key: `a${e.id}`, at: e.createdAt, ...auditText(e, member.id), link: null as string | null }))
    const b = data.attention.map((h) => ({
      key: `h${h.id}`,
      at: h.createdAt,
      text: `${HISTORY_KIND[h.kind]}${h.kind === 'estado' ? `: ${STATUS[h.toStatus].short}` : ''} en #${h.report.id}${h.report.title ? ` ${h.report.title}` : ''}`,
      by: null,
      link: `/reports/${h.report.id}`,
    }))
    return [...a, ...b].sort((x, y) => +new Date(y.at) - +new Date(x.at)).slice(0, 40)
  }, [data, member.id])

  return (
    <Section id="sec-actividad" title="Actividad" description="Movimientos de la cuenta y su trabajo reciente en reportes.">
      {isLoading ? (
        <div className="space-y-2" role="status" aria-label="Cargando actividad">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
      ) : isError ? (
        <ErrorState message="No pudimos cargar la actividad." onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-600">Sin actividad registrada.</p>
      ) : (
        <ol className="space-y-3 border-l-2 border-line pl-4">
          {items.map((i) => (
            <li key={i.key} className="relative text-sm">
              <span className="absolute -left-[1.3rem] top-1.5 size-2 rounded-full bg-slate-300 ring-2 ring-white" aria-hidden />
              {i.link ? <Link to={i.link} className="text-slate-800 hover:text-brand-700 hover:underline">{i.text}</Link> : <span className="text-slate-800">{i.text}</span>}
              <span className="block text-xs text-slate-500">
                <time dateTime={i.at} title={formatDateTime(i.at)}>{timeAgo(i.at)}</time>
                {i.by && <>, por {i.by}</>}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Section>
  )
}

/* ------------------------------ Página ------------------------------ */

export default function StaffDetailView() {
  const { userId } = useParams()
  const id = Number(userId)
  const navigate = useNavigate()
  const location = useLocation()
  const initial = location.state as { invitation?: InvitationResult; created?: boolean } | null
  const [invitation, setInvitation] = useState<InvitationResult | null>(initial?.invitation ?? null)
  const created = !!initial?.created

  // El resultado del alta se muestra una vez; al recargar no se repite
  useEffect(() => {
    if (initial) navigate(location.pathname, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data: member, isLoading, isError, error, refetch } = useQuery({ queryKey: ['staff', id], queryFn: () => getStaffMember(id), enabled: Number.isInteger(id), retry: false })

  if (isLoading) {
    return (
      <div className="space-y-4" role="status" aria-label="Cargando responsable">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (isError || !member) {
    const notFound = (error as { response?: { status?: number } } | null)?.response?.status === 404
    return (
      <div className="space-y-4">
        <Link to="/admin/staff" className="btn-link"><ArrowLeftIcon className="size-4" aria-hidden /> Responsables</Link>
        <ErrorState message={notFound ? 'Esta persona no es parte del personal o ya no existe.' : 'No pudimos cargar la ficha.'} onRetry={notFound ? undefined : () => refetch()} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/staff" className="btn-link"><ArrowLeftIcon className="size-4" aria-hidden /> Responsables</Link>
      <header className="space-y-2">
        <h1 className="page-title">{member.name}{member.isSelf && <span className="ml-2 align-middle text-base font-normal text-slate-500">(tú)</span>}</h1>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[15px] text-slate-600">
          <span>{ROLE[member.role]}{member.area ? ` de ${member.area.name}` : ''}</span>
          <AccountStatusBadge status={member.status} />
        </p>
      </header>

      {invitation && <InvitationBanner result={invitation} created={created} />}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <DataSection member={member} />
          <AssignedSection member={member} />
          <ActivitySection member={member} />
        </div>
        <div className="lg:sticky lg:top-6">
          <AccountSection member={member} onInvitation={setInvitation} />
        </div>
      </div>
    </div>
  )
}
