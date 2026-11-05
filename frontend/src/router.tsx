import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AppLayout from '@/layouts/AppLayout'
import AuthLayout from '@/layouts/AuthLayout'
import ProtectedRoute from '@/layouts/ProtectedRoute'
import { Skeleton } from '@/components/ui/States'

/**
 * Carga diferida por ruta: mapbox-gl (~1.5 MB) y recharts solo se descargan
 * en las pantallas que los usan, así el login, "Mis reportes" y la bandeja abren antes.
 */
const MapView = lazy(() => import('@/views/MapView'))
const NewReportView = lazy(() => import('@/views/NewReportView'))
const MyReportsView = lazy(() => import('@/views/MyReportsView'))
const ReportDetailView = lazy(() => import('@/views/ReportDetailView'))
const NotFoundView = lazy(() => import('@/views/NotFoundView'))
const AttentionView = lazy(() => import('@/views/AttentionView'))
const ModerationView = lazy(() => import('@/views/moderation/ModerationView'))
const AdminStatsView = lazy(() => import('@/views/admin/AdminStatsView'))
const AdminReportsView = lazy(() => import('@/views/admin/AdminReportsView'))
const AdminAreasView = lazy(() => import('@/views/admin/AdminAreasView'))
const AdminHomeView = lazy(() => import('@/views/admin/AdminHomeView'))
const UsersView = lazy(() => import('@/views/UsersView'))
const LoginView = lazy(() => import('@/views/auth/LoginView'))
const RegisterView = lazy(() => import('@/views/auth/RegisterView'))
const ConfirmAccountView = lazy(() => import('@/views/auth/ConfirmAccountView'))
const RequestCodeView = lazy(() => import('@/views/auth/RequestCodeView'))
const ForgotPasswordView = lazy(() => import('@/views/auth/ForgotPasswordView'))
const NewPasswordView = lazy(() => import('@/views/auth/NewPasswordView'))

function PageFallback() {
  return (
    <div className="space-y-4" role="status" aria-label="Cargando">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

const page = (node: ReactNode) => <Suspense fallback={<PageFallback />}>{node}</Suspense>

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Suspense fallback={<div className="h-full w-full animate-pulse bg-indigo-100/50" />}><MapView /></Suspense>} />
          <Route path="/reports/:reportId" element={page(<ReportDetailView />)} />

          <Route element={<ProtectedRoute />}>
            <Route path="/reports/new" element={page(<NewReportView />)} />
            <Route path="/reports/mine" element={page(<MyReportsView />)} />
          </Route>

          <Route element={<ProtectedRoute roles={['operativo', 'moderador', 'admin']} />}>
            <Route path="/attention" element={page(<AttentionView />)} />
          </Route>

          <Route element={<ProtectedRoute roles={['moderador', 'admin']} />}>
            <Route path="/moderation" element={page(<ModerationView />)} />
            <Route path="/users" element={page(<UsersView />)} />
          </Route>

          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="/admin" element={page(<AdminHomeView />)} />
            <Route path="/admin/stats" element={page(<AdminStatsView />)} />
            <Route path="/admin/reports" element={page(<AdminReportsView />)} />
            <Route path="/admin/areas" element={page(<AdminAreasView />)} />
          </Route>

          <Route path="*" element={page(<NotFoundView />)} />
        </Route>

        <Route path="/auth" element={<AuthLayout />}>
          <Route path="login" element={page(<LoginView />)} />
          <Route path="register" element={page(<RegisterView />)} />
          <Route path="confirm-account" element={page(<ConfirmAccountView />)} />
          <Route path="request-code" element={page(<RequestCodeView />)} />
          <Route path="forgot-password" element={page(<ForgotPasswordView />)} />
          <Route path="new-password" element={page(<NewPasswordView />)} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
