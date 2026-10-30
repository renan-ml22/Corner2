'use client'

import { useCallback, useEffect, useRef } from 'react'
import { criarSegundoPlano, type SegundoPlano } from '@/lib/segundo-plano'

const TITULO = 'Corner · Timer'

interface Opcoes {
  /** A opção "manter o som com a tela bloqueada" está ligada */
  ligado: boolean
  /** O timer está rodando ou pausado (começou e ainda não acabou) */
  andando: boolean
  /** Rodando (e não pausado) */
  tocando: boolean
  /** O texto do controle de mídia, por exemplo "Round 2 de 5" */
  detalhe: string
  pausar: () => void
  retomar: () => void
}

/**
 * Mantém o áudio vivo com a tela bloqueada (lib/segundo-plano.ts) enquanto o timer anda. `ligar` precisa ser chamado
 * dentro do toque em INICIAR: o iPhone só libera o áudio de dentro de um toque.
 */
export function useSegundoPlano({ ligado, andando, tocando, detalhe, pausar, retomar }: Opcoes): { ligar: () => void } {
  const sp = useRef<SegundoPlano | null>(null)
  // Os botões da tela de bloqueio chamam a versão mais nova de pausar/retomar e mostram o texto mais novo.
  const atual = useRef({ pausar, retomar, tocando, detalhe })
  useEffect(() => { atual.current = { pausar, retomar, tocando, detalhe } })

  const ligar = useCallback(() => {
    if (!ligado) return
    sp.current ??= criarSegundoPlano()
    const a = atual.current
    sp.current.ligar({ pausar: () => atual.current.pausar(), retomar: () => atual.current.retomar() }, { titulo: TITULO, detalhe: a.detalhe, tocando: a.tocando })
  }, [ligado])

  useEffect(() => {
    if (andando) sp.current?.atualizar({ titulo: TITULO, detalhe, tocando })
    else sp.current?.desligar()
  }, [andando, detalhe, tocando])

  useEffect(() => () => sp.current?.desligar(), [])

  return { ligar }
}
