import 'server-only'
import { cookies, headers } from 'next/headers'
import { NOME_DO_COOKIE_ESTADO, VALIDADE_SEGUNDOS, assinarEstado, lerEstado } from './cookie-estado'
import type { EstadoAssinatura } from './regras'
import { estadoDoUsuario, type UsuarioDoApp } from './servico'
import { getStripe } from './stripe'

export type EstadoNoServidor =
  | { pagamentoAtivo: false }
  | { pagamentoAtivo: true; estado: EstadoAssinatura; origem: 'cache' | 'stripe' }

/**
 * O estado da assinatura do usuário, no servidor. Usa o cookie assinado de 5 minutos quando ele vale (e `forcar` é falso);
 * senão pergunta ao Stripe e renova o cookie. Sem a chave do Stripe, o pagamento está desligado neste ambiente
 * (`pagamentoAtivo: false`): o app todo fica liberado. Se o Stripe falhar, LANÇA: quem chama decide o que fazer.
 *
 * Só para rotas (route handlers): grava cookie.
 */
export async function estadoNoServidor(usuario: UsuarioDoApp, { forcar }: { forcar: boolean }): Promise<EstadoNoServidor> {
  const segredo = process.env.SESSION_SECRET
  const lojaDeCookies = await cookies()

  if (!forcar) {
    const guardado = await lerEstado(lojaDeCookies.get(NOME_DO_COOKIE_ESTADO)?.value, usuario.id, segredo)
    if (guardado) return { pagamentoAtivo: true, estado: guardado, origem: 'cache' }
  }

  const stripe = getStripe()
  if (!stripe) return { pagamentoAtivo: false }

  const estado = await estadoDoUsuario(stripe, usuario)
  const proto = (await headers()).get('x-forwarded-proto')?.split(',')[0].trim()
  lojaDeCookies.set(NOME_DO_COOKIE_ESTADO, await assinarEstado(estado, usuario.id, segredo), {
    httpOnly: true,
    secure: proto === 'https',
    sameSite: 'lax',
    path: '/',
    maxAge: VALIDADE_SEGUNDOS,
  })
  return { pagamentoAtivo: true, estado, origem: 'stripe' }
}
