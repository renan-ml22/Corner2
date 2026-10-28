// Sugestão de plano do treinador ao aluno (plano Cornerman): o que ela guarda e a validação do que chega do navegador.
// Puro: sem rede e sem banco, vale no navegador e no servidor. As mensagens de erro NUNCA repetem o texto enviado.

import { getPlano } from '@/data/planos'
import { RECURSO_DO_PLANO_DE_TREINO } from '@/lib/assinatura/catalogo'
import { isObj } from '@/lib/dados/contrato'
import { textoSujo, type Validacao } from './ficha'

export const LIMITE_DA_MENSAGEM = 500

/**
 * - `pendente`: o aluno ainda não respondeu (no máximo uma por aluno).
 * - `aceita` / `recusada`: a resposta do aluno.
 * - `substituida`: o treinador mandou outra no lugar.
 * - `cancelada`: o vínculo terminou antes da resposta.
 * - `registrada`: ficha sem conta; fica só como registro no histórico da ficha.
 */
export type StatusDaSugestao = 'pendente' | 'aceita' | 'recusada' | 'substituida' | 'cancelada' | 'registrada'

export const STATUS_DA_SUGESTAO: readonly StatusDaSugestao[] = ['pendente', 'aceita', 'recusada', 'substituida', 'cancelada', 'registrada']

/** Uma sugestão no histórico da ficha, como o treinador a vê. */
export interface SugestaoDaFicha {
  id: string
  planoId: string
  planoNome: string
  mensagem: string
  status: StatusDaSugestao
  criadaEm: string
  respondidaEm: string | null
}

/** A sugestão como o aluno a vê: com o primeiro nome de quem sugeriu. */
export interface SugestaoParaOAluno {
  id: string
  planoId: string
  planoNome: string
  mensagem: string
  treinador: string
  criadaEm: string
  respondidaEm: string | null
}

/** O que o aluno precisa saber: a sugestão que espera resposta e a última que ele aceitou neste vínculo (para o selo no plano). */
export interface SugestoesDoAluno {
  pendente: SugestaoParaOAluno | null
  aceita: SugestaoParaOAluno | null
}

export interface NovaSugestao { planoId: string; mensagem: string }

/** Os planos que o treinador pode sugerir: os que têm dono no catálogo de assinatura (os 4 planos e os treinos de atletas). */
export function planosSugeriveis(): { id: string; nome: string }[] {
  return Object.keys(RECURSO_DO_PLANO_DE_TREINO).flatMap(id => {
    const plano = getPlano(id)
    return plano ? [{ id, nome: plano.nome }] : []
  })
}

export const ehPlanoSugerivel = (id: unknown): id is string =>
  typeof id === 'string' && Object.hasOwn(RECURSO_DO_PLANO_DE_TREINO, id) && getPlano(id) !== null

/** O nome de um plano que pode já não existir nos dados do app. */
export const nomeDoPlanoSugerido = (id: string): string => getPlano(id)?.nome ?? 'Plano removido'

const ROTULO: Record<StatusDaSugestao, string> = {
  pendente: 'Aguardando resposta',
  aceita: 'Aceita',
  recusada: 'Recusada',
  substituida: 'Substituída por outra',
  cancelada: 'Cancelada: o vínculo terminou',
  registrada: 'Registrada na ficha',
}

export const rotuloDoStatusDaSugestao = (s: StatusDaSugestao): string => ROTULO[s]

/** Setas e isolamentos de direção do texto: embaralhariam a ordem das letras na tela de quem recebe. */
const DIRECAO_DO_TEXTO = /[؜‎‏‪-‮⁦-⁩]/

const ERRO_PLANO = 'Escolha um plano da lista.'
const ERRO_MENSAGEM = `A mensagem pode ter no máximo ${LIMITE_DA_MENSAGEM} caracteres.`

/** Sugestão nova: o plano é obrigatório, a mensagem é opcional. Qualquer campo fora dessa lista recusa o pedido inteiro. */
export function validarNovaSugestao(corpo: unknown): Validacao<NovaSugestao> {
  if (!isObj(corpo)) return { ok: false, erro: 'Os dados da sugestão não são válidos.' }
  if (Object.keys(corpo).some(k => k !== 'planoId' && k !== 'mensagem')) return { ok: false, erro: 'O pedido tem campos que não podem ser enviados.' }
  if (!ehPlanoSugerivel(corpo.planoId)) return { ok: false, erro: ERRO_PLANO }

  const bruta = corpo.mensagem === undefined ? '' : corpo.mensagem
  if (typeof bruta !== 'string') return { ok: false, erro: ERRO_MENSAGEM }
  const mensagem = bruta.trim()
  if (mensagem.length > LIMITE_DA_MENSAGEM || textoSujo(mensagem, true) || DIRECAO_DO_TEXTO.test(mensagem)) return { ok: false, erro: ERRO_MENSAGEM }
  return { ok: true, valor: { planoId: corpo.planoId, mensagem } }
}
