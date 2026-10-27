// Regras das fichas de aluno do treinador. Fala com um `AlunosBancoLike` (veja banco.ts), então testa-se sem rede.
// O id do treinador vem SEMPRE da sessão (quem chama), nunca do corpo do pedido.
// Mensagens de erro e dados que saem daqui nunca levam e-mail, telefone nem notas de ninguém além do próprio dono.

import type { AlunosBancoLike, LinhaDeAluno } from './banco'
import {
  LIMITE_DE_ALUNOS, contarAtivas, ehIdDeFicha, validarAtualizacao, validarNovaFicha,
  type FichaDeAluno, type StatusDaFicha,
} from './ficha'
import type { Nivel } from '@/lib/onboarding'

export type CodigoCornerman =
  | 'limite_de_alunos' | 'nao_encontrado' | 'dado_invalido'
  | 'convite_invalido' | 'proprio_convite' | 'ja_tem_treinador' | 'convite_pendente' | 'nao_convidavel'

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

export async function listarAlunos(banco: AlunosBancoLike, coachId: string): Promise<{ alunos: FichaDeAluno[]; ativos: number; limite: number }> {
  const fichas = (await banco.listar(coachId)).map(paraFicha)
  const ativas = fichas.filter(f => f.status !== 'encerrado').sort(porNome)
  const encerradas = fichas.filter(f => f.status === 'encerrado').sort(porNome)
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

  if (v.valor.status !== undefined) {
    const atual = await banco.obter(coachId, id)
    if (!atual) throw naoEncontrado()
    // Ficha com convite pendente: o convite se cancela pela rota própria, e só então o status pode mudar.
    if (atual.status === 'convidado') throw new ErroCornerman('convite_pendente', 'Cancele o convite antes de mudar o status da ficha.', 409)
    // Encerrar uma ficha com conta desfaz o vínculo; reabrir depois não o restaura (decisão 17).
    if (v.valor.status === 'encerrado' && atual.aluno_user_id !== null) campos.aluno_user_id = null
  }

  const linha = await comLimite(banco.atualizar(coachId, id, campos))
  if (!linha) throw naoEncontrado()
  return paraFicha(linha)
}

export async function apagarAluno(banco: AlunosBancoLike, coachId: string, id: string): Promise<void> {
  if (!ehIdDeFicha(id) || !(await banco.apagar(coachId, id))) throw naoEncontrado()
}
