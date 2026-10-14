'use client'

import { useEffect, useRef, type RefObject } from 'react'

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focaveis(raiz: HTMLElement): HTMLElement[] {
  return Array.from(raiz.querySelectorAll<HTMLElement>(FOCAVEIS)).filter(el => el.getClientRects().length > 0)
}

/** Torna inerte (sem foco, sem leitor de tela) tudo o que está fora do diálogo. Devolve a função que desfaz. */
function inertarTudoFora(dialogo: HTMLElement): () => void {
  const alterados: Element[] = []
  let atual: HTMLElement | null = dialogo
  while (atual && atual !== document.body) {
    const pai: HTMLElement | null = atual.parentElement
    if (!pai) break
    for (const irmao of Array.from(pai.children)) {
      if (irmao === atual || irmao.hasAttribute('inert') || ['SCRIPT', 'STYLE', 'LINK'].includes(irmao.tagName)) continue
      irmao.setAttribute('inert', '')
      alterados.push(irmao)
    }
    atual = pai
  }
  return () => alterados.forEach(el => el.removeAttribute('inert'))
}

/**
 * Comportamento de teclado e foco de um diálogo modal:
 * leva o foco para dentro ao abrir, fecha com Esc, mantém Tab/Shift+Tab circulando dentro dele
 * e deixa o resto da página inerte enquanto ele está aberto.
 */
export function useDialogo(ref: RefObject<HTMLElement | null>, aoFechar: () => void) {
  const fecharRef = useRef(aoFechar)
  useEffect(() => { fecharRef.current = aoFechar })

  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo) return
    const desfazerInerte = inertarTudoFora(dialogo)
    dialogo.focus({ preventScroll: true })

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        fecharRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const itens = focaveis(dialogo)
      if (itens.length === 0) { e.preventDefault(); dialogo.focus(); return }
      const primeiro = itens[0]
      const ultimo = itens[itens.length - 1]
      const ativo = document.activeElement
      if (!dialogo.contains(ativo)) { e.preventDefault(); primeiro.focus(); return }
      if (e.shiftKey && (ativo === primeiro || ativo === dialogo)) { e.preventDefault(); ultimo.focus() }
      else if (!e.shiftKey && ativo === ultimo) { e.preventDefault(); primeiro.focus() }
    }
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      desfazerInerte()
    }
  }, [ref])
}
