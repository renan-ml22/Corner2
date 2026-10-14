// Regras do perfil de atleta (painel de onboarding): que plano recomendar e qual meta semanal propor.

import { PLANOS, getPlano, type Plano } from '@/data/planos'
import type { Experiencia } from '@/lib/tipos'

export type Objetivo = 'condicionamento' | 'tecnica' | 'competir'

export const OBJETIVOS: Objetivo[] = ['condicionamento', 'tecnica', 'competir']

export function recomendarPlano(experiencia: Experiencia, objetivo: Objetivo): Plano {
  const id =
    experiencia === 'nenhuma' || experiencia === 'ate1' ? 'fundamentos'
    : objetivo === 'condicionamento' ? 'base-aerobica'
    : experiencia === 'mais3' && objetivo === 'competir' ? 'pre-competicao'
    : 'tecnica-avancada'
  return getPlano(id) ?? PLANOS[0]
}

/** Meta semanal inicial: os dias que o atleta consegue treinar, limitados ao que o plano pede. */
export function metaInicial(diasDisponiveis: number, plano: Plano): number {
  return Math.min(diasDisponiveis, plano.diasPorSemana)
}
