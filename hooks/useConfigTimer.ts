'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { CHAVE_DO_TIMER, CONFIG_PADRAO, configDeTexto, gravarConfig, type ConfigTimer } from '@/lib/timer'

// A configuração do Timer vive no localStorage deste aparelho (não vai para a conta: som e tempos são gosto do aparelho).
// Um pequeno "armazém" faz a tela ler o valor sem piscar e acompanhar mudanças feitas em outra aba.

const ouvintes = new Set<() => void>()
let textoVisto: string | null | undefined
let valorVisto: ConfigTimer = CONFIG_PADRAO
/** Para quando o aparelho não deixa gravar (navegação privada): a mudança vale até recarregar. */
let textoEmMemoria: string | null = null

function textoGuardado(): string | null {
  try {
    return window.localStorage.getItem(CHAVE_DO_TIMER) ?? textoEmMemoria
  } catch {
    return textoEmMemoria
  }
}

/** Mesmo texto, mesmo objeto: o React exige um valor estável entre leituras. */
function ler(): ConfigTimer {
  const texto = textoGuardado()
  if (texto !== textoVisto) {
    textoVisto = texto
    valorVisto = configDeTexto(texto)
  }
  return valorVisto
}

function assinar(aviso: () => void): () => void {
  ouvintes.add(aviso)
  const aoMudarEmOutraAba = (e: StorageEvent) => { if (e.key === CHAVE_DO_TIMER || e.key === null) aviso() }
  window.addEventListener('storage', aoMudarEmOutraAba)
  return () => {
    ouvintes.delete(aviso)
    window.removeEventListener('storage', aoMudarEmOutraAba)
  }
}

export function useConfigTimer(): [ConfigTimer, (parcial: Partial<ConfigTimer>) => void] {
  const config = useSyncExternalStore(assinar, ler, () => CONFIG_PADRAO)
  const alterar = useCallback((parcial: Partial<ConfigTimer>) => {
    const novo = configDeTexto(JSON.stringify({ ...ler(), ...parcial }))
    textoEmMemoria = JSON.stringify(novo)
    try {
      gravarConfig(window.localStorage, novo)
    } catch {
      // Sem armazenamento: fica só na memória.
    }
    ouvintes.forEach(aviso => aviso())
  }, [])
  return [config, alterar]
}
