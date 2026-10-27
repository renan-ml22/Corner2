// Resumo e gráfico semanal dos treinos de um aluno, para a aba "Treinos" da ficha. Puro: sem rede e sem relógio.
// As semanas vão de segunda a domingo, no fuso do aparelho de quem olha.

import { chaveDia, formatarDataCurta, inicioDaSemana, somarDias } from '@/lib/datas'
import type { RegType } from '@/lib/tipos'
import type { TreinoDoAluno } from './aluno-dados'

export type FiltroDeTipo = RegType | 'todos'

export const SEMANAS_NO_GRAFICO = 5

export interface ResumoDosTreinos {
  total: number
  /** Soma de rounds × minutos por round */
  minutos: number
  /** Média do esforço (1 a 10) com uma casa; `null` sem treino */
  rpeMedio: number | null
}

export interface SemanaDoGrafico {
  /** Segunda-feira da semana, YYYY-MM-DD */
  inicio: string
  /** Ex.: "26 de out" */
  rotulo: string
  total: number
}

export const filtrarTreinos = (treinos: readonly TreinoDoAluno[], filtro: FiltroDeTipo): TreinoDoAluno[] =>
  filtro === 'todos' ? [...treinos] : treinos.filter(t => t.tipo === filtro)

export function resumoDosTreinos(treinos: readonly TreinoDoAluno[], filtro: FiltroDeTipo): ResumoDosTreinos {
  const lista = filtrarTreinos(treinos, filtro)
  if (lista.length === 0) return { total: 0, minutos: 0, rpeMedio: null }
  const minutos = lista.reduce((soma, t) => soma + t.rounds * t.minPorRound, 0)
  const rpe = lista.reduce((soma, t) => soma + t.rpe, 0) / lista.length
  return { total: lista.length, minutos: Math.round(minutos), rpeMedio: Math.round(rpe * 10) / 10 }
}

/** Treinos por semana, da mais antiga para a de `hoje`. Cobre os 30 dias de histórico (5 semanas). */
export function treinosPorSemana(treinos: readonly TreinoDoAluno[], hoje: Date, filtro: FiltroDeTipo): SemanaDoGrafico[] {
  const atual = inicioDaSemana(hoje)
  const semanas = Array.from({ length: SEMANAS_NO_GRAFICO }, (_, i) => {
    const segunda = somarDias(atual, (i - (SEMANAS_NO_GRAFICO - 1)) * 7)
    return { inicio: chaveDia(segunda), rotulo: formatarDataCurta(segunda), total: 0 }
  })
  for (const t of filtrarTreinos(treinos, filtro)) {
    const semana = semanas.find(s => s.inicio === chaveDia(inicioDaSemana(new Date(t.data))))
    if (semana) semana.total++
  }
  return semanas
}
