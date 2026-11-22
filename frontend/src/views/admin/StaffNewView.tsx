import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/20/solid'
import { createStaff, getStaffMeta } from '@/api/StaffAPI'
import { getAdminAreas } from '@/api/AttentionAPI'
import SelectBox from '@/components/ui/SelectBox'
import ErrorMessage from '@/components/ui/ErrorMessage'
import MailNotice from '@/components/staff/MailNotice'
import RolePicker from '@/components/staff/RolePicker'

type Form = { name: string; email: string }

/** Alta de un responsable: los datos mínimos y una invitación para que cree su contraseña */
export default function StaffNewView() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [role, setRole] = useState<'operativo' | 'moderador'>('operativo')
  const [areaId, setAreaId] = useState(0)
  const [areaError, setAreaError] = useState('')
  const [serverError, setServerError] = useState<{ message: string; code?: string } | null>(null)
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ defaultValues: { name: '', email: '' } })

  const meta = useQuery({ queryKey: ['staff', 'meta'], queryFn: getStaffMeta, staleTime: 5 * 60_000 })
  const areas = useQuery({ queryKey: ['admin-areas'], queryFn: getAdminAreas, staleTime: 5 * 60_000 })
  // Solo áreas que atienden directamente (las autoridades externas reciben reportes canalizados)
  const areaOptions = useMemo(
    () => [{ value: 0, label: 'Selecciona un área o servicio' }, ...(areas.data ?? []).filter((a) => a.active && a.type !== 'externa').map((a) => ({ value: a.id, label: a.name }))],
    [areas.data],
  )
  const noAreas = areas.isSuccess && areaOptions.length === 1

  const { mutate, isPending } = useMutation({
    mutationFn: createStaff,
    onError: (e: Error & { code?: string }) => setServerError({ message: e.message, code: e.code }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      queryClient.invalidateQueries({ queryKey: ['admin-areas'] })
      navigate(`/admin/staff/${data.member.id}`, { state: { invitation: data.invitation, created: true } })
    },
  })

  const onSubmit = (form: Form) => {
    setServerError(null)
    if (role === 'operativo' && !areaId) {
      setAreaError('Selecciona el área o servicio que atenderá')
      return
    }
    mutate({ name: form.name.trim(), email: form.email.trim(), role, areaId: role === 'operativo' ? areaId : null })
  }

  const hours = meta.data?.inviteTtlHours ?? 72

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link to="/admin/staff" className="btn-link"><ArrowLeftIcon className="size-4" aria-hidden /> Responsables</Link>
      <header>
        <h1 className="page-title">Registrar responsable</h1>
        <p className="page-subtitle">La persona recibirá un correo para crear su contraseña. Tú nunca la conocerás.</p>
      </header>

      <MailNotice meta={meta.data} />

      <form onSubmit={handleSubmit(onSubmit)} className="card space-y-6" noValidate>
        <fieldset className="space-y-4">
          <legend className="card-title !mb-1">Datos de la persona</legend>
          <div>
            <label className="label" htmlFor="s-name">Nombre completo</label>
            <input id="s-name" className="input" autoComplete="off" aria-invalid={!!errors.name}
              {...register('name', {
                required: 'Escribe el nombre completo',
                minLength: { value: 3, message: 'Mínimo 3 caracteres' },
                maxLength: { value: 60, message: 'Máximo 60 caracteres' },
                validate: (v) => !/[<>]/.test(v) || 'El nombre contiene caracteres no permitidos',
              })} />
            {errors.name && <ErrorMessage>{errors.name.message}</ErrorMessage>}
          </div>
          <div>
            <label className="label" htmlFor="s-email">Correo electrónico</label>
            <input id="s-email" type="email" className="input" autoComplete="off" inputMode="email" aria-invalid={!!errors.email || serverError?.code === 'EMAIL_EXISTS'}
              aria-describedby="s-email-help"
              {...register('email', {
                required: 'Escribe el correo',
                pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Correo no válido' },
                maxLength: { value: 120, message: 'Máximo 120 caracteres' },
              })} />
            <p id="s-email-help" className="mt-1.5 text-sm text-slate-500">De preferencia el correo institucional. Ahí llegará la invitación.</p>
            {errors.email && <ErrorMessage>{errors.email.message}</ErrorMessage>}
          </div>
        </fieldset>

        <fieldset className="space-y-4 border-t border-line pt-6">
          <legend className="card-title !mb-1">Rol y área</legend>
          <RolePicker value={role} onChange={(r) => { setRole(r); setAreaError('') }} />
          {role === 'operativo' && (
            <div>
              <SelectBox label="Área o servicio responsable" value={areaId} onChange={(v) => { setAreaId(v); setAreaError('') }} options={areaOptions} />
              {noAreas && (
                <p className="mt-1.5 text-sm text-slate-600">
                  No hay áreas activas. <Link to="/admin/areas" className="btn-link">Crea una en Áreas y categorías</Link>.
                </p>
              )}
              {areaError && <ErrorMessage>{areaError}</ErrorMessage>}
              <p className="mt-1.5 text-sm text-slate-500">Solo verá y atenderá los reportes de esta área.</p>
            </div>
          )}
        </fieldset>

        <div className="space-y-4 border-t border-line pt-6">
          <p className="text-sm text-slate-600">
            La cuenta quedará con <b className="font-semibold text-slate-800">invitación pendiente</b> hasta que la persona cree su contraseña. El enlace vence en {hours} horas y se puede reenviar.
          </p>
          {serverError && (
            <div role="alert" className="rounded-xl bg-red-50 p-3.5 text-sm text-red-800 ring-1 ring-inset ring-red-200">
              {serverError.message}
              {serverError.code === 'EMAIL_EXISTS' && /ciudadano/.test(serverError.message) && (
                <> <Link to="/users" className="font-semibold underline">Ir a Usuarios</Link></>
              )}
            </div>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link to="/admin/staff" className="btn-secondary">Cancelar</Link>
            <button type="submit" disabled={isPending} className="btn-primary">
              {isPending ? 'Registrando…' : meta.data?.mail.configured === false ? 'Registrar responsable' : 'Registrar y enviar invitación'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
