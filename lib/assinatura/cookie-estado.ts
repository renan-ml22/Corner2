// Guarda por poucos minutos, num cookie assinado, o estado da assinatura que o Stripe informou,
// para não perguntar ao Stripe a cada tela. Só o servidor consegue gerar um cookie válido.
// O cookie é um "cache": quem manda é sempre o Stripe, e ele expira rápido.

import { SignJWT, jwtVerify } from 'jose'
import { NIVEIS } from './catalogo'
import type { EstadoAssinatura, Situacao } from './regras'

export const NOME_DO_COOKIE_ESTADO = 'corner_assinatura'
export const VALIDADE_SEGUNDOS = 300

const PUBLICO = 'corner-assinatura'
const SITUACOES: Situacao[] = ['nenhuma', 'teste', 'ativa', 'atrasada', 'cancelada']

/** Chave própria derivada do segredo da sessão: um token de login não vale como cookie de assinatura. */
const chave = (segredo: string) => new TextEncoder().encode(`${segredo}|assinatura`)

function formatoValido(e: unknown): e is EstadoAssinatura {
  if (typeof e !== 'object' || e === null) return false
  const x = e as Record<string, unknown>
  return (
    SITUACOES.includes(x.situacao as Situacao) &&
    (x.nivel === null || NIVEIS.includes(x.nivel as never)) &&
    (x.periodo === null || x.periodo === 'mensal' || x.periodo === 'anual') &&
    (x.fimDoPeriodo === null || typeof x.fimDoPeriodo === 'string') &&
    (x.fimDoTeste === null || typeof x.fimDoTeste === 'string') &&
    typeof x.cancelaNoFim === 'boolean'
  )
}

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
    if (payload.u !== userId || !formatoValido(payload.e)) return null
    return payload.e
  } catch {
    return null
  }
}
