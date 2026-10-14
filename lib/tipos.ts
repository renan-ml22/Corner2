export type RegType = 'tec' | 'con' | 'spa'

export const TIPOS: RegType[] = ['tec', 'con', 'spa']

export const CAT_LABELS: Record<RegType, string> = { tec: 'Técnica', con: 'Condicionamento', spa: 'Sparring' }

export const CAT_ICONS: Record<RegType, string> = { tec: 'ph-target', con: 'ph-heartbeat', spa: 'ph-boxing-glove' }

// ── Treinos ──────────────────────────────────────────────────

export type Intensidade = 'leve' | 'moderada' | 'forte'
export type ImpactoCabeca = 'nenhum' | 'leves' | 'fortes'

export const INTENSIDADE_LABEL: Record<Intensidade, string> = { leve: 'Leve', moderada: 'Moderada', forte: 'Forte' }
export const IMPACTO_LABEL: Record<ImpactoCabeca, string> = { nenhum: 'Nenhuma', leves: 'Leves', fortes: 'Fortes' }

export interface DetalhesSparring {
  intensidade: Intensidade
  /** Pancadas recebidas na cabeça durante o sparring */
  cabeca: ImpactoCabeca
  parceiro?: string
}

/** Treino registrado pelo usuário (persistido no localStorage). */
export interface WorkoutEntry {
  id: string
  /** Momento do registro, ISO 8601 */
  data: string
  tipo: RegType
  rounds: number
  minPorRound: number
  rpe: number
  /** Duração real quando feito com o cronômetro; senão, tempo gasto preenchendo o registro */
  duracaoSegundos: number
  /** Sessão do plano que originou o treino, quando houver */
  sessaoId?: string
  nota?: string
  sparring?: DetalhesSparring
}

// ── Plano e configurações ────────────────────────────────────

export interface PlanoAtivo {
  planoId: string
  /** Segunda-feira da semana 1 do plano, no formato YYYY-MM-DD */
  inicio: string
}

export type Postura = 'ortodoxo' | 'canhoto'
export type Experiencia = 'nenhuma' | 'ate1' | '1a3' | 'mais3'

export interface Configuracoes {
  metaSemanal: number
  notificacoes: boolean
  postura: Postura
  onboardingFeito: boolean
  experiencia: Experiencia | null
  /** Categoria de peso em kg, quando compete */
  pesoCategoria: number | null
  /** Horário do lembrete diário (HH:MM) ou vazio */
  lembreteHora: string
}

export const CONFIG_PADRAO: Configuracoes = {
  metaSemanal: 3,
  notificacoes: true,
  postura: 'ortodoxo',
  onboardingFeito: false,
  experiencia: null,
  pesoCategoria: null,
  lembreteHora: '',
}

/** Checklist do dia: os itens marcados valem só para a data indicada. */
export interface ChecklistDoDia {
  data: string
  itens: Record<string, boolean>
}

/** Ajuste de carga sugerido pelo check-in e aceito pelo usuário, válido só no dia. */
export interface AjusteDoDia {
  data: string
  aplicado: boolean
}

/** Sessões movidas de dia: chave `${semana}:${sessaoId}` → dia da semana (0 = domingo). */
export type Reagendamentos = Record<string, number>

// ── Saúde ────────────────────────────────────────────────────

/** Check-in diário: cada nota de 1 (pior) a 5 (melhor); em `dor`, 5 = muita dor. */
export interface Checkin {
  data: string
  sono: number
  dor: number
  energia: number
}

export type RegiaoCorpo = 'maos' | 'punhos' | 'ombros' | 'costas' | 'quadril' | 'joelhos' | 'tornozelos' | 'cabeca' | 'outra'

export const REGIOES: Record<RegiaoCorpo, string> = {
  maos: 'Mãos',
  punhos: 'Punhos',
  ombros: 'Ombros',
  costas: 'Costas',
  quadril: 'Quadril',
  joelhos: 'Joelhos',
  tornozelos: 'Tornozelos',
  cabeca: 'Cabeça / pescoço',
  outra: 'Outra região',
}

export interface Lesao {
  id: string
  regiao: RegiaoCorpo
  /** 1 (leve) a 5 (forte) */
  intensidade: number
  /** YYYY-MM-DD */
  inicio: string
  nota?: string
  /** YYYY-MM-DD quando resolvida */
  resolvidaEm?: string
}

export interface PesoRegistro {
  id: string
  /** YYYY-MM-DD */
  data: string
  kg: number
}

// ── Validadores (dados vindos do localStorage ou de backup importado) ─

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isChave = (v: unknown): v is string => isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v)

export function isRegType(v: unknown): v is RegType {
  return v === 'tec' || v === 'con' || v === 'spa'
}

export function isWorkoutEntry(v: unknown): v is WorkoutEntry {
  if (!isObj(v)) return false
  if (!(isStr(v.id) && isStr(v.data) && isRegType(v.tipo) && isNum(v.rounds) && isNum(v.minPorRound) && isNum(v.rpe) && isNum(v.duracaoSegundos))) return false
  if (v.sparring !== undefined && !(isObj(v.sparring) && isStr(v.sparring.intensidade) && isStr(v.sparring.cabeca))) return false
  return true
}

export function isCheckin(v: unknown): v is Checkin {
  return isObj(v) && isChave(v.data) && isNum(v.sono) && isNum(v.dor) && isNum(v.energia)
}

export function isLesao(v: unknown): v is Lesao {
  return isObj(v) && isStr(v.id) && isStr(v.regiao) && v.regiao in REGIOES && isNum(v.intensidade) && isChave(v.inicio)
}

export function isPesoRegistro(v: unknown): v is PesoRegistro {
  return isObj(v) && isStr(v.id) && isChave(v.data) && isNum(v.kg) && v.kg > 0
}

export function isArrayDe<T>(guarda: (v: unknown) => v is T) {
  return (v: unknown): v is T[] => Array.isArray(v) && v.every(guarda)
}
