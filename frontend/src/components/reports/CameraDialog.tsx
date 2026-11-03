import { useEffect, useRef, useState } from 'react'
import { ArrowPathIcon, CameraIcon } from '@heroicons/react/24/solid'
import Modal from '@/components/ui/Modal'

type Props = { open: boolean; onClose: () => void; onCapture: (file: File) => void }

/**
 * Cámara web con getUserMedia (PC / laptop).
 * Requiere HTTPS o localhost para que el navegador dé permiso.
 */
export default function CameraDialog({ open, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setError(null)
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((stream) => {
        if (cancelled) return stream.getTracks().forEach((t) => t.stop())
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch(() => setError('No se pudo acceder a la cámara. Revisa los permisos del navegador.'))
    if (!navigator.mediaDevices) setError('Tu navegador no permite usar la cámara (se necesita HTTPS).')
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [open, facing])

  const capture = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        onCapture(new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' }))
        onClose()
      },
      'image/jpeg',
      0.9,
    )
  }

  return (
    <Modal open={open} onClose={onClose} title="Tomar foto" size="lg">
      {error ? (
        <p className="rounded-lg bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>
      ) : (
        <video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full rounded-xl bg-black object-cover" />
      )}
      <div className="mt-4 flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
          className="rounded-full p-3 text-slate-600 ring-1 ring-slate-300 hover:bg-slate-100"
          aria-label="Cambiar cámara"
        >
          <ArrowPathIcon className="size-6" />
        </button>
        <button
          type="button"
          onClick={capture}
          disabled={!!error}
          className="flex size-16 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg ring-4 ring-indigo-200 hover:bg-indigo-700 disabled:opacity-40"
          aria-label="Capturar"
        >
          <CameraIcon className="size-8" />
        </button>
        <span className="w-12" />
      </div>
    </Modal>
  )
}
