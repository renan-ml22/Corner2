// Regras das fichas de aluno do treinador. Fala com um `AlunosBancoLike` (veja banco.ts), então testa-se sem rede.
// O id do treinador vem SEMPRE da sessão (quem chama), nunca do corpo do pedido.
// Mensagens de erro e dados que saem daqui nunca levam e-mail, telefone nem notas de ninguém além do próprio dono.

import type { AlunosBancoLike, LinhaDeAluno } from './banco'
import {
  LIMITE_DE_ALUNOS, contarAtivas, ehIdDeFicha, validarAtualizacao, validarNovaFicha,
  type FichaDeAluno, type StatusDaFicha,
} from './ficha'
import type { Nivel } from '@/lib/onboarding'
import { INDISPONIVEL, SEM_DADOS, statusDeTreino, type StatusDeTreino } from './status-treino'

export type CodigoCornerman =
  | 'limite_de_alunos' | 'nao_encontrado' | 'dado_invalido'
  | 'convite_invalido' | 'proprio_convite' | 'ja_tem_treinador' | 'convite_pendente' | 'nao_convidavel' | 'sem_vinculo' | 'ficha_encerrada'

/** Erro com texto seguro para mostrar à pessoa e o status HTTP a devolver. */
export class ErroCornerman extends Error {
  constructor(readonly codigo: CodigoCornerman, mensagem: string, readonly status: number) {
    super(mensagem)
    this.name = 'ErroCornerman'
  }
}

// Ficha de outro treinador, id que não existe e id malformado respondem exatamente igual.
export const naoEncontrado = () => new ErroCornerman('nao_encontrado', 'Aluno não encontrado.', 404)
export const limiteAtingido = () => new ErroCornerman('limite_de_alunos', `Você já tem ${LIMITE_DE_ALUNOS} alunos. Encerre ou apague uma ficha para cadastrar outro.`, 409)

const NIVEIS: readonly string[] = ['iniciante', 'intermediario', 'avancado']
const STATUS: readonly string[] = ['ativo', 'convidado', 'encerrado']

/** Monta a ficha campo a campo (lista de permitidos): o que o banco tem a mais, como `coach_id`, não sai. */
function paraFicha(l: LinhaDeAluno): FichaDeAluno {
  return {
    id: l.id,
    nome: l.nome,
    email: l.email,
    telefone: l.telefone,
    nivel: NIVEIS.includes(l.nivel ?? '') ? (l.nivel as Nivel) : null,
    estilo: l.estilo,
    notas: l.notas,
    foto: l.foto,
    status: STATUS.includes(l.status) ? (l.status as StatusDaFicha) : 'ativo',
    comConta: l.aluno_user_id !== null,
    criadoEm: l.created_at,
    atualizadoEm: l.updated_at,
  }
}

const semAcento = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '')
const porNome = (a: FichaDeAluno, b: FichaDeAluno) => semAcento(a.nome).localeCompare(semAcento(b.nome), 'pt-BR', { sensitivity: 'base' })

/** O limite do banco (gatilho) vira o erro com texto próprio; qualquer outro erro sobe como está. */
async function comLimite<T>(operacao: Promise<T>): Promise<T> {
  try {
    return await operacao
  } catch (e) {
    if (e instanceof Error && e.message === 'limite_de_alunos') throw limiteAtingido()
    throw e
  }
}

/** Uma ficha na lista: a ficha mais o status de treino (só quem tem conta vinculada tem; os demais são cinza). */
export type AlunoNaLista = FichaDeAluno & { treino: StatusDeTreino }

/** De onde veio uma falha do banco: só o "Supabase (onde)" do começo da mensagem, porque o resto pode trazer dados de alguém. */
export const ondeFalhou = (e: unknown): string | null => (e instanceof Error ? /^Supabase \([^)]*\)/.exec(e.message)?.[0] ?? null : null)

/**
 * Os últimos treinos dos alunos com conta, ou `null` se o banco falhar (ou a função SQL da etapa 3b ainda não existir):
 * a lista continua útil, mas os alunos aparecem como "status indisponível", nunca como "sem treinos". O registro leva a mensagem
 * do banco (só nome de função e código, a chamada só leva o id do treinador), sem dado de nenhuma ficha.
 */
