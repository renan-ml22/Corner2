import { erro, responder } from '@/lib/assinatura/rota'
import { prepararRotaDoTreinador } from '@/lib/cornerman/acesso'
import { criarAlunosBancoSupabase } from '@/lib/cornerman/banco'
import { LIMITE_DO_CORPO_BYTES, respostaDeErroDoCornerman } from '@/lib/cornerman/http'
import { criarAluno, listarAlunos } from '@/lib/cornerman/servico'
import { lerCorpoJson } from '@/lib/dados/servidor/http'
import { getSupabase } from '@/lib/supabase'

/**
 * Fichas de aluno do treinador logado (plano Cornerman ou Profissional). O id do treinador vem SEMPRE da sessão, e o
 * plano é conferido aqui no servidor em toda chamada (veja lib/cornerman/acesso.ts).
 *
 * - GET: a lista (`{ alunos, ativos, limite }`), ativos primeiro.
 * - POST: cria uma ficha (corpo: nome e, se quiser, e-mail, telefone, nivel, estilo, notas, foto). 201 `{ aluno }`.
 */
export async function GET(request: Request) {
  const preparo = await prepararRotaDoTreinador(request, { mutavel: false })
  if (!preparo.ok) return preparo.resposta

  const db = getSupabase()
  if (!db) return erro('nao_configurado', 'A conta na nuvem ainda não está disponível neste ambiente.', 503)

  try {
    return responder(await listarAlunos(criarAlunosBancoSupabase(db), preparo.usuario.id))
  } catch (e) {
    const { status, corpo } = respostaDeErroDoCornerman(e)
    return responder(corpo, status)
  }
}

export async function POST(request: Request) {
  const preparo = await prepararRotaDoTreinador(request, { mutavel: true })
  if (!preparo.ok) return preparo.resposta

  // O corpo é conferido antes do banco: pedido ruim ou grande demais é recusado sem tocar em nada.
  const corpo = await lerCorpoJson(request, LIMITE_DO_CORPO_BYTES)
  if (!corpo.ok) return erro(corpo.erro.codigo, corpo.erro.mensagem, corpo.erro.status)

  const db = getSupabase()
  if (!db) return erro('nao_configurado', 'A conta na nuvem ainda não está disponível neste ambiente.', 503)

  try {
    return responder({ aluno: await criarAluno(criarAlunosBancoSupabase(db), preparo.usuario.id, corpo.valor) }, 201)
  } catch (e) {
    const { status, corpo: resposta } = respostaDeErroDoCornerman(e)
    return responder(resposta, status)
  }
}
