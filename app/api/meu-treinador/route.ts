import { responder } from '@/lib/assinatura/rota'
import { prepararRotaDoAluno } from '@/lib/cornerman/aluno-rota'
import { criarConvitesBancoSupabase } from '@/lib/cornerman/convite-banco'
import { desvincularDoTreinador, meuTreinador } from '@/lib/cornerman/convite-servico'
import { respostaDeErroDoCornerman } from '@/lib/cornerman/http'

/**
 * "Meu treinador", do aluno logado (qualquer plano).
 *
 * - GET: `{ treinador: { nome } | null }` (primeiro nome).
 * - DELETE: o aluno se desvincula: a ficha do treinador vira "encerrada" e perde a conta, e o treinador perde todo acesso
 *   aos dados dele. Pode ser repetido. `{ ok: true }`.
 */
export async function GET(request: Request) {
  const preparo = await prepararRotaDoAluno(request, { mutavel: false })
  if (!preparo.ok) return preparo.resposta

  try {
    return responder({ treinador: await meuTreinador(criarConvitesBancoSupabase(preparo.db), preparo.usuario.id) })
  } catch (e) {
    const { status, corpo } = respostaDeErroDoCornerman(e)
    return responder(corpo, status)
  }
}

export async function DELETE(request: Request) {
  const preparo = await prepararRotaDoAluno(request, { mutavel: true })
  if (!preparo.ok) return preparo.resposta

  try {
    await desvincularDoTreinador(criarConvitesBancoSupabase(preparo.db), preparo.usuario.id)
    return responder({ ok: true })
  } catch (e) {
    const { status, corpo } = respostaDeErroDoCornerman(e)
    return responder(corpo, status)
  }
}
