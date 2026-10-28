import { responder } from '@/lib/assinatura/rota'
import { prepararRotaDoAluno } from '@/lib/cornerman/aluno-rota'
import { respostaDeErroDoCornerman } from '@/lib/cornerman/http'
import { criarSugestoesBancoSupabase } from '@/lib/cornerman/sugestao-banco'
import { responderSugestao } from '@/lib/cornerman/sugestao-servico'

/**
 * O aluno recusa a sugestão de plano do treinador (qualquer plano de assinatura). `{ ok: true }`.
 * Mesmas regras de `aceitar`: só sugestão pendente do vínculo ativo dele; o resto responde igual (404 `nao_encontrado`).
 */
export async function POST(request: Request, ctx: RouteContext<'/api/sugestao-do-treinador/[id]/recusar'>) {
  const preparo = await prepararRotaDoAluno(request, { mutavel: true })
  if (!preparo.ok) return preparo.resposta

  const { id } = await ctx.params
  try {
    await responderSugestao(criarSugestoesBancoSupabase(preparo.db), preparo.usuario.id, id, false)
    return responder({ ok: true })
  } catch (e) {
    const { status, corpo } = respostaDeErroDoCornerman(e)
    return responder(corpo, status)
  }
}
