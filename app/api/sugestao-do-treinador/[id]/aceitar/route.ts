import { responder } from '@/lib/assinatura/rota'
import { prepararRotaDoAluno } from '@/lib/cornerman/aluno-rota'
import { respostaDeErroDoCornerman } from '@/lib/cornerman/http'
import { criarSugestoesBancoSupabase } from '@/lib/cornerman/sugestao-banco'
import { responderSugestao } from '@/lib/cornerman/sugestao-servico'

/**
 * O aluno aceita a sugestão de plano do treinador (qualquer plano de assinatura). `{ ok: true }`.
 * Só vale para sugestão pendente do vínculo ativo dele; qualquer outra (de outro aluno, que não existe, já respondida,
 * substituída, id malformado) responde igual: 404 `nao_encontrado`. Quem aplica o plano no aparelho é o app, depois deste OK.
 */
export async function POST(request: Request, ctx: RouteContext<'/api/sugestao-do-treinador/[id]/aceitar'>) {
  const preparo = await prepararRotaDoAluno(request, { mutavel: true })
  if (!preparo.ok) return preparo.resposta

  const { id } = await ctx.params
  try {
    await responderSugestao(criarSugestoesBancoSupabase(preparo.db), preparo.usuario.id, id, true)
    return responder({ ok: true })
  } catch (e) {
    const { status, corpo } = respostaDeErroDoCornerman(e)
    return responder(corpo, status)
  }
}
