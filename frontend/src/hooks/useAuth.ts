import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getUser } from '@/api/AuthAPI'
import { TOKEN_KEY } from '@/lib/axios'

export function useAuth() {
  const hasToken = !!localStorage.getItem(TOKEN_KEY)
  const { data, isLoading, isError } = useQuery({
    queryKey: ['user'],
    queryFn: getUser,
    enabled: hasToken,
    retry: false,
    refetchOnWindowFocus: false,
  })
  const user = isError ? undefined : data
  return {
    user,
    isLoading: hasToken && isLoading,
    isStaff: user?.role === 'moderador' || user?.role === 'admin',
    isAdmin: user?.role === 'admin',
    isOperativo: user?.role === 'operativo',
    /** Puede entrar a la bandeja de atención (el backend limita el alcance por área) */
    canAttend: user?.role === 'admin' || user?.role === 'moderador' || user?.role === 'operativo',
  }
}

export function useLogout() {
  const queryClient = useQueryClient()
  return () => {
    localStorage.removeItem(TOKEN_KEY)
    queryClient.removeQueries({ queryKey: ['user'] })
    queryClient.invalidateQueries()
  }
}
