import { erro, responder } from '@/lib/assinatura/rota'
import { prepararRotaDoTreinador } from '@/lib/cornerman/acesso'
import { dadosDoAluno } from '@/lib/cornerman/aluno-dados'
import { criarDadosDoAlunoBancoSupabase } from '@/lib/cornerman/aluno-dados-banco'
import { criarAlunosBancoSupabase } from '@/lib/cornerman/banco'
import { ehIdDeFicha } from '@/lib/cornerman/ficha'
import { respostaDeErroDoCornerman } from '@/lib/cornerman/http'
import { getSupabase } from '@/lib/supabase'

/**
 * O que o treinador vê de um aluno com conta vinculada: nível, foto, estilo do quiz, plano e os treinos dos últimos
 * 30 dias (`{ dados }`). Nunca lesões, peso, check-ins nem anotações (veja lib/cornerman/aluno-dados.ts).
 * Plano, sessão e vínculo são conferidos aqui no servidor em toda chamada. Ficha de outro treinador, id que não existe
 * e id que não é um uuid respondem igual (404); ficha sem conta vinculada, 409 `sem_vinculo`.
 */
export async function GET(request: Request, ctx: RouteContext<'/api/cornerman/alunos/[id]/dados'>) {
  const preparo = await prepararRotaDoTreinador(request, { mutavel: false })
  if (!preparo.ok) return preparo.resposta

  const { id } = await ctx.params
  if (!ehIdDeFicha(id)) return erro('nao_encontrado', 'Aluno não encontrado.', 404)

  const db = getSupabase()
  if (!db) return erro('nao_configurado', 'A conta na nuvem ainda não está disponível neste ambiente.', 503)

  try {
    const dados = await dadosDoAluno(criarAlunosBancoSupabase(db), criarDadosDoAlunoBancoSupabase(db), preparo.usuario.id, id, new Date())
    return responder({ dados })
  } catch (e) {
    const { status, corpo } = respostaDeErroDoCornerman(e)
    return responder(corpo, status)
  }
}
