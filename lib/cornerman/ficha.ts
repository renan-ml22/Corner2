// Ficha de aluno do treinador (plano Cornerman): o que ela guarda, os limites e a validação do que chega do navegador.
// Puro: sem rede e sem banco, vale no navegador e no servidor. As mensagens de erro NUNCA repetem o que foi enviado
// (e-mail, telefone e notas são dados pessoais de terceiros).

import { isFoto, isObj } from '@/lib/dados/contrato'
import { emailValido, type Nivel } from '@/lib/onboarding'

/** Fichas e vínculos com status diferente de `encerrado`. Repetido no gatilho do banco (supabase/cornerman-etapa-2.sql). */
export const LIMITE_DE_ALUNOS = 20

export const LIMITES_DA_FICHA = { nome: 80, email: 120, telefone: 30, estilo: 40, notas: 2000 } as const

export const NOME_DO_NIVEL_DE_ALUNO: Record<Nivel, string> = { iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado' }

export type StatusDaFicha = 'ativo' | 'convidado' | 'encerrado'

export interface DadosDaFicha {
  nome: string
  email: string | null
  telefone: string | null
  nivel: Nivel | null
  estilo: string | null
  notas: string
  /** `data:image/jpeg;base64,…` ou vazio (sem foto) */
  foto: string
}

/** A ficha como o navegador a vê: sem `coach_id` e sem o id da conta do aluno (só se ele já tem conta). */
export interface FichaDeAluno extends DadosDaFicha {
  id: string
  status: StatusDaFicha
  comConta: boolean
  criadoEm: string
  atualizadoEm: string
}

export type Validacao<T> = { ok: true; valor: T } | { ok: false; erro: string }

const NIVEIS: readonly Nivel[] = ['iniciante', 'intermediario', 'avancado']
const TELEFONE = /^[0-9+()\-\s.]*$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const ehIdDeFicha = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)

/** Link `tel:` do telefone da ficha: só os dígitos (e um + no começo, se houver). `null` quando não há dígito nenhum. */
export function hrefDeTelefone(telefone: string): string | null {
  const limpo = telefone.trim()
  const digitos = limpo.replace(/\D/g, '')
  return digitos === '' ? null : `tel:${limpo.startsWith('+') ? '+' : ''}${digitos}`
}

export const contarAtivas =(fichas: readonly { status: StatusDaFicha }[]): number => fichas.filter(f => f.status !== 'encerrado').length

const CAMPOS = ['nome', 'email', 'telefone', 'nivel', 'estilo', 'notas', 'foto'] as const
type Campo = (typeof CAMPOS)[number]

const ERRO = {
  nome: `O nome precisa ter de 1 a ${LIMITES_DA_FICHA.nome} caracteres.`,
  email: 'Digite um e-mail válido.',
  telefone: `O telefone aceita só números, espaços e + ( ) - . (até ${LIMITES_DA_FICHA.telefone} caracteres).`,
  nivel: 'Escolha um nível da lista.',
  estilo: `O estilo pode ter no máximo ${LIMITES_DA_FICHA.estilo} caracteres.`,
  notas: `As notas podem ter no máximo ${LIMITES_DA_FICHA.notas} caracteres.`,
  foto: 'A foto precisa ser uma imagem JPEG pequena.',
} as const satisfies Record<Campo, string>

/** Texto opcional: vazio ou só espaços vira `null`. */
function textoOpcional(v: unknown, max: number, erro: string, padrao?: RegExp): Validacao<string | null> {
  if (v === null || v === undefined) return { ok: true, valor: null }
  if (typeof v !== 'string') return { ok: false, erro }
  const limpo = v.trim()
  if (limpo === '') return { ok: true, valor: null }
  if (limpo.length > max || (padrao && !padrao.test(limpo))) return { ok: false, erro }
  return { ok: true, valor: limpo }
}

function lerCampo(campo: Campo, v: unknown): Validacao<unknown> {
  switch (campo) {
    case 'nome': {
      const nome = typeof v === 'string' ? v.trim() : ''
      return nome.length >= 1 && nome.length <= LIMITES_DA_FICHA.nome ? { ok: true, valor: nome } : { ok: false, erro: ERRO.nome }
    }
    case 'email': {
      const r = textoOpcional(v, LIMITES_DA_FICHA.email, ERRO.email)
      return r.ok && r.valor !== null && !emailValido(r.valor) ? { ok: false, erro: ERRO.email } : r
    }
    case 'telefone':
      return textoOpcional(v, LIMITES_DA_FICHA.telefone, ERRO.telefone, TELEFONE)
    case 'estilo':
      return textoOpcional(v, LIMITES_DA_FICHA.estilo, ERRO.estilo)
    case 'nivel': {
      if (v === null || v === undefined || v === '') return { ok: true, valor: null }
      return typeof v === 'string' && (NIVEIS as readonly string[]).includes(v) ? { ok: true, valor: v } : { ok: false, erro: ERRO.nivel }
    }
    case 'notas':
      return typeof v === 'string' && v.length <= LIMITES_DA_FICHA.notas ? { ok: true, valor: v } : { ok: false, erro: ERRO.notas }
    case 'foto':
      return isFoto(v) ? { ok: true, valor: v } : { ok: false, erro: ERRO.foto }
  }
}

const CORPO_INVALIDO = 'Os dados da ficha não são válidos.'
const CAMPO_DESCONHECIDO = 'O pedido tem campos que não podem ser enviados.'

/** Ficha nova: só o nome é obrigatório; qualquer campo fora da lista recusa a ficha inteira. */
export function validarNovaFicha(corpo: unknown): Validacao<DadosDaFicha> {
  if (!isObj(corpo)) return { ok: false, erro: CORPO_INVALIDO }
  if (Object.keys(corpo).some(k => !(CAMPOS as readonly string[]).includes(k))) return { ok: false, erro: CAMPO_DESCONHECIDO }

  const ficha: Record<string, unknown> = {}
  for (const campo of CAMPOS) {
    // Notas e foto ausentes valem "vazio"; `null` explícito nesses dois é recusado.
    const r = lerCampo(campo, (campo === 'notas' || campo === 'foto') && corpo[campo] === undefined ? '' : corpo[campo])
    if (!r.ok) return r
    ficha[campo] = r.valor
  }
  return { ok: true, valor: ficha as unknown as DadosDaFicha }
}

/** Mudança numa ficha: qualquer subconjunto dos campos, mais `status` (`ativo` ou `encerrado`; `convidado` é do sistema). */
export function validarAtualizacao(corpo: unknown): Validacao<Partial<DadosDaFicha> & { status?: 'ativo' | 'encerrado' }> {
  if (!isObj(corpo)) return { ok: false, erro: CORPO_INVALIDO }
  const chaves = Object.keys(corpo)
  if (chaves.length === 0) return { ok: false, erro: 'Não há nada para atualizar.' }
  if (chaves.some(k => k !== 'status' && !(CAMPOS as readonly string[]).includes(k))) return { ok: false, erro: CAMPO_DESCONHECIDO }

  const mudanca: Record<string, unknown> = {}
  for (const chave of chaves) {
    if (chave === 'status') {
      if (corpo.status !== 'ativo' && corpo.status !== 'encerrado') return { ok: false, erro: 'O status precisa ser "ativo" ou "encerrado".' }
      mudanca.status = corpo.status
      continue
    }
    const r = lerCampo(chave as Campo, corpo[chave])
    if (!r.ok) return r
    mudanca[chave] = r.valor
  }
  return { ok: true, valor: mudanca as Partial<DadosDaFicha> & { status?: 'ativo' | 'encerrado' } }
}
