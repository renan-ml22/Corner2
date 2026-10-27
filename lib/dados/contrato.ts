// Contrato de dados do Corner: o que é um registro válido de cada entidade.
//
// Fonte única, usada pelo armazenamento do aparelho, pelo backup e (no futuro) por uma API.
// Os validadores são estritos: só aceitam o que o app realmente produz. A leitura é que é
// tolerante (veja `limparLista` e `limparConfig`): um item ruim não derruba os outros.

import { getPlano } from '@/data/planos'
import { isEstadoAssinatura, type EstadoAssinatura } from '@/lib/assinatura/regras'
import { respostasValidas } from '@/lib/quiz'
import {
  REGIOES, isRegType,
  type AjusteDoDia, type Checkin, type ChecklistDoDia, type Configuracoes, type Lesao,
  type PesoRegistro, type PlanoAtivo, type Reagendamentos, type WorkoutEntry,
} from '@/lib/tipos'

// ── Primitivos ───────────────────────────────────────────────

export const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
export const isStr = (v: unknown): v is string => typeof v === 'string'

const entre = (v: unknown, min: number, max: number): v is number => isNum(v) && v >= min && v <= max
const naoNegativo = (v: unknown): v is number => isNum(v) && v >= 0

/** Data YYYY-MM-DD que existe no calendário ("2026-02-31" não vale). */
export function isChave(v: unknown): v is string {
  if (!isStr(v) || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const [a, m, d] = v.split('-').map(Number)
  const data = new Date(Date.UTC(a, m - 1, d))
  return data.getUTCFullYear() === a && data.getUTCMonth() === m - 1 && data.getUTCDate() === d
}

/** Instante ISO 8601 ("2026-10-14T15:30:00.000Z"). */
const isInstante = (v: unknown): v is string => isStr(v) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) && Number.isFinite(Date.parse(v))

const opcional = <T>(v: unknown, guarda: (x: unknown) => x is T): boolean => v === undefined || guarda(v)

// ── Listas ───────────────────────────────────────────────────

/** Validador de lista: todos os itens precisam ser válidos. */
export function isArrayDe<T>(guarda: (v: unknown) => v is T) {
  return (v: unknown): v is T[] => Array.isArray(v) && v.every(guarda)
}

/** Leitura tolerante de lista: descarta só os itens inválidos. `null` quando nem é uma lista. */
export function limparLista<T>(guarda: (v: unknown) => v is T) {
  return (v: unknown): T[] | null => (Array.isArray(v) ? v.filter(guarda) : null)
}

// ── Treinos ──────────────────────────────────────────────────

const INTENSIDADES = ['leve', 'moderada', 'forte']
const IMPACTOS = ['nenhum', 'leves', 'fortes']

export function isWorkoutEntry(v: unknown): v is WorkoutEntry {
  if (!isObj(v)) return false
  if (!(isStr(v.id) && isInstante(v.data) && isRegType(v.tipo))) return false
  if (!(naoNegativo(v.rounds) && naoNegativo(v.minPorRound) && entre(v.rpe, 1, 10) && naoNegativo(v.duracaoSegundos))) return false
  if (!opcional(v.sessaoId, isStr) || !opcional(v.nota, isStr)) return false
  if (v.sparring !== undefined) {
    const s = v.sparring
    if (!(isObj(s) && isStr(s.intensidade) && INTENSIDADES.includes(s.intensidade) && isStr(s.cabeca) && IMPACTOS.includes(s.cabeca) && opcional(s.parceiro, isStr))) return false
  }
  return true
}

// ── Saúde ────────────────────────────────────────────────────

export function isCheckin(v: unknown): v is Checkin {
  return isObj(v) && isChave(v.data) && entre(v.sono, 1, 5) && entre(v.dor, 1, 5) && entre(v.energia, 1, 5)
}

