import { lerPedidoDeCheckout } from '@/lib/assinatura/http'
import { erro, pagamentoIndisponivel, prepararRota, responder, tratarErro } from '@/lib/assinatura/rota'
import { criarPortal } from '@/lib/assinatura/servico'
import { getStripe } from '@/lib/assinatura/stripe'

/**
 * Abre o Portal do Cliente do Stripe (atualizar cartão, ver faturas, cancelar). Sem corpo: portal comum.
 * Com `{ nivel, periodo }`: abre direto na confirmação da troca para esse plano.
 */
export async function POST(request: Request) {
  const preparo = await prepararRota(request, { mutavel: true })
  if (!preparo.ok) return preparo.resposta

  let trocarPara: ReturnType<typeof lerPedidoDeCheckout> = null
  const texto = await request.text()
  if (texto.trim()) {
    try { trocarPara = lerPedidoDeCheckout(JSON.parse(texto)) } catch { /* cai no 400 abaixo */ }
    if (!trocarPara) return erro('pedido_invalido', 'Escolha um plano e um período válidos.', 400)
  }

  const stripe = getStripe()
  if (!stripe) return pagamentoIndisponivel()

  try {
    return responder(await criarPortal(stripe, { usuario: preparo.usuario, origem: preparo.origem, ...(trocarPara ? { trocarPara } : {}) }))
  } catch (e) {
    return tratarErro(e)
  }
}
