import { responder } from '@/lib/assinatura/rota'
import { prepararRotaDoTreinador } from '@/lib/cornerman/acesso'
import { criarAlunosBancoSupabase } from '@/lib/cornerman/banco'
import { respostaDeErroDoCornerman } from '@/lib/cornerman/http'
import { contarAlunosVermelhos } from '@/lib/cornerman/servico'
import { getSupabase } from '@/lib/supabase'

/**
 * O selo vermelho da aba "Alunos" (plano Cornerman ou Profissional): quantos alunos com conta estão há 7 dias ou mais sem
 * treinar (`{ vermelhos }`). É consultada em toda abertura de tela, então não lê fichas nem fotos. Sem o banco configurado
 * não há o que contar: 200 com `vermelhos: null` (não é um erro, e um 5xx apareceria no console do navegador a cada tela).
 */
export async function GET(request: Request) {
  const preparo = await prepararRotaDoTreinador(request, { mutavel: false })
  if (!preparo.ok) return preparo.resposta

  const db = getSupabase()
  if (!db) return responder({ vermelhos: null })

  try {
    return responder({ vermelhos: await contarAlunosVermelhos(criarAlunosBancoSupabase(db), preparo.usuario.id) })
  } catch (e) {
    const { status, corpo } = respostaDeErroDoCornerman(e)
    return responder(corpo, status)
  }
}
