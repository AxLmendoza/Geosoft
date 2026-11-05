import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { Role } from '@/types'
import { Skeleton } from '@/components/ui/States'

export default function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="space-y-4" role="status" aria-label="Verificando sesión">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }
  if (!user) return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return <Outlet />
}
