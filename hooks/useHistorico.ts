'use client'

import { useCallback } from 'react'
import { track } from '@/lib/posthog'
import type { WorkoutEntry } from '@/lib/tipos'
import { useEntidade } from './useEntidade'
import { useRepositorio } from './useRepositorio'

/** Treinos registrados, do mais recente para o mais antigo. */
export function useHistorico() {
  const repo = useRepositorio()
  const [historico, setHistorico] = useEntidade(repo, 'historico')
  const adicionarTreino = useCallback((entrada: WorkoutEntry) => {
    setHistorico(prev => [entrada, ...prev])
    // Só o resumo do treino: nunca nota, parceiro, pancada na cabeça nem a data.
    track('workout_registered', { tipo: entrada.tipo, rounds: entrada.rounds, rpe: entrada.rpe, duracao_segundos: entrada.duracaoSegundos })
  }, [setHistorico])
  return { historico, adicionarTreino }
}
