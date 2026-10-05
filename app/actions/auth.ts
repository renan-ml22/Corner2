'use server'

import { redirect } from 'next/navigation'
import { createSession, deleteSession } from '@/lib/session'
import { verifyCredentials } from '@/lib/users'

export type LoginState = { error: string; email: string; at: number } | undefined

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const fail = (error: string) => ({ error, email, at: Date.now() })

  if (!EMAIL_RE.test(email)) return fail('Digite um e-mail válido.')
  if (!password) return fail('Digite sua senha.')

  const user = await verifyCredentials(email, password)
  if (!user) return fail('E-mail ou senha incorretos.')

  await createSession(user.id)
  redirect('/hoje')
}

export async function logout() {
  await deleteSession()
  redirect('/login')
}
