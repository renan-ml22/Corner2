// Regras das sugestões de plano. Fala com um `SugestoesBancoLike` (veja sugestao-banco.ts), então testa-se sem rede.
// O id do treinador e o da conta do aluno vêm SEMPRE da sessão (quem chama), nunca do corpo do pedido.
// Nenhuma mensagem de erro leva o texto que o treinador escreveu.

import type { AlunosBancoLike } from './banco'
import { primeiroNome } from './convite-servico'
import { ehIdDeFicha } from './ficha'
import { ErroCornerman, lerAluno, naoEncontrado } from './servico'
import type { SugestoesBancoLike } from './sugestao-banco'
import {
  STATUS_DA_SUGESTAO, nomeDoPlanoSugerido, validarNovaSugestao,
  type SugestaoDaFicha, type SugestaoParaOAluno, type SugestoesDoAluno, type StatusDaSugestao,
} from './sugestao'

const sugestaoNaoEncontrada = () => new ErroCornerman('nao_encontrado', 'Sugestão não encontrada ou já respondida.', 404)

/** O erro das funções SQL vira o erro com texto próprio; qualquer outro sobe como está. */
function traduzir(e: unknown): never {
  if (e instanceof Error) {
    if (e.message === 'nao_encontrado') throw naoEncontrado()
    if (e.message === 'ficha_encerrada') throw new ErroCornerman('ficha_encerrada', 'Esta ficha está encerrada. Reabra a ficha para sugerir um plano.', 409)
  }
  throw e
}

const statusConhecido = (s: string): s is StatusDaSugestao => (STATUS_DA_SUGESTAO as readonly string[]).includes(s)

/**
 * O treinador sugere um plano. Aluno com conta: fica pendente (e substitui a pendente anterior). Ficha sem conta: só um
 * registro no histórico da ficha. Ficha de outro treinador, que não existe ou id malformado: 404 igual.
 */
export async function sugerirPlano(banco: SugestoesBancoLike, coachId: string, alunoId: string, corpo: unknown): Promise<{ status: 'pendente' | 'registrada' }> {
  if (!ehIdDeFicha(alunoId)) throw naoEncontrado()
  const v = validarNovaSugestao(corpo)
  if (!v.ok) throw new ErroCornerman('dado_invalido', v.erro, 400)
  try {
    return { status: await banco.sugerir(coachId, alunoId, v.valor.planoId, v.valor.mensagem) }
  } catch (e) {
    traduzir(e)
  }
}

/** O histórico de sugestões de uma ficha, da mais nova para a mais antiga. A ficha precisa ser deste treinador (senão, 404). */
export async function historicoDeSugestoes(alunos: AlunosBancoLike, banco: SugestoesBancoLike, coachId: string, alunoId: string): Promise<SugestaoDaFicha[]> {
  await lerAluno(alunos, coachId, alunoId)
  const linhas = await banco.historico(coachId, alunoId)
  return linhas.flatMap(l => statusConhecido(l.status)
    ? [{ id: l.id, planoId: l.plano_id, planoNome: nomeDoPlanoSugerido(l.plano_id), mensagem: l.mensagem, status: l.status, criadaEm: l.created_at, respondidaEm: l.answered_at }]
    : [])
}

/** O que o aluno vê: a sugestão que espera resposta e a última que aceitou neste vínculo, com o primeiro nome do treinador. */
export async function sugestoesDoAluno(banco: SugestoesBancoLike, alunoUserId: string): Promise<SugestoesDoAluno> {
  const linhas = await banco.doAluno(alunoUserId)
  const nomes = new Map<string, string>()
  const paraOAluno = async (status: 'pendente' | 'aceita'): Promise<SugestaoParaOAluno | null> => {
    const l = linhas.find(x => x.status === status)
    if (!l) return null
    if (!nomes.has(l.coach_id)) nomes.set(l.coach_id, primeiroNome(await banco.nomeDoTreinador(l.coach_id)))
    return {
      id: l.id, planoId: l.plano_id, planoNome: nomeDoPlanoSugerido(l.plano_id), mensagem: l.mensagem,
      treinador: nomes.get(l.coach_id)!, criadaEm: l.created_at, respondidaEm: l.answered_at,
    }
  }
  return { pendente: await paraOAluno('pendente'), aceita: await paraOAluno('aceita') }
}

/** O aluno aceita ou recusa. Só vale para sugestão pendente do vínculo ativo dele; qualquer outra coisa responde igual (404). */
export async function responderSugestao(banco: SugestoesBancoLike, alunoUserId: string, id: string, aceitar: boolean): Promise<void> {
  if (!ehIdDeFicha(id) || !(await banco.responder(alunoUserId, id, aceitar))) throw sugestaoNaoEncontrada()
}
