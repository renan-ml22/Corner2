'use client'

import { useMemo, useSyncExternalStore } from 'react'
import { criarFonte } from '@/lib/dados/fonte'
import type { DadosDoApp, NomeEntidade } from '@/lib/dados/entidades'
import type { Repositorio } from '@/lib/dados/repositorio'

/**
 * Estado de uma entidade guardada no repositório, sincronizado entre componentes e abas.
 *
 * - No servidor e na hidratação devolve o valor inicial (sem erro de hidratação);
 *   em seguida passa a refletir o valor salvo.
 * - Quem usa não conhece chaves nem o armazenamento: só o repositório.
 */
export function useEntidade<N extends NomeEntidade>(
  repo: Repositorio,
  nome: N,
): [DadosDoApp[N], (novo: DadosDoApp[N] | ((anterior: DadosDoApp[N]) => DadosDoApp[N])) => void] {
  const fonte = useMemo(() => criarFonte(repo, nome), [repo, nome])
  const valor = useSyncExternalStore(fonte.assinar, fonte.obter, fonte.obterNoServidor)
  return [valor, fonte.definir]
}

/** `true` só depois da hidratação no cliente: útil para não piscar dados vazios. */
export function useHidratado(): boolean {
  return useSyncExternalStore(() => () => {}, () => true, () => false)
}
