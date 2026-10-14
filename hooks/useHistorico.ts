'use client'

import { useCallback } from 'react'
import type { WorkoutEntry } from '@/lib/tipos'
import { useEntidade } from './useEntidade'
import { useRepositorio } from './useRepositorio'

/** Treinos registrados, do mais recente para o mais antigo. */
export function useHistorico() {
  const repo = useRepositorio()
  const [historico, setHistorico] = useEntidade(repo, 'historico')
  const adicionarTreino = useCallback((entrada: WorkoutEntry) => setHistorico(prev => [entrada, ...prev]), [setHistorico])
  return { historico, adicionarTreino }
}
