import { Link } from 'react-router-dom'

export default function NotFoundView() {
  return (
    <div className="py-24 text-center">
      <p className="text-6xl font-extrabold text-indigo-600">404</p>
      <p className="mt-2 text-slate-600">Página no encontrada</p>
      <Link to="/" className="btn-primary mt-6 inline-block">Ir al mapa</Link>
    </div>
  )
}