async function ultimosTreinosOuNada(banco: AlunosBancoLike, coachId: string): Promise<Record<string, string> | null> {
  try {
    return await banco.ultimosTreinos(coachId)
  } catch (e) {
    const onde = ondeFalhou(e)
    const causa = e instanceof Error ? e.message.slice(0, 200) : 'erro desconhecido'
    console.error(`[cornerman] não foi possível ler os últimos treinos${onde ? `: ${causa}` : ` (${e instanceof Error ? e.name : causa})`}`)
    return null
  }
}

export async function listarAlunos(banco: AlunosBancoLike, coachId: string, agora: Date = new Date()): Promise<{ alunos: AlunoNaLista[]; ativos: number; limite: number }> {
  const fichas = (await banco.listar(coachId)).map(paraFicha)
  const comStatus = (f: FichaDeAluno) => f.status === 'ativo' && f.comConta
  const ultimos = fichas.some(comStatus) ? await ultimosTreinosOuNada(banco, coachId) : {}
  const treinoDe = (f: FichaDeAluno): StatusDeTreino => (!comStatus(f) ? SEM_DADOS : ultimos === null ? INDISPONIVEL : statusDeTreino(ultimos[f.id] ?? null, agora))
  const naLista = (f: FichaDeAluno): AlunoNaLista => ({ ...f, treino: treinoDe(f) })

  const ativas = fichas.filter(f => f.status !== 'encerrado').sort(porNome).map(naLista)
  const encerradas = fichas.filter(f => f.status === 'encerrado').sort(porNome).map(naLista)
  return { alunos: [...ativas, ...encerradas], ativos: contarAtivas(fichas), limite: LIMITE_DE_ALUNOS }
}

export async function criarAluno(banco: AlunosBancoLike, coachId: string, corpo: unknown): Promise<FichaDeAluno> {
  const v = validarNovaFicha(corpo)
  if (!v.ok) throw new ErroCornerman('dado_invalido', v.erro, 400)
  return paraFicha(await comLimite(banco.inserir(coachId, v.valor)))
}

export async function lerAluno(banco: AlunosBancoLike, coachId: string, id: string): Promise<FichaDeAluno> {
  if (!ehIdDeFicha(id)) throw naoEncontrado()
  const linha = await banco.obter(coachId, id)
  if (!linha) throw naoEncontrado()
  return paraFicha(linha)
}

export async function atualizarAluno(banco: AlunosBancoLike, coachId: string, id: string, corpo: unknown): Promise<FichaDeAluno> {
  if (!ehIdDeFicha(id)) throw naoEncontrado()
  const v = validarAtualizacao(corpo)
  if (!v.ok) throw new ErroCornerman('dado_invalido', v.erro, 400)
  const campos: Record<string, unknown> = { ...v.valor }
  // Encerrar uma ficha desfaz o vínculo com a conta, SEMPRE e na própria gravação (nunca depende de uma leitura anterior,
  // que outra aba poderia deixar velha): reabrir depois não restaura nada (decisão 17).
  if (v.valor.status === 'encerrado') campos.aluno_user_id = null

  const linha = await comLimite(banco.atualizar(coachId, id, campos))
  if (!linha) {
    // Sem linha: ou a ficha não é deste treinador, ou o status não pôde mudar porque a ficha está com convite pendente
    // (o próprio banco recusa). O convite se cancela pela rota própria, e só então o status pode mudar.
    if (v.valor.status !== undefined && (await banco.obter(coachId, id))?.status === 'convidado') {
      throw new ErroCornerman('convite_pendente', 'Cancele o convite antes de mudar o status da ficha.', 409)
    }
    throw naoEncontrado()
  }
  return paraFicha(linha)
}

export async function apagarAluno(banco: AlunosBancoLike, coachId: string, id: string): Promise<void> {
  if (!ehIdDeFicha(id) || !(await banco.apagar(coachId, id))) throw naoEncontrado()
}

/**
 * Quantos alunos com conta estão há 7 dias ou mais sem treinar (o selo da aba "Alunos"). Mesma regra e mesma função SQL da
 * lista, mas sem ler as fichas nem as fotos. Quem nunca treinou é cinza, não vermelho. Se o banco falhar, a falha SOBE: um
 * "0" no lugar de "não sei" esconderia aluno parado.
 */
export async function contarAlunosVermelhos(banco: AlunosBancoLike, coachId: string, agora: Date = new Date()): Promise<number> {
  const ultimos = await banco.ultimosTreinos(coachId)
  return Object.values(ultimos).filter(instante => statusDeTreino(instante, agora).cor === 'vermelho').length
}
