import { estadoNoServidor } from '@/lib/assinatura/estado-servidor'
import { prepararRota, responder, tratarErro } from '@/lib/assinatura/rota'

/**
 * Estado da assinatura do usuário logado. Usa o cookie de 5 minutos quando ele vale; com `?atualizar=1`
 * (ou sem cookie válido) pergunta ao Stripe e renova o cookie (veja lib/assinatura/estado-servidor.ts).
 *
 * Sem a chave do Stripe, o pagamento está desligado: responde 200 com `pagamentoAtivo: false` (e o app fica
 * liberado). Não é um erro, e por isso não usa status 4xx/5xx: o navegador registraria um erro no console
 * em toda página.
 */
export async function GET(request: Request) {
  const preparo = await prepararRota(request, { mutavel: false })
  if (!preparo.ok) return preparo.resposta

  const forcar = new URL(request.url).searchParams.get('atualizar') === '1'

  try {
    return responder(await estadoNoServidor(preparo.usuario, { forcar }))
  } catch (e) {
    return tratarErro(e)
  }
}
