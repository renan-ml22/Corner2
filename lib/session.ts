import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies, headers } from 'next/headers'

export const SESSION_COOKIE = 'corner_session'
const SESSION_DAYS = 7

export interface SessionPayload {
  userId: string
  expiresAt: string
  [key: string]: unknown
}

function getKey() {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET não definido (veja .env.local)')
  return new TextEncoder().encode(secret)
}

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getKey())
}

export async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify<SessionPayload>(token, getKey(), { algorithms: ['HS256'] })
    return payload
  } catch {
    return null
  }
}

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  const token = await encrypt({ userId, expiresAt: expiresAt.toISOString() })
  const cookieStore = await cookies()
  // `Secure` só quando a requisição chegou por HTTPS: em http:// (ex.: celular na rede local)
  // o navegador descartaria o cookie e o login nunca "pegaria".
  const proto = (await headers()).get('x-forwarded-proto')?.split(',')[0].trim()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: proto === 'https',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  })
}

export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}
