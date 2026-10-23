import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { decrypt, SESSION_COOKIE } from './session'
import { usuarioDaSessao } from './users'

// Verificação definitiva da sessão, perto dos dados. O proxy faz só a checagem otimista.
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const session = await decrypt(token)
  const user = usuarioDaSessao(session)
  if (!user) redirect('/login')
  return user
})
