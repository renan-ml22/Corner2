// Guarda por poucos minutos, num cookie assinado, o estado da assinatura que o Stripe informou,
// para não perguntar ao Stripe a cada tela. Só o servidor consegue gerar um cookie válido.
// O cookie é um "cache": quem manda é sempre o Stripe, e ele expira rápido.

import { SignJWT, jwtVerify } from 'jose'
import { isEstadoAssinatura, type EstadoAssinatura } from './regras'

export const NOME_DO_COOKIE_ESTADO = 'corner_assinatura'
export const VALIDADE_SEGUNDOS = 300

const PUBLICO = 'corner-assinatura'
/** Chave própria derivada do segredo da sessão: um token de login não vale como cookie de assinatura. */
const chave = (segredo: string) => new TextEncoder().encode(`${segredo}|assinatura`)

export async function assinarEstado(estado: EstadoAssinatura, userId: string, segredo: string | undefined): Promise<string> {
  if (!segredo) throw new Error('SESSION_SECRET não definido')
  return new SignJWT({ u: userId, e: estado })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(PUBLICO)
    .setIssuedAt()
    .setExpirationTime(`${VALIDADE_SEGUNDOS}s`)
    .sign(chave(segredo))
}

/** O estado guardado, ou `null` se o cookie falta, expirou, é de outro usuário ou foi alterado. */
export async function lerEstado(token: string | undefined, userId: string, segredo: string | undefined): Promise<EstadoAssinatura | null> {
  if (!token || !segredo) return null
  try {
    const { payload } = await jwtVerify(token, chave(segredo), { algorithms: ['HS256'], audience: PUBLICO })
    if (payload.u !== userId || !isEstadoAssinatura(payload.e)) return null
    return payload.e
  } catch {
    return null
  }
}
