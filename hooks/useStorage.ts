'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'

// Avisa os hooks desta aba quando uma chave muda (o evento 'storage' só dispara em outras abas).
const listeners = new Set<() => void>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  window.addEventListener('storage', cb)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', cb)
  }
}

function lerBruto(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null // modo privado, armazenamento bloqueado etc.
  }
}

function gravar(key: string, valor: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(valor))
  } catch {
    // Sem espaço ou bloqueado: o estado só não persiste.
  }
  listeners.forEach(l => l())
}

/**
 * Estado persistido no localStorage, sincronizado entre componentes e abas.
 *
 * - No servidor e na hidratação devolve `inicial` (sem erro de hidratação);
 *   em seguida passa a refletir o valor salvo.
 * - `validar` descarta dados corrompidos ou de versões antigas, caindo em `inicial`.
 */
export function useStorage<T>(
  key: string,
  inicial: T,
  validar?: (v: unknown) => v is T,
): [T, (valor: T | ((anterior: T) => T)) => void] {
  const bruto = useSyncExternalStore(subscribe, () => lerBruto(key), () => null)

  const valor = useMemo<T>(() => {
    if (bruto === null) return inicial
    try {
      const parsed: unknown = JSON.parse(bruto)
      if (validar && !validar(parsed)) return inicial
      return parsed as T
    } catch {
      return inicial
    }
    // `inicial` e `validar` são tratados como constantes por chave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bruto])

  const setValor = useCallback((novo: T | ((anterior: T) => T)) => {
    let atual = inicial
    const raw = lerBruto(key)
    if (raw !== null) {
      try {
        const parsed: unknown = JSON.parse(raw)
        if (!validar || validar(parsed)) atual = parsed as T
      } catch { /* mantém inicial */ }
    }
    const proximo = typeof novo === 'function' ? (novo as (anterior: T) => T)(atual) : novo
    gravar(key, proximo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return [valor, setValor]
}

/** `true` só depois da hidratação no cliente — útil para não piscar dados vazios. */
export function useHidratado(): boolean {
  return useSyncExternalStore(() => () => {}, () => true, () => false)
}
