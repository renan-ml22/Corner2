import { pagamentoIndisponivel, prepararRota, responder, tratarErro } from '@/lib/assinatura/rota'
import { criarPortal } from '@/lib/assinatura/servico'
import { getStripe } from '@/lib/assinatura/stripe'

/** Abre o Portal do Cliente do Stripe (trocar de plano, atualizar cartão, ver faturas, cancelar). */
export async function POST(request: Request) {
  const preparo = await prepararRota(request, { mutavel: true })
  if (!preparo.ok) return preparo.resposta

  const stripe = getStripe()
  if (!stripe) return pagamentoIndisponivel()

  try {
    return responder(await criarPortal(stripe, { usuario: preparo.usuario, origem: preparo.origem }))
  } catch (e) {
    return tratarErro(e)
  }
}
