import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { Field, Label, Description, Radio, RadioGroup, Switch } from '@headlessui/react'
import { BuildingOffice2Icon, EyeSlashIcon } from '@heroicons/react/24/outline'
import { createReport } from '@/api/ReportAPI'
import { useCategories } from '@/hooks/useCategories'
import { reverseGeocode } from '@/lib/geocode'
import { SEVERITY, SEVERITY_OPTIONS } from '@/lib/labels'
import type { Coords } from '@/hooks/useGeolocation'
import ImageInput from '@/components/reports/ImageInput'
import LocationPicker from '@/components/map/LocationPicker'
import CategoryIcon from '@/components/CategoryIcon'
import ErrorMessage from '@/components/ui/ErrorMessage'
import type { NewReportForm } from '@/types'

export default function NewReportView() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: categories = [] } = useCategories()
  const [image, setImage] = useState<File | null>(null)
  const [coords, setCoords] = useState<Coords | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const { register, handleSubmit, control, setValue, getValues, watch, formState: { errors } } = useForm<NewReportForm>({
    defaultValues: { title: '', description: '', categoryId: 0, severity: 'media', colonia: '', calle: '', anonymous: true },
  })

  const { mutate, isPending } = useMutation({
    mutationFn: createReport,
    onError: (e) => toast.error(e.message),
    onSuccess: (report) => {
      toast.success('¡Reporte publicado! Gracias por ayudar a tu comunidad')
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      navigate(`/reports/${report.id}`, { replace: true })
    },
  })

  // Al fijar el punto sugerimos colonia y calle si el usuario no las ha escrito
  const handleLocation = async (c: Coords) => {
    setCoords(c)
    const addr = await reverseGeocode(c.lat, c.lng)
    if (!addr) return
    if (!getValues('colonia')) setValue('colonia', addr.colonia)
    if (!getValues('calle')) setValue('calle', addr.calle)
  }

  const onSubmit = (form: NewReportForm) => {
    setSubmitted(true)
    if (!image || !coords) return
    mutate({ ...form, image, lat: coords.lat, lng: coords.lng })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, () => setSubmitted(true))} className="mx-auto max-w-2xl space-y-6" noValidate>
      <header>
        <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">Nuevo reporte</h1>
        <p className="mt-1 text-slate-500">Toma una foto del problema, marca dónde está y descríbelo.</p>
      </header>

      <section className="card">
        <h2 className="card-title">1. Foto del siniestro</h2>
        <ImageInput value={image} onChange={setImage} error={submitted && !image ? 'La foto es obligatoria' : undefined} />
      </section>

      <section className="card">
        <h2 className="card-title">2. Ubicación</h2>
        <LocationPicker value={coords} onChange={handleLocation} />
        {submitted && !coords && <ErrorMessage>Marca la ubicación en el mapa</ErrorMessage>}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="calle">Calle y número</label>
            <input id="calle" className="input" autoComplete="street-address" {...register('calle', { maxLength: 160 })} />
          </div>
          <div>
            <label className="label" htmlFor="colonia">Colonia</label>
            <input id="colonia" className="input" {...register('colonia', { maxLength: 120 })} />
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">3. ¿Qué tipo de problema es?</h2>
        <Controller
          name="categoryId"
          control={control}
          rules={{ validate: (v) => v > 0 || 'Selecciona una categoría' }}
          render={({ field }) => (
            <RadioGroup value={field.value} onChange={field.onChange} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {categories.map((c) => (
                <Radio
                  key={c.id}
                  value={c.id}
                  className="group flex cursor-pointer items-center gap-2 rounded-xl p-3 ring-1 ring-slate-200 transition hover:bg-slate-50 data-[checked]:ring-2 data-[checked]:ring-[var(--c)]"
                  style={{ ['--c' as string]: c.color }}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: c.color }}>
                    <CategoryIcon slug={c.slug} className="size-5" />
                  </span>
                  <span className="text-sm font-semibold leading-tight text-slate-700 group-data-[checked]:text-slate-900">{c.name}</span>
                </Radio>
              ))}
            </RadioGroup>
          )}
        />
        {errors.categoryId && <ErrorMessage>{errors.categoryId.message}</ErrorMessage>}
        {(() => {
          const selected = categories.find((c) => c.id === watch('categoryId'))
          if (!selected) return null
          return (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-indigo-50/80 p-3 text-sm text-indigo-900 ring-1 ring-indigo-100">
              <BuildingOffice2Icon className="size-5 shrink-0" />
              {selected.area
                ? selected.area.type === 'externa'
                  ? <span>Este tipo de problema suele corresponder a <b>{selected.area.name}</b>. Atención Ciudadana revisará si se canaliza.</span>
                  : <span>Tu reporte llegará directamente a <b>{selected.area.name}</b>.</span>
                : <span>Atención Ciudadana revisará tu reporte y lo turnará al área correspondiente.</span>}
            </p>
          )
        })()}

        <h3 className="mb-2 mt-5 text-sm font-bold text-slate-700">Gravedad</h3>
        <Controller
          name="severity"
          control={control}
          render={({ field }) => (
            <RadioGroup value={field.value} onChange={field.onChange} className="grid grid-cols-4 gap-2">
              {SEVERITY_OPTIONS.map((s) => (
                <Radio
                  key={s.value}
                  value={s.value}
                  className={`cursor-pointer rounded-lg py-2 text-center text-sm font-bold ring-1 ring-slate-200 data-[checked]:ring-2 data-[checked]:ring-indigo-500 ${SEVERITY[s.value].className}`}
                >
                  {s.label}
                </Radio>
              ))}
            </RadioGroup>
          )}
        />
      </section>

      <section className="card space-y-4">
        <h2 className="card-title">4. Descripción</h2>
        <div>
          <label className="label" htmlFor="title">Título</label>
          <input id="title" className="input" enterKeyHint="next" autoComplete="off" placeholder="Ej. Fuga de agua frente a la primaria"
            {...register('title', { required: 'El título es obligatorio', minLength: { value: 3, message: 'Mínimo 3 caracteres' }, maxLength: { value: 120, message: 'Máximo 120 caracteres' } })} />
          {errors.title && <ErrorMessage>{errors.title.message}</ErrorMessage>}
        </div>
        <div>
          <label className="label" htmlFor="description">Descripción</label>
          <textarea id="description" rows={4} className="input" placeholder="¿Desde cuándo? ¿Qué tan grave es? ¿Afecta a muchas personas?"
            {...register('description', { required: 'La descripción es obligatoria', minLength: { value: 10, message: 'Mínimo 10 caracteres' }, maxLength: { value: 2000, message: 'Máximo 2000 caracteres' } })} />
          {errors.description && <ErrorMessage>{errors.description.message}</ErrorMessage>}
        </div>

        <Controller
          name="anonymous"
          control={control}
          render={({ field }) => (
            <Field className="flex items-start justify-between gap-4 rounded-xl bg-white/50 p-4">
              <div>
                <Label className="flex items-center gap-1.5 font-bold text-slate-800">
                  <EyeSlashIcon className="size-5" /> Publicar como anónimo
                </Label>
                <Description className="mt-0.5 text-sm text-slate-500">
                  Los demás ciudadanos no verán tu nombre. Solo moderadores y el administrador pueden verlo.
                </Description>
              </div>
              <Switch
                checked={field.value}
                onChange={field.onChange}
                className="group relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full bg-slate-300 transition data-[checked]:bg-indigo-600"
              >
                <span className="pointer-events-none mt-1 ml-1 inline-block size-5 rounded-full bg-white shadow transition group-data-[checked]:translate-x-5" />
              </Switch>
            </Field>
          )}
        />
      </section>

      {/* En el celular el botón queda fijo sobre la barra inferior para no tener que bajar todo el formulario */}
      <div className="sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-20 md:static">
        <button type="submit" disabled={isPending} className="btn-primary w-full py-4 text-lg shadow-xl shadow-indigo-600/30">
          {isPending ? (
            <><span className="size-5 animate-spin rounded-full border-2 border-white border-t-transparent" /> Subiendo reporte…</>
          ) : 'Publicar reporte'}
        </button>
      </div>
    </form>
  )
}
