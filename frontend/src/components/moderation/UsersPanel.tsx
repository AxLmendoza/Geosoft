import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-toastify'
import { MagnifyingGlassIcon, NoSymbolIcon, ShieldCheckIcon, ShieldExclamationIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline'
import { getUsers, setUserRole, unbanUser } from '@/api/ModerationAPI'
import { useAuth } from '@/hooks/useAuth'
import { ROLE } from '@/lib/labels'
import { formatShortDate } from '@/lib/date'
import SelectBox from '@/components/ui/SelectBox'
import BanDialog from './BanDialog'
import type { Role, User } from '@/types'

export default function UsersPanel() {
  const queryClient = useQueryClient()
  const { user: me, isAdmin } = useAuth()
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [role, setRole] = useState<Role | ''>('')
  const [banned, setBanned] = useState<'' | 'true' | 'false'>('')
  const [banTarget, setBanTarget] = useState<User | null>(null)

  // Espera a que el usuario deje de escribir
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 350)
    return () => clearTimeout(t)
  }, [search])

  const params = { q: q || undefined, role, banned }
  const { data: users = [], isLoading } = useQuery({ queryKey: ['users', params], queryFn: () => getUsers(params) })

  const onDone = (msg: string) => {
    toast.success(msg)
    queryClient.invalidateQueries()
  }
  const unban = useMutation({ mutationFn: unbanUser, onError: (e) => toast.error(e.message), onSuccess: onDone })
  const changeRole = useMutation({ mutationFn: setUserRole, onError: (e) => toast.error(e.message), onSuccess: onDone })

  /** Moderador solo sanciona ciudadanos; admin a todos menos admins */
  const canSanction = (u: User) => u.id !== me?.id && u.role !== 'admin' && (isAdmin || u.role === 'ciudadano')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative w-full sm:w-72">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o correo" className="input pl-10" />
        </div>
        <SelectBox value={role} onChange={setRole} className="w-44" options={[
          { value: '' as const, label: 'Todos los roles' },
          { value: 'ciudadano' as const, label: 'Ciudadanos' },
          { value: 'moderador' as const, label: 'Moderadores' },
          { value: 'admin' as const, label: 'Administradores' },
        ]} />
        <SelectBox value={banned} onChange={setBanned} className="w-40" options={[
          { value: '' as const, label: 'Todos' },
          { value: 'false' as const, label: 'Activos' },
          { value: 'true' as const, label: 'Baneados' },
        ]} />
      </div>

      {isLoading && <p className="text-slate-500">Cargando…</p>}

      <div className="overflow-x-auto rounded-2xl glass">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-white/40 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Reportes</th>
              <th className="px-4 py-3">Alta</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className={u.banned ? 'bg-red-50/50' : ''}>
                <td className="px-4 py-3">
                  <p className="font-bold text-slate-900">{u.name}</p>
                  <p className="text-xs text-slate-500">{u.email}</p>
                  {!u.confirmed && <span className="text-xs font-semibold text-amber-600">Sin confirmar</span>}
                  {u.banned && <p className="text-xs font-semibold text-red-600">Baneado: {u.bannedReason}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">{ROLE[u.role]}</span>
                </td>
                <td className="px-4 py-3">{u.reportsCount ?? 0}</td>
                <td className="px-4 py-3 text-slate-500">{formatShortDate(u.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    {isAdmin && u.role !== 'admin' && !u.banned && u.confirmed && (
                      u.role === 'moderador' ? (
                        <button onClick={() => changeRole.mutate({ id: u.id, role: 'ciudadano' })} className="btn-sm ring-1 ring-slate-300 hover:bg-slate-50">
                          <ShieldExclamationIcon className="size-4" /> Quitar moderador
                        </button>
                      ) : (
                        <button onClick={() => changeRole.mutate({ id: u.id, role: 'moderador' })} className="btn-sm text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50">
                          <ShieldCheckIcon className="size-4" /> Hacer moderador
                        </button>
                      )
                    )}
                    {canSanction(u) && (u.banned ? (
                      <button onClick={() => unban.mutate(u.id)} className="btn-sm text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50">
                        <ArrowUturnLeftIcon className="size-4" /> Desbanear
                      </button>
                    ) : (
                      <button onClick={() => setBanTarget(u)} className="btn-sm bg-red-600 text-white hover:bg-red-700">
                        <NoSymbolIcon className="size-4" /> Banear
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && users.length === 0 && <p className="p-8 text-center text-slate-500">Sin resultados</p>}
      </div>
      <BanDialog user={banTarget} onClose={() => setBanTarget(null)} />
    </div>
  )
}
