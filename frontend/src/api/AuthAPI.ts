import api from '@/lib/axios'
import { rethrow } from '@/lib/errors'
import type { LoginForm, NewPasswordForm, RegisterForm, User } from '@/types'

type Msg = { message: string }

export async function createAccount(form: RegisterForm) {
  try {
    return (await api.post<Msg>('/auth/create-account', form)).data.message
  } catch (e) { rethrow(e) }
}

/** El código siempre se valida junto con el correo al que se envió */
export async function confirmAccount({ email, token }: { email: string; token: string }) {
  try {
    return (await api.post<Msg>('/auth/confirm-account', { email, token })).data.message
  } catch (e) { rethrow(e) }
}

export async function requestConfirmationCode(email: string) {
  try {
    return (await api.post<Msg>('/auth/request-code', { email })).data.message
  } catch (e) { rethrow(e) }
}

export async function login(form: LoginForm) {
  try {
    return (await api.post<{ token: string }>('/auth/login', form)).data.token
  } catch (e) { rethrow(e) }
}

export async function forgotPassword(email: string) {
  try {
    return (await api.post<Msg>('/auth/forgot-password', { email })).data.message
  } catch (e) { rethrow(e) }
}

export async function validateToken({ email, token }: { email: string; token: string }) {
  try {
    return (await api.post<Msg>('/auth/validate-token', { email, token })).data.message
  } catch (e) { rethrow(e) }
}

export async function resetPassword({ email, token, form }: { email: string; token: string; form: NewPasswordForm }) {
  try {
    return (await api.post<Msg>(`/auth/reset-password/${token}`, { ...form, email })).data.message
  } catch (e) { rethrow(e) }
}

export async function getUser() {
  return (await api.get<User>('/auth/user')).data
}
