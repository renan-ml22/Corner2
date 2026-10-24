'use client'

import { useSyncExternalStore } from 'react'

// Se o Timer está contando agora. A barra de baixo lê isto para pedir confirmação antes de sair da tela
// (o aviso do navegador, `beforeunload`, não dispara quando a navegação é interna do app).

let andando = false
const ouvintes = new Set<() => void>()

export function definirTimerAndando(valor: boolean): void {
  if (andando === valor) return
  andando = valor
  ouvintes.forEach(aviso => aviso())
}

export const timerEstaAndando = (): boolean => andando

export function useTimerAndando(): boolean {
  return useSyncExternalStore(
    aviso => { ouvintes.add(aviso); return () => { ouvintes.delete(aviso) } },
    () => andando,
    () => false,
  )
}
