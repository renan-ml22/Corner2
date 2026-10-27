'use client'

import { useEntidade } from './useEntidade'
import { useRepositorio } from './useRepositorio'

/** Foto de perfil do usuário (`data:image/jpeg;base64,…`) e como trocá-la. Texto vazio = sem foto. */
export function useFoto(): [string, (nova: string) => void] {
  const repo = useRepositorio()
  return useEntidade(repo, 'foto')
}
