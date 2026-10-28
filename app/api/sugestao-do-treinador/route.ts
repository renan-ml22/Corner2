import { prepararRota, responder } from '@/lib/assinatura/rota'
import { getSupabase } from '@/lib/supabase'
import { prepararRotaDoAluno } from '@/lib/cornerman/aluno-rota'
import { respostaDeErroDoCornerman } from '@/lib/cornerman/http'
import { criarSugestoesBancoSupabase } from '@/lib/cornerman/sugestao-banco'
import { sugestoesDoAluno } from '@/lib/cornerman/sugestao-servico'

/**
 * "Plano sugerido pelo meu treinador", do aluno logado (qualquer plano).
 *
 * - GET: `{ pendente, aceita }`. `pendente` é a sugestão que espera resposta; `aceita` é a última aceita neste vínculo (para o
 *   selo "Sugerido pelo seu treinador" no plano). Cada uma traz plano, mensagem e o primeiro nome do treinador; sem treinador
 *   ou sem sugestão, `null`.
 *
 * É consultada em toda abertura da tela Hoje. Sem o banco configurado não há treinador: 200 com os dois `null` (não é um
 * erro, e um 5xx apareceria no console do navegador a cada abertura).
 */
export async function GET(request: Request) {
  const sessao = await prepararRota(request, { mutavel: false })
  if (!sessao.ok) return sessao.resposta
  if (!getSupabase()) return responder({ pendente: null, aceita: null })

  const preparo = await prepararRotaDoAluno(request, { mutavel: false })
  if (!preparo.ok) return preparo.resposta

  try {
    return responder(await sugestoesDoAluno(criarSugestoesBancoSupabase(preparo.db), preparo.usuario.id))
  } catch (e) {
    const { status, corpo } = respostaDeErroDoCornerman(e)
    return responder(corpo, status)
  }
}
