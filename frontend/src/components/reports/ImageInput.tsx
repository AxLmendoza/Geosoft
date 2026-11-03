import { useEffect, useMemo, useRef, useState } from 'react'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { CameraIcon, PhotoIcon, VideoCameraIcon, XMarkIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline'
import { useIsMobile } from '@/hooks/useIsMobile'
import CameraDialog from './CameraDialog'

const MAX_MB = 8

type Props = { value: File | null; onChange: (file: File | null) => void; error?: string }

/**
 * - Celular / tablet: botón de cámara (abre la cámara nativa) y botón de galería.
 * - PC / laptop: dropzone (arrastrar y soltar) + opción de usar la cámara web.
 */
export default function ImageInput({ value, onChange, error }: Props) {
  const isMobile = useIsMobile()
  const cameraInput = useRef<HTMLInputElement>(null)
  const galleryInput = useRef<HTMLInputElement>(null)
  const [webcamOpen, setWebcamOpen] = useState(false)
  const [rejection, setRejection] = useState<string | null>(null)

  const preview = useMemo(() => (value ? URL.createObjectURL(value) : null), [value])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  const accept = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return setRejection('El archivo debe ser una imagen')
    if (file.size > MAX_MB * 1024 * 1024) return setRejection(`La imagen supera ${MAX_MB} MB`)
    setRejection(null)
    onChange(file)
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'] },
    maxFiles: 1,
    maxSize: MAX_MB * 1024 * 1024,
    multiple: false,
    onDropAccepted: (files) => accept(files[0]),
    onDropRejected: (rejections: FileRejection[]) =>
      setRejection(rejections[0]?.errors[0]?.code === 'file-too-large' ? `La imagen supera ${MAX_MB} MB` : 'Solo se permiten imágenes'),
  })

  if (value && preview) {
    return (
      <div className="relative overflow-hidden rounded-xl ring-1 ring-slate-300">
        <img src={preview} alt="Vista previa" className="max-h-80 w-full bg-slate-100 object-contain" />
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute right-2 top-2 rounded-full bg-slate-900/70 p-1.5 text-white hover:bg-slate-900"
          aria-label="Quitar imagen"
        >
          <XMarkIcon className="size-5" />
        </button>
      </div>
    )
  }

  const message = rejection ?? error

  if (isMobile) {
    return (
      <div>
        {/* capture="environment" abre directamente la cámara trasera del teléfono */}
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => accept(e.target.files?.[0])} />
        <input ref={galleryInput} type="file" accept="image/*" hidden onChange={(e) => accept(e.target.files?.[0])} />
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => cameraInput.current?.click()}
            className="flex flex-col items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-8 font-bold text-white shadow-lg active:scale-95"
          >
            <CameraIcon className="size-12" />
            Tomar foto
          </button>
          <button
            type="button"
            onClick={() => galleryInput.current?.click()}
            className="flex flex-col items-center gap-2 rounded-2xl bg-white px-4 py-8 font-bold text-indigo-700 ring-2 ring-indigo-200 active:scale-95"
          >
            <PhotoIcon className="size-12" />
            Galería
          </button>
        </div>
        {message && <p className="mt-2 text-sm font-medium text-red-600">{message}</p>}
      </div>
    )
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
          isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 bg-white/40 hover:border-indigo-400 hover:bg-indigo-50/50'
        }`}
      >
        <input {...getInputProps()} />
        <CloudArrowUpIcon className="size-12 text-indigo-500" />
        <p className="font-bold text-slate-700">{isDragActive ? 'Suelta la imagen aquí' : 'Arrastra la foto del siniestro'}</p>
        <p className="text-sm text-slate-500">o haz clic para buscarla · JPG, PNG, WEBP · máx. {MAX_MB} MB</p>
      </div>
      <button
        type="button"
        onClick={() => setWebcamOpen(true)}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50"
      >
        <VideoCameraIcon className="size-5" /> Usar cámara web
      </button>
      {message && <p className="mt-2 text-sm font-medium text-red-600">{message}</p>}
      <CameraDialog open={webcamOpen} onClose={() => setWebcamOpen(false)} onCapture={accept} />
    </div>
  )
}
