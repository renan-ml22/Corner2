'use client'

import { useCallback, useMemo } from 'react'
import { chaveDia } from '@/lib/datas'
import { checkinDeHoje, gerarAlertas } from '@/lib/saude'
import { novoId } from '@/lib/id'
import type { Checkin, RegiaoCorpo } from '@/lib/tipos'
import { useEntidade, useHidratado } from './useEntidade'
import { useHistorico } from './useHistorico'
import { useSessaoDeHoje } from './usePlano'
import { usePreferencias } from './usePreferencias'
import { useRepositorio } from './useRepositorio'

/** Check-in diário e o ajuste de carga que ele sugere. */
export function useCheckins() {
  const repo = useRepositorio()
  const pronto = useHidratado()
  const [checkins, setCheckins] = useEntidade(repo, 'checkins')
  const [ajuste, setAjuste] = useEntidade(repo, 'ajuste')

  const hojeKey = pronto ? chaveDia(new Date()) : ''
  const checkinHoje = useMemo(() => (pronto ? checkinDeHoje(checkins, new Date()) : null), [pronto, checkins])
  const ajusteAplicado = ajuste.data === hojeKey && ajuste.aplicado

  const registrarCheckin = useCallback((valores: Omit<Checkin, 'data'>) => {
    const data = chaveDia(new Date())
    setCheckins(prev => [{ data, ...valores }, ...prev.filter(c => c.data !== data)].slice(0, 120))
    setAjuste({ data, aplicado: false }) // novo check-in = novo ajuste a decidir
  }, [setCheckins, setAjuste])

  const aplicarAjuste = useCallback((aplicar: boolean) => {
    setAjuste({ data: chaveDia(new Date()), aplicado: aplicar })
  }, [setAjuste])

  return { checkins, checkinHoje, registrarCheckin, ajusteAplicado, aplicarAjuste }
}

export function useLesoes() {
  const repo = useRepositorio()
  const [lesoes, setLesoes] = useEntidade(repo, 'lesoes')

  const adicionarLesao = useCallback((l: { regiao: RegiaoCorpo; intensidade: number; nota?: string }) => {
    const nota = l.nota?.trim().slice(0, 200)
    setLesoes(prev => [{ id: novoId(), regiao: l.regiao, intensidade: l.intensidade, inicio: chaveDia(new Date()), ...(nota ? { nota } : {}) }, ...prev])
  }, [setLesoes])

  const resolverLesao = useCallback((id: string) => {
    const hoje = chaveDia(new Date())
    setLesoes(prev => prev.map(l => (l.id === id ? { ...l, resolvidaEm: hoje } : l)))
  }, [setLesoes])

  const removerLesao = useCallback((id: string) => setLesoes(prev => prev.filter(l => l.id !== id)), [setLesoes])

  return { lesoes, adicionarLesao, resolverLesao, removerLesao }
}

export function usePesos() {
  const repo = useRepositorio()
  const [pesos, setPesos] = useEntidade(repo, 'pesos')

  const registrarPeso = useCallback((kg: number) => {
    const data = chaveDia(new Date())
    setPesos(prev => [...prev.filter(p => p.data !== data), { id: novoId(), data, kg }].sort((a, b) => a.data.localeCompare(b.data)).slice(-400))
  }, [setPesos])

  const removerPeso = useCallback((id: string) => setPesos(prev => prev.filter(p => p.id !== id)), [setPesos])

  return { pesos, registrarPeso, removerPeso }
}

/** Alertas calculados a partir do histórico, das lesões, da sessão de hoje e da meta semanal. */
export function useAlertas() {
  const pronto = useHidratado()
  const { historico } = useHistorico()
  const { lesoes } = useLesoes()
  const { config } = usePreferencias()
  const sessaoHoje = useSessaoDeHoje()

  return useMemo(
    () => (pronto
      ? gerarAlertas({ historico, lesoes, sessaoHojeTipo: sessaoHoje && sessaoHoje.status !== 'feita' ? sessaoHoje.sessao.tipo : null, metaSemanal: config.metaSemanal, hoje: new Date() })
      : []),
    [pronto, historico, lesoes, sessaoHoje, config.metaSemanal],
  )
}
