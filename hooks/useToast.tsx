'use client'

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

// Dois contextos de propósito: quem só dispara o aviso (`useToast`) não re-renderiza quando o texto muda.
const AcaoContext = createContext<((msg: string) => void) | null>(null)
const TextoContext = createContext<string | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast(msg)
    timerRef.current = setTimeout(() => setToast(null), 2200)
  }, [])

  return (
    <AcaoContext.Provider value={showToast}>
      <TextoContext.Provider value={toast}>{children}</TextoContext.Provider>
    </AcaoContext.Provider>
  )
}

/** Dispara um aviso rápido na tela. A função devolvida é estável. */
export function useToast(): (msg: string) => void {
  const showToast = useContext(AcaoContext)
  if (!showToast) throw new Error('useToast precisa estar dentro do CornerProvider')
  return showToast
}

/** Texto do aviso em exibição (ou `null`). Só o componente que desenha o aviso precisa disto. */
export const useToastTexto = (): string | null => useContext(TextoContext)
