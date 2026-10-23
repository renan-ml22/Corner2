'use client'

import { useSyncExternalStore } from 'react'
import type { EstadoDaSincronia } from '@/lib/dados/repositorio-sincronizado'
import { useRepositorioSincronizado } from './useRepositorio'

/** Estado da sincronização com a conta na nuvem. No servidor e na hidratação: `desligada` (nada aparece até o cliente carregar). */
export function useSincronia(): EstadoDaSincronia {
  const repo = useRepositorioSincronizado()
  return useSyncExternalStore(repo.assinarSincronia, repo.estadoDaSincronia, () => 'desligada')
}
