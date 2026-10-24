'use client'

import { useEffect, type ReactNode } from 'react'
import { iniciarPostHog } from '@/lib/posthog'

/** Liga o PostHog assim que o app abre. Sem chave configurada, não faz nada. Não envolve a tela em nenhum contexto. */
export default function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => { iniciarPostHog() }, [])
  return <>{children}</>
}
