import { erro, responder } from '@/lib/assinatura/rota'
import { prepararRotaDoTreinador } from '@/lib/cornerman/acesso'
import { criarAlunosBancoSupabase } from '@/lib/cornerman/banco'
import { ehIdDeFicha } from '@/lib/cornerman/ficha'
import { LIMITE_DO_CORPO_BYTES, respostaDeErroDoCornerman } from '@/lib/cornerman/http'
import { apagarAluno, atualizarAluno, lerAluno } from '@/lib/cornerman/servico'
import { lerCorpoJson } from '@/lib/dados/servidor/http'
import { getSupabase } from '@/lib/supabase'

/**
 * Uma ficha de aluno do treinador logado. Ficha de outro treinador, id que não existe e id que não é um uuid
 * respondem exatamente igual (404, "Aluno não encontrado."): nada revela quais ids existem.
 *
 * - GET: a ficha (`{ aluno }`).
 * - PATCH: muda campos da ficha e/ou o `status` (`ativo` ou `encerrado`). `{ aluno }`.
 * - DELETE: apaga de vez. `{ ok: true }`.
 */
type Contexto = RouteContext<'/api/cornerman/alunos/[id]'>

const naoEncontrado = () => erro('nao_encontrado', 'Aluno não encontrado.', 404)

export async function GET(request: Request, ctx: Contexto) {
  const preparo = await prepararRotaDoTreinador(request, { mutavel: false })
  if (!preparo.ok) return preparo.resposta

  const { id } = await ctx.params
  if (!ehIdDeFicha(id)) return naoEncontrado()

  const db = getSupabase()
  if (!db) return erro('nao_configurado', 'A conta na nuvem ainda não está disponível neste ambiente.', 503)

  try {
    return responder({ aluno: await lerAluno(criarAlunosBancoSupabase(db), preparo.usuario.id, id) })
  } catch (e) {
    const { status, corpo } = respostaDeErroDoCornerman(e)
    return responder(corpo, status)
  }
}

export async function PATCH(request: Request, ctx: Contexto) {
  const preparo = await prepararRotaDoTreinador(request, { mutavel: true })
  if (!preparo.ok) return preparo.resposta

  const { id } = await ctx.params
  if (!ehIdDeFicha(id)) return naoEncontrado()

  // O corpo é conferido antes do banco: pedido ruim ou grande demais é recusado sem tocar em nada.
  const corpo = await lerCorpoJson(request, LIMITE_DO_CORPO_BYTES)
  if (!corpo.ok) return erro(corpo.erro.codigo, corpo.erro.mensagem, corpo.erro.status)

  const db = getSupabase()
  if (!db) return erro('nao_configurado', 'A conta na nuvem ainda não está disponível neste ambiente.', 503)

  try {
    return responder({ aluno: await atualizarAluno(criarAlunosBancoSupabase(db), preparo.usuario.id, id, corpo.valor) })
  } catch (e) {
    const { status, corpo: resposta } = respostaDeErroDoCornerman(e)
    return responder(resposta, status)
  }
}

export async function DELETE(request: Request, ctx: Contexto) {
  const preparo = await prepararRotaDoTreinador(request, { mutavel: true })
  if (!preparo.ok) return preparo.resposta

  const { id } = await ctx.params
  if (!ehIdDeFicha(id)) return naoEncontrado()

  const db = getSupabase()
  if (!db) return erro('nao_configurado', 'A conta na nuvem ainda não está disponível neste ambiente.', 503)

  try {
    await apagarAluno(criarAlunosBancoSupabase(db), preparo.usuario.id, id)
    return responder({ ok: true })
  } catch (e) {
    const { status, corpo } = respostaDeErroDoCornerman(e)
    return responder(corpo, status)
  }
}