export function isLesao(v: unknown): v is Lesao {
  return isObj(v) && isStr(v.id) && isStr(v.regiao) && Object.hasOwn(REGIOES, v.regiao) && entre(v.intensidade, 1, 5)
    && isChave(v.inicio) && opcional(v.nota, isStr) && opcional(v.resolvidaEm, isChave)
}

export function isPesoRegistro(v: unknown): v is PesoRegistro {
  return isObj(v) && isStr(v.id) && isChave(v.data) && isNum(v.kg) && v.kg > 0
}

// ── Plano, configurações e estado do dia ─────────────────────

export function isPlanoAtivo(v: unknown): v is PlanoAtivo | null {
  if (v === null) return true
  return isObj(v) && isStr(v.planoId) && getPlano(v.planoId) !== null && isChave(v.inicio)
}

const CAMPOS_CONFIG: { [K in keyof Configuracoes]: (v: unknown) => boolean } = {
  metaSemanal: v => entre(v, 1, 7),
  notificacoes: v => typeof v === 'boolean',
  postura: v => v === 'ortodoxo' || v === 'canhoto',
  onboardingFeito: v => typeof v === 'boolean',
  experiencia: v => v === null || v === 'nenhuma' || v === 'ate1' || v === '1a3' || v === 'mais3',
  pesoCategoria: v => v === null || entre(v, 30, 250),
  lembreteHora: v => v === '' || (isStr(v) && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)),
}

export function isConfigParcial(v: unknown): v is Partial<Configuracoes> {
  if (!isObj(v)) return false
  return Object.entries(CAMPOS_CONFIG).every(([campo, ok]) => v[campo] === undefined || ok(v[campo]))
}

/** Leitura tolerante das configurações: mantém os campos válidos e descarta os outros. */
export function limparConfig(v: unknown): Partial<Configuracoes> | null {
  if (!isObj(v)) return null
  const limpo: Record<string, unknown> = {}
  for (const [campo, ok] of Object.entries(CAMPOS_CONFIG)) {
    if (v[campo] !== undefined && ok(v[campo])) limpo[campo] = v[campo]
  }
  return limpo as Partial<Configuracoes>
}

export const isChecklist = (v: unknown): v is ChecklistDoDia =>
  isObj(v) && isStr(v.data) && isObj(v.itens) && Object.values(v.itens).every(x => typeof x === 'boolean')

export const isAjuste = (v: unknown): v is AjusteDoDia => isObj(v) && isStr(v.data) && typeof v.aplicado === 'boolean'

export const isReag = (v: unknown): v is Reagendamentos =>
  isObj(v) && Object.values(v).every(x => isNum(x) && Number.isInteger(x) && x >= 0 && x <= 6)

/** Último estado da assinatura que o servidor informou, com a hora da consulta (cópia local, só para a tela abrir certa). */
export interface AssinaturaGuardada { estado: EstadoAssinatura; em: string }
export const isAssinaturaGuardada = (v: unknown): v is AssinaturaGuardada | null =>
  v === null || (isObj(v) && isEstadoAssinatura(v.estado) && isStr(v.em))

/** Maior foto de perfil aceita, em caracteres do texto `data:image/jpeg;base64,…`. Uma foto de 200×200 tem uns 14 000. */
export const TAMANHO_MAX_DA_FOTO = 60_000

/** Foto de perfil: JPEG em `data:` estrito, ou vazio para "sem foto" (o banco não aceita nulo nessa coluna). */
export const isFoto = (v: unknown): v is string =>
  v === '' || (isStr(v) && v.length <= TAMANHO_MAX_DA_FOTO && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(v))

/** Respostas do quiz de estilo guardadas (um dígito por pergunta, ex.: `00020`), ou vazio para "ainda não fez o quiz". */
export const isQuiz = (v: unknown): v is string => v === '' || (isStr(v) && /^\d+$/.test(v) && respostasValidas([...v].map(Number)))

/** Data do último lembrete disparado (ou vazio). */
export const isLembrete = (v: unknown): v is string => v === '' || isChave(v)
