'use client'

import type { ReactNode } from 'react'
import { RepositorioProvider, type UsuarioApp } from '@/hooks/useRepositorio'
import { ToastProvider } from '@/hooks/useToast'
import LembreteDiario from './LembreteDiario'
import { PainelProvider } from './PainelProvider'

/**
 * Monta o que o app precisa por baixo das telas. Não guarda dados: cada assunto tem o seu hook.
 *
 * - dados: `useHistorico`, `usePlano`, `usePreferencias`, `useCheckins`, `useLesoes`, `usePesos`, `useAlertas`
 * - painéis e formulário de registro: `usePainelAcoes` e `usePainelEstado`
 * - aviso rápido: `useToast`
 */
export function CornerProvider({ usuario, children }: { usuario: UsuarioApp; children: ReactNode }) {
  return (
    <RepositorioProvider usuario={usuario}>
      <ToastProvider>
        <PainelProvider>
          {children}
          <LembreteDiario />
        </PainelProvider>
      </ToastProvider>
    </RepositorioProvider>
  )
}
