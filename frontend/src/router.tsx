import { BrowserRouter, Route, Routes } from 'react-router-dom'
import AppLayout from '@/layouts/AppLayout'
import AuthLayout from '@/layouts/AuthLayout'
import ProtectedRoute from '@/layouts/ProtectedRoute'
import MapView from '@/views/MapView'
import NewReportView from '@/views/NewReportView'
import MyReportsView from '@/views/MyReportsView'
import ReportDetailView from '@/views/ReportDetailView'
import NotFoundView from '@/views/NotFoundView'
import ModerationView from '@/views/moderation/ModerationView'
import AdminStatsView from '@/views/admin/AdminStatsView'
import AdminReportsView from '@/views/admin/AdminReportsView'
import LoginView from '@/views/auth/LoginView'
import RegisterView from '@/views/auth/RegisterView'
import ConfirmAccountView from '@/views/auth/ConfirmAccountView'
import RequestCodeView from '@/views/auth/RequestCodeView'
import ForgotPasswordView from '@/views/auth/ForgotPasswordView'
import NewPasswordView from '@/views/auth/NewPasswordView'

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<MapView />} />
          <Route path="/reports/:reportId" element={<ReportDetailView />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/reports/new" element={<NewReportView />} />
            <Route path="/reports/mine" element={<MyReportsView />} />
          </Route>

          <Route element={<ProtectedRoute roles={['moderador', 'admin']} />}>
            <Route path="/moderation" element={<ModerationView />} />
          </Route>

          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="/admin/stats" element={<AdminStatsView />} />
            <Route path="/admin/reports" element={<AdminReportsView />} />
          </Route>

          <Route path="*" element={<NotFoundView />} />
        </Route>

        <Route path="/auth" element={<AuthLayout />}>
          <Route path="login" element={<LoginView />} />
          <Route path="register" element={<RegisterView />} />
          <Route path="confirm-account" element={<ConfirmAccountView />} />
          <Route path="request-code" element={<RequestCodeView />} />
          <Route path="forgot-password" element={<ForgotPasswordView />} />
          <Route path="new-password" element={<NewPasswordView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
