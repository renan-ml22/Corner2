'use client'

import { useCallback, useMemo } from 'react'
import { lerBackup, montarBackup } from '@/lib/dados/backup'
import { CONFIG_PADRAO, type Configuracoes } from '@/lib/tipos'
import { useEntidade } from './useEntidade'
import { useRepositorio } from './useRepositorio'

/** Configurações do atleta e o backup dos dados. */
export function usePreferencias() {
  const repo = useRepositorio()
  const [configSalva, setConfig] = useEntidade(repo, 'config')
  const config = useMemo<Configuracoes>(() => ({ ...CONFIG_PADRAO, ...configSalva }), [configSalva])

  const atualizarConfig = useCallback((parcial: Partial<Configuracoes>) => {
    setConfig(prev => ({ ...prev, ...parcial }))
  }, [setConfig])

  // O backup lê os dados do repositório na hora de exportar: não precisa reagir a cada mudança.
  const exportarDados = useCallback(() => montarBackup({
    historico: repo.obter('historico'), plano: repo.obter('plano'), config: repo.obter('config'),
    checkins: repo.obter('checkins'), lesoes: repo.obter('lesoes'), pesos: repo.obter('pesos'), reag: repo.obter('reag'),
  }, new Date()), [repo])

  const importarDados = useCallback((texto: string): { ok: boolean; erro?: string } => {
    // lerBackup valida tudo antes de devolver: backup parcial ou corrompido não apaga dados bons.
    const r = lerBackup(texto)
    if (!r.ok) return { ok: false, erro: r.erro }
    repo.gravarVarias(r.dados)
    return { ok: true }
  }, [repo])

  return { config, atualizarConfig, exportarDados, importarDados }
}
