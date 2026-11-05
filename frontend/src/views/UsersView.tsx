import { useAuth } from '@/hooks/useAuth'
import UsersPanel from '@/components/moderation/UsersPanel'

/** Gestión de usuarios (moderación y administración; el backend limita qué puede hacer cada rol) */
export default function UsersView() {
  const { isAdmin } = useAuth()
  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Usuarios</h1>
        <p className="page-subtitle">
          {isAdmin ? 'Asigna roles (personal operativo con su área, moderadores) y suspende cuentas.' : 'Consulta usuarios y suspende cuentas que incumplan las reglas.'}
        </p>
      </header>
      <UsersPanel />
    </div>
  )
}
