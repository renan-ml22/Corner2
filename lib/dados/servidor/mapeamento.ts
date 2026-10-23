// Tradução entre os dados do app e as linhas das tabelas do Supabase (veja supabase/schema.sql).
//
// Funções puras, sem rede. Toda linha lida do banco passa pelo mesmo validador do app (contrato.ts):
// uma linha corrompida é descartada, nunca derruba a tela, e o que sai daqui é sempre um dado válido.

import { getPlano } from '@/data/planos'
import { nivelDaExperiencia } from '@/lib/onboarding'
import { isObj, isPlanoAtivo, isWorkoutEntry, limparConfig } from '../contrato'
import type { Configuracoes, PlanoAtivo, WorkoutEntry } from '@/lib/tipos'

// ── Treinos: tabela workouts ─────────────────────────────────

export interface LinhaTreino {
  id: string
  date: string
  type: string
  rounds: number
  round_min: number
  rpe: number
  duration_seconds: number
  session_id: string | null
  note: string | null
  sparring_intensity: string | null
  sparring_head: string | null
  sparring_partner: string | null
}

export function treinoParaLinha(e: WorkoutEntry): LinhaTreino {
  return {
    id: e.id,
    date: e.data,
    type: e.tipo,
    rounds: e.rounds,
    round_min: e.minPorRound,
    rpe: e.rpe,
    duration_seconds: e.duracaoSegundos,
    session_id: e.sessaoId ?? null,
    note: e.nota ?? null,
    sparring_intensity: e.sparring?.intensidade ?? null,
    sparring_head: e.sparring?.cabeca ?? null,
    sparring_partner: e.sparring?.parceiro ?? null,
  }
}

/** O banco pode devolver `numeric` como texto; qualquer outra coisa segue para o validador, que recusa. */
const numero = (v: unknown): unknown => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v)

export function linhaParaTreino(l: LinhaTreino): WorkoutEntry | null {
  if (!isObj(l)) return null
  const instante = typeof l.date === 'string' ? Date.parse(l.date) : NaN
  if (!Number.isFinite(instante)) return null

  const candidato: Record<string, unknown> = {
    id: l.id,
    data: new Date(instante).toISOString(), // o banco devolve "+00:00"; o app sempre usou "Z"
    tipo: l.type,
    rounds: numero(l.rounds),
    minPorRound: numero(l.round_min),
    rpe: numero(l.rpe),
    duracaoSegundos: numero(l.duration_seconds),
  }
  if (l.session_id != null) candidato.sessaoId = l.session_id
  if (l.note != null) candidato.nota = l.note
  if (l.sparring_intensity != null || l.sparring_head != null) {
    candidato.sparring = {
      intensidade: l.sparring_intensity,
      cabeca: l.sparring_head,
      ...(l.sparring_partner != null ? { parceiro: l.sparring_partner } : {}),
    }
  }
  return isWorkoutEntry(candidato) ? candidato : null
}

// ── Configurações: tabela profiles ───────────────────────────

export interface LinhaPerfil {
  name: string | null
  level: string | null
  days_per_week: number | null
  /** As configurações completas, tal como o app as guarda: é daqui que elas são lidas. */
  settings: Record<string, unknown>
}

/**
 * `level` (iniciante, intermediario ou avancado) e `days_per_week` resumem dois campos de `settings` para ficarem
 * legíveis no painel do Supabase. São só de escrita: o app lê as configurações sempre de `settings`.
 */
export function configParaPerfil(cfg: Partial<Configuracoes>, nome: string): LinhaPerfil {
  return { name: nome, level: nivelDaExperiencia(cfg.experiencia), days_per_week: cfg.metaSemanal ?? null, settings: { ...cfg } }
}

export function perfilParaConfig(l: LinhaPerfil): Partial<Configuracoes> {
  return limparConfig(isObj(l) ? l.settings : null) ?? {}
}

// ── Plano ativo: tabela active_plans ─────────────────────────

export interface LinhaPlano {
  plan_id: string
  started_at: string
}

export const planoParaLinha = (p: PlanoAtivo): LinhaPlano => ({ plan_id: p.planoId, started_at: p.inicio })

/** Plano que o app não conhece mais, ou data impossível, vira "sem plano". */
export function linhaParaPlano(l: LinhaPlano | null): PlanoAtivo | null {
  if (!isObj(l) || typeof l.plan_id !== 'string' || typeof l.started_at !== 'string') return null
  if (getPlano(l.plan_id) === null) return null
  const candidato = { planoId: l.plan_id, inicio: l.started_at.slice(0, 10) }
  return isPlanoAtivo(candidato) ? candidato : null
}
