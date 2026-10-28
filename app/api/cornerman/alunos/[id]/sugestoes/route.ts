import { erro, responder } from '@/lib/assinatura/rota'
import { prepararRotaDoTreinador } from '@/lib/cornerman/acesso'
import { criarAlunosBancoSupabase } from '@/lib/cornerman/banco'
import { ehIdDeFicha } from '@/lib/cornerman/ficha'
import { respostaDeErroDoCornerman } from '@/lib/cornerman/http'
import { criarSugestoesBancoSupabase } from '@/lib/cornerman/sugestao-banco'
import { historicoDeSugestoes, sugerirPlano } from '@/lib/cornerman/sugestao-servico'
import { lerCorpoJson } from '@/lib/dados/servidor/http'
import { getSupabase } from '@/lib/supabase'

/**
 * Sugestões de plano de uma ficha do treinador logado (plano Cornerman ou Profissional).
 *
 * - GET: o histórico da ficha, da mais nova para a mais antiga (`{ sugestoes }`).
 * - POST: sugere um plano (corpo: `planoId` e, se quiser, `mensagem`). Aluno com conta vinculada: fica pendente e substitui a
 *   pendente anterior. Ficha sem conta: só um registro. 201 `{ status, sugestoes }` com o histórico já atualizado.
 *
 * Ficha de outro treinador, id que não existe e id que não é um uuid respondem exatamente igual (404). Ficha encerrada: 409.
 */
type Contexto = RouteContext<'/api/cornerman/alunos/[id]/sugestoes'>

const naoEncontrado = () => erro('nao_encontrado', 'Aluno não encontrado.', 404)
const semBanco = () => erro('nao_configurado', 'A conta na nuvem ainda não está disponível neste ambiente.', 503)

/** A mensagem tem 500 caracteres no máximo; 10 KB sobra e não abre a porta para abuso. */
const LIMITE_DO_CORPO_BYTES = 10_000

export async function GET(request: Request, ctx: Contexto) {
  const preparo = await prepararRotaDoTreinador(request, { mutavel: false })
  if (!preparo.ok) return preparo.resposta

  const { id } = await ctx.params
  if (!ehIdDeFicha(id)) return naoEncontrado()

  const db = getSupabase()
  if (!db) return semBanco()

  try {
    return responder({ sugestoes: await historicoDeSugestoes(criarAlunosBancoSupabase(db), criarSugestoesBancoSupabase(db), preparo.usuario.id, id) })
  } catch (e) {
    const { status, corpo } = respostaDeErroDoCornerman(e)
    return responder(corpo, status)
  }
}

export async function POST(request: Request, ctx: Contexto) {
  const preparo = await prepararRotaDoTreinador(request, { mutavel: true })
  if (!preparo.ok) return preparo.resposta

  const { id } = await ctx.params
  if (!ehIdDeFicha(id)) return naoEncontrado()

  // O corpo é conferido antes do banco: pedido ruim ou grande demais é recusado sem tocar em nada.
  const corpo = await lerCorpoJson(request, LIMITE_DO_CORPO_BYTES)
  if (!corpo.ok) return erro(corpo.erro.codigo, corpo.erro.mensagem, corpo.erro.status)

  const db = getSupabase()
  if (!db) return semBanco()

  try {
    const sugestoes = criarSugestoesBancoSupabase(db)
    const { status } = await sugerirPlano(sugestoes, preparo.usuario.id, id, corpo.valor)
    const historico = await historicoDeSugestoes(criarAlunosBancoSupabase(db), sugestoes, preparo.usuario.id, id)
    return responder({ status, sugestoes: historico }, 201)
  } catch (e) {
    const { status, corpo: resposta } = respostaDeErroDoCornerman(e)
    return responder(resposta, status)
  }
}
