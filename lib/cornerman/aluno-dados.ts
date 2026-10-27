// O que o treinador vê de um aluno com conta vinculada (decisão 4 do desenho): nível, foto, estilo do quiz, plano e os
// treinos dos últimos 30 dias. A resposta é montada campo a campo, a partir de dados validados: nada que o banco
// devolva a mais (anotações, parceiro e pancadas do sparring, lesões, peso, check-ins) chega ao treinador.

import { getPlano } from '@/data/planos'
import { isObj, isFoto, isQuiz } from '@/lib/dados/contrato'
import { linhaParaPlano, linhaParaTreino } from '@/lib/dados/servidor/mapeamento'
import { semanaAtualDoPlano } from '@/lib/treinos'
import { resultadoDoQuiz } from '@/lib/quiz'
import type { Nivel } from '@/lib/onboarding'
import type { RegType } from '@/lib/tipos'
import type { DadosDoAlunoBancoLike } from './aluno-dados-banco'
import type { AlunosBancoLike } from './banco'
import { ehIdDeFicha } from './ficha'
import { ErroCornerman, naoEncontrado } from './servico'

export const DIAS_DE_HISTORICO = 30
const DIA_MS = 24 * 60 * 60 * 1000

export interface TreinoDoAluno {
  /** Instante do treino, ISO 8601 em UTC */
  data: string
  tipo: RegType
  rounds: number
  minPorRound: number
  rpe: number
  duracaoSegundos: number
}

export interface DadosDoAluno {
  nivel: Nivel | null
  /** `data:image/jpeg;base64,…` ou vazio */
  foto: string
  /** O atleta mais compatível com o quiz do aluno; `null` se ele nunca fez o quiz */
  estilo: { atletaId: string; nome: string; estilo: string; percentual: number } | null
  plano: { nome: string; semana: number; semanas: number } | null
  /** Os mais novos primeiro */
  treinos: TreinoDoAluno[]
}

const NIVEIS: readonly string[] = ['iniciante', 'intermediario', 'avancado']

const semVinculo = () => new ErroCornerman('sem_vinculo', 'Este aluno ainda não tem conta vinculada.', 409)

function estiloDoQuiz(valor: unknown): DadosDoAluno['estilo'] {
  if (typeof valor !== 'string' || valor === '' || !isQuiz(valor)) return null
  const r = resultadoDoQuiz([...valor].map(Number))
  if (!r) return null
  const { atleta, percentual } = r.primeiro
  return { atletaId: atleta.id, nome: atleta.nome, estilo: atleta.estilo, percentual }
}

function planoDoAluno(linha: unknown, agora: Date): DadosDoAluno['plano'] {
  const ativo = isObj(linha) ? linhaParaPlano(linha as never) : null
  const plano = ativo ? getPlano(ativo.planoId) : null
  if (!ativo || !plano) return null
  return { nome: plano.nome, semana: Math.min(Math.max(1, semanaAtualDoPlano(ativo, agora)), plano.semanas), semanas: plano.semanas }
}

function treinoDoAluno(linha: unknown): TreinoDoAluno | null {
  if (!isObj(linha)) return null
  // Só as colunas permitidas entram na conversão: o resto da linha, se houver, nem é lido.
  const t = linhaParaTreino({
    id: '-', date: linha.date, type: linha.type, rounds: linha.rounds, round_min: linha.round_min, rpe: linha.rpe, duration_seconds: linha.duration_seconds,
    session_id: null, note: null, sparring_intensity: null, sparring_head: null, sparring_partner: null,
  } as never)
  return t ? { data: t.data, tipo: t.tipo, rounds: t.rounds, minPorRound: t.minPorRound, rpe: t.rpe, duracaoSegundos: t.duracaoSegundos } : null
}

/**
 * Os dados do aluno da ficha `id` do treinador `coachId`. Só vale para ficha `ativo` com conta vinculada: ficha de outro
 * treinador, inexistente ou malformada dá o mesmo 404 das demais rotas; ficha sem vínculo (manual, convidada ou
 * encerrada, mesmo com um vínculo antigo guardado) dá 409 `sem_vinculo`. O id da conta do aluno vem SEMPRE da ficha.
 */
export async function dadosDoAluno(fichas: AlunosBancoLike, banco: DadosDoAlunoBancoLike, coachId: string, id: string, agora: Date): Promise<DadosDoAluno> {
  if (!ehIdDeFicha(id)) throw naoEncontrado()
  const ficha = await fichas.obter(coachId, id)
  if (!ficha) throw naoEncontrado()
  if (ficha.status !== 'ativo' || ficha.aluno_user_id === null) throw semVinculo()

  const alunoId = ficha.aluno_user_id
  const desde = new Date(agora.getTime() - DIAS_DE_HISTORICO * DIA_MS)
  const [treinos, plano, nivel, dados] = await Promise.all([
    banco.treinosRecentes(alunoId, desde.toISOString()), banco.plano(alunoId), banco.nivel(alunoId), banco.dados(alunoId),
  ])
  const guardado = (entidade: string) => dados.find(d => d.entity === entidade)?.value

  const recentes = treinos
    .map(treinoDoAluno)
    .filter((t): t is TreinoDoAluno => t !== null && Date.parse(t.data) >= desde.getTime())
    .sort((a, b) => Date.parse(b.data) - Date.parse(a.data))
  const foto = guardado('foto')

  return {
    nivel: typeof nivel === 'string' && NIVEIS.includes(nivel) ? (nivel as Nivel) : null,
    foto: isFoto(foto) ? foto : '',
    estilo: estiloDoQuiz(guardado('quiz')),
    plano: planoDoAluno(plano, agora),
    treinos: recentes,
  }
}
