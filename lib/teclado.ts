// Teclado em grupos de opções (rádio e abas): as setas movem o foco e a seleção, como no padrão ARIA.

import type { KeyboardEvent } from 'react'

/** Índice do item que deve receber o foco, ou `null` se a tecla não move nada. */
export function proximoIndice(atual: number, total: number, tecla: string): number | null {
  if (total <= 0 || atual < 0 || atual >= total) return null
  switch (tecla) {
    case 'ArrowRight':
    case 'ArrowDown': return (atual + 1) % total
    case 'ArrowLeft':
    case 'ArrowUp': return (atual - 1 + total) % total
    case 'Home': return 0
    case 'End': return total - 1
    default: return null
  }
}

/**
 * Para o `onKeyDown` do contêiner de um grupo de `role="radio"` ou `role="tab"`.
 * A seleção acompanha o foco (clica no item que recebeu o foco).
 */
export function aoTeclarNoGrupo(e: KeyboardEvent<HTMLElement>, papel: 'radio' | 'tab') {
  const itens = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(`[role="${papel}"]:not([disabled])`))
  const alvo = proximoIndice(itens.indexOf(document.activeElement as HTMLElement), itens.length, e.key)
  if (alvo === null) return
  e.preventDefault()
  itens[alvo].focus()
  itens[alvo].click()
}
