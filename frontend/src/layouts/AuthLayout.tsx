import { Link, Outlet } from 'react-router-dom'
import Logo from '@/components/ui/Logo'

export default function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gs-aurora px-4 py-10">
      <Link to="/" className="mb-6">
        <Logo />
      </Link>
      <div className="w-full max-w-md glass-strong rounded-3xl p-6 sm:p-8">
        <Outlet />
      </div>
    </div>
  )
}
