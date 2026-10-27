'use client'

import { useEntidade } from './useEntidade'
import { useRepositorio } from './useRepositorio'

/** Respostas do quiz de estilo guardadas (`00020`) e como trocá-las. Texto vazio = ainda não fez o quiz. */
export function useQuiz(): [string, (novas: string) => void] {
  const repo = useRepositorio()
  return useEntidade(repo, 'quiz')
}
