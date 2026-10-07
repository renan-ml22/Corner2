export type RegType = 'tec' | 'con' | 'spa'

export const TIPOS: RegType[] = ['tec', 'con', 'spa']

export const CAT_LABELS: Record<RegType, string> = { tec: 'Técnica', con: 'Condicionamento', spa: 'Sparring' }

export const CAT_ICONS: Record<RegType, string> = { tec: 'ph-target', con: 'ph-heartbeat', spa: 'ph-boxing-glove' }

/** Treino registrado pelo usuário (persistido no localStorage). */
export interface WorkoutEntry {
  id: string
  /** Momento do registro, ISO 8601 */
  data: string
  tipo: RegType
  rounds: number
  minPorRound: number
  rpe: number
  /** Tempo entre abrir o registro e salvar (o `elapsed` do fluxo de registro) */
  duracaoSegundos: number
}

export interface PlanoAtivo {
  planoId: string
  /** Segunda-feira da semana 1 do plano, no formato YYYY-MM-DD */
  inicio: string
}

export interface Configuracoes {
  metaSemanal: number
  notificacoes: boolean
}

export const CONFIG_PADRAO: Configuracoes = { metaSemanal: 3, notificacoes: true }

/** Checklist do dia: os itens marcados valem só para a data indicada. */
export interface ChecklistDoDia {
  data: string
  itens: Record<string, boolean>
}

export function isRegType(v: unknown): v is RegType {
  return v === 'tec' || v === 'con' || v === 'spa'
}

export function isWorkoutEntry(v: unknown): v is WorkoutEntry {
  if (typeof v !== 'object' || v === null) return false
  const e = v as Record<string, unknown>
  return typeof e.id === 'string' && typeof e.data === 'string' && isRegType(e.tipo)
    && typeof e.rounds === 'number' && typeof e.minPorRound === 'number'
    && typeof e.rpe === 'number' && typeof e.duracaoSegundos === 'number'
}
