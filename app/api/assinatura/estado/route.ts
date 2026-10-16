import { cookies, headers } from 'next/headers'
import { NOME_DO_COOKIE_ESTADO, VALIDADE_SEGUNDOS, assinarEstado, lerEstado } from '@/lib/assinatura/cookie-estado'
import { pagamentoIndisponivel, prepararRota, responder, tratarErro } from '@/lib/assinatura/rota'
import { estadoDoUsuario } from '@/lib/assinatura/servico'
import { getStripe } from '@/lib/assinatura/stripe'

/**
 * Estado da assinatura do usuário logado. Usa o cookie de 5 minutos quando ele vale; com `?atualizar=1`
 * (ou sem cookie válido) pergunta ao Stripe e renova o cookie.
 */
export async function GET(request: Request) {
  const preparo = await prepararRota(request, { mutavel: false })
  if (!preparo.ok) return preparo.resposta

  const segredo = process.env.SESSION_SECRET
  const lojaDeCookies = await cookies()
  const forcar = new URL(request.url).searchParams.get('atualizar') === '1'

  if (!forcar) {
    const guardado = await lerEstado(lojaDeCookies.get(NOME_DO_COOKIE_ESTADO)?.value, preparo.usuario.id, segredo)
    if (guardado) return responder({ estado: guardado, origem: 'cache' })
  }

  const stripe = getStripe()
  if (!stripe) return pagamentoIndisponivel()

  try {
    const estado = await estadoDoUsuario(stripe, preparo.usuario)
    const proto = (await headers()).get('x-forwarded-proto')?.split(',')[0].trim()
    lojaDeCookies.set(NOME_DO_COOKIE_ESTADO, await assinarEstado(estado, preparo.usuario.id, segredo), {
      httpOnly: true,
      secure: proto === 'https',
      sameSite: 'lax',
      path: '/',
      maxAge: VALIDADE_SEGUNDOS,
    })
    return responder({ estado, origem: 'stripe' })
  } catch (e) {
    return tratarErro(e)
  }
}
