'use server'

import { redirect } from 'next/navigation'
import { ErroConta } from '@/lib/contas'
import { emailValido } from '@/lib/onboarding'
import { createSession, deleteSession } from '@/lib/session'
import { verifyCredentials } from '@/lib/users'

export type LoginState = { error: string; email: string; at: number } | undefined

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const fail = (error: string) => ({ error, email, at: Date.now() })

  if (!emailValido(email)) return fail('Digite um e-mail válido.')
  if (!password) return fail('Digite sua senha.')

  let user
  try {
    user = await verifyCredentials(email, password)
  } catch (e) {
    // Serviço de contas fora do ar: não é "senha incorreta".
    if (e instanceof ErroConta) return fail(e.message)
    throw e
  }
  if (!user) return fail('E-mail ou senha incorretos.')

  await createSession(user.id, { email: user.email, name: user.name })
  redirect('/hoje')
}

export async function logout() {
  await deleteSession()
  redirect('/login')
}
