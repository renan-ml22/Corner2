import { lerPedidoDeCheckout } from '@/lib/assinatura/http'
import { erro, pagamentoIndisponivel, prepararRota, responder, tratarErro } from '@/lib/assinatura/rota'
import { criarCheckout } from '@/lib/assinatura/servico'
import { getStripe } from '@/lib/assinatura/stripe'

/** Cria a página de pagamento do Stripe para o plano e o período escolhidos e devolve o endereço dela. */
export async function POST(request: Request) {
  const preparo = await prepararRota(request, { mutavel: true })
  if (!preparo.ok) return preparo.resposta

  let corpo: unknown
  try { corpo = await request.json() } catch { return erro('pedido_invalido', 'Pedido inválido.', 400) }
  const pedido = lerPedidoDeCheckout(corpo)
  if (!pedido) return erro('pedido_invalido', 'Escolha um plano e um período válidos.', 400)

  const stripe = getStripe()
  if (!stripe) return pagamentoIndisponivel()

  try {
    return responder(await criarCheckout(stripe, { usuario: preparo.usuario, ...pedido, origem: preparo.origem }))
  } catch (e) {
    return tratarErro(e)
  }
}
