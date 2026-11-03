import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { createAdminReport, updateAdminReport, type AdminReportInput } from '@/api/ModerationAPI'
import { useCategories } from '@/hooks/useCategories'
import { SEVERITY_OPTIONS, STATUS_OPTIONS } from '@/lib/labels'
import { assetUrl } from '@/lib/media'
import type { Coords } from '@/hooks/useGeolocation'
import Modal from '@/components/ui/Modal'
import SelectBox from '@/components/ui/SelectBox'
import ErrorMessage from '@/components/ui/ErrorMessage'
import ImageInput from '@/components/reports/ImageInput'
import LocationPicker from '@/components/map/LocationPicker'
import type { Report } from '@/types'

type FormValues = Omit<AdminReportInput, 'lat' | 'lng' | 'image'>

const emptyForm: FormValues = {
  title: '', description: '', categoryId: 0, severity: 'media', status: 'pendiente',
  colonia: '', calle: '', anonymous: false, hidden: false, hiddenReason: '', note: '',
}

const toForm = (r: Report): FormValues => ({
  title: r.title, description: r.description, categoryId: r.categoryId, severity: r.severity, status: r.status,
  colonia: r.colonia ?? '', calle: r.calle ?? '', anonymous: r.anonymous, hidden: r.hidden, hiddenReason: r.hiddenReason ?? '', note: '',
})

type Props = {
  open: boolean
  /** null = crear un reporte nuevo */
  report: Report | null
  onClose: () => void
}

/** Alta y edición de reportes para el administrador */
export default function ReportFormDialog({ open, report, onClose }: Props) {
  const queryClient = useQueryClient()
  const { data: categories = [] } = useCategories()
  const [coords, setCoords] = useState<Coords | null>(null)
  const [image, setImage] = useState<File | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const isEdit = !!report

  const { register, handleSubmit, control, reset, watch, formState: { errors } } = useForm<FormValues>({ defaultValues: emptyForm })

  // Cada vez que se abre, carga los datos del reporte (o limpia para uno nuevo)
  useEffect(() => {
    if (!open) return
    reset(report ? toForm(report) : emptyForm)
    setCoords(report ? { lat: report.lat, lng: report.lng } : null)
    setImage(null)
    setSubmitted(false)
  }, [open, report, reset])

  const { mutate, isPending } = useMutation({
    mutationFn: (input: AdminReportInput) => (report ? updateAdminReport({ ...input, id: report.id }) : createAdminReport(input)),
    onError: (e) => toast.error(e.message),
    onSuccess: () => {
      toast.success(isEdit ? 'Reporte actualizado' : 'Reporte creado')
      queryClient.invalidateQueries()
      onClose()
    },
  })

  const categoryOptions = useMemo(
    () => [{ value: 0, label: 'Selecciona…' }, ...categories.map((c) => ({ value: c.id, label: c.name }))],
    [categories],
  )
  const statusChanged = isEdit && watch('status') !== report.status

  const onSubmit = (form: FormValues) => {
    setSubmitted(true)
    if (!coords || (!isEdit && !image)) return
    mutate({ ...form, lat: coords.lat, lng: coords.lng, image })
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? `Editar reporte #${report.id}` : 'Nuevo reporte'} size="lg">
      <form onSubmit={handleSubmit(onSubmit, () => setSubmitted(true))} className="space-y-4" noValidate>
        <div>
          <label className="label" htmlFor="r-title">Título</label>
          <input id="r-title" className="input"
            {...register('title', { required: 'El título es obligatorio', minLength: { value: 3, message: 'Mínimo 3 caracteres' }, maxLength: { value: 120, message: 'Máximo 120 caracteres' } })} />
          {errors.title && <ErrorMessage>{errors.title.message}</ErrorMessage>}
        </div>
        <div>
          <label className="label" htmlFor="r-description">Descripción</label>
          <textarea id="r-description" rows={3} className="input"
            {...register('description', { required: 'La descripción es obligatoria', minLength: { value: 10, message: 'Mínimo 10 caracteres' }, maxLength: { value: 2000, message: 'Máximo 2000 caracteres' } })} />
          {errors.description && <ErrorMessage>{errors.description.message}</ErrorMessage>}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Controller name="categoryId" control={control} rules={{ validate: (v) => v > 0 || 'Selecciona una categoría' }}
              render={({ field }) => <SelectBox label="Categoría" value={field.value} onChange={field.onChange} options={categoryOptions} />} />
            {errors.categoryId && <ErrorMessage>{errors.categoryId.message}</ErrorMessage>}
          </div>
          <Controller name="severity" control={control}
            render={({ field }) => <SelectBox label="Gravedad" value={field.value} onChange={field.onChange} options={SEVERITY_OPTIONS} />} />
          <Controller name="status" control={control}
            render={({ field }) => <SelectBox label="Estado" value={field.value} onChange={field.onChange} options={STATUS_OPTIONS} />} />
        </div>
        {statusChanged && (
          <div>
            <label className="label" htmlFor="r-note">Nota para el seguimiento (opcional)</label>
            <input id="r-note" className="input" placeholder="Ej. Cuadrilla asignada" {...register('note', { maxLength: 300 })} />
          </div>
        )}

        <div>
          <span className="label">Ubicación</span>
          <LocationPicker value={coords} onChange={setCoords} />
          {submitted && !coords && <ErrorMessage>Marca la ubicación en el mapa</ErrorMessage>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="r-calle">Calle y número</label>
            <input id="r-calle" className="input" {...register('calle', { maxLength: 160 })} />
          </div>
          <div>
            <label className="label" htmlFor="r-colonia">Colonia</label>
            <input id="r-colonia" className="input" {...register('colonia', { maxLength: 120 })} />
          </div>
        </div>

        <div>
          <span className="label">{isEdit ? 'Reemplazar foto (opcional)' : 'Foto del siniestro'}</span>
          {isEdit && !image && (
            <img src={assetUrl(report.thumbUrl)} alt="Foto actual" className="mb-2 size-20 rounded-lg object-cover" />
          )}
          <ImageInput value={image} onChange={setImage} error={submitted && !isEdit && !image ? 'La foto es obligatoria' : undefined} />
        </div>

        <div className="flex flex-wrap gap-4 rounded-xl bg-white/50 p-3 text-sm font-semibold text-slate-700">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-4 accent-indigo-600" {...register('anonymous')} /> Anónimo al público
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-4 accent-indigo-600" {...register('hidden')} /> Oculto en el mapa
          </label>
        </div>
        {watch('hidden') && (
          <div>
            <label className="label" htmlFor="r-hidden">Motivo de ocultarlo</label>
            <input id="r-hidden" className="input" {...register('hiddenReason', { maxLength: 300 })} />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-3 font-bold text-slate-600 hover:bg-white/60">Cancelar</button>
          <button type="submit" disabled={isPending} className="btn-primary">
            {isPending ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear reporte'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
