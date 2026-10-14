'use client'

import { useCallback, useMemo } from 'react'
import { getPlano } from '@/data/planos'
import { chaveDia, inicioDaSemana } from '@/lib/datas'
import { ENTIDADES } from '@/lib/dados/entidades'
import type { RegType } from '@/lib/tipos'
import { chaveReagendamento, sessaoDeHoje } from '@/lib/treinos'
import { useEntidade, useHidratado } from './useEntidade'
import { useHistorico } from './useHistorico'
import { useRepositorio } from './useRepositorio'

const ITENS_VAZIOS = ENTIDADES.checklist.inicial.itens

/** Plano ativo, sessões reagendadas e o checklist do dia. */
export function usePlano() {
  const repo = useRepositorio()
  const pronto = useHidratado()
  const [planoAtivo, setPlanoAtivo] = useEntidade(repo, 'plano')
  const [reag, setReag] = useEntidade(repo, 'reag')
  const [checklist, setChecklist] = useEntidade(repo, 'checklist')

  const plano = useMemo(() => getPlano(planoAtivo?.planoId), [planoAtivo])
  const hojeKey = pronto ? chaveDia(new Date()) : ''
  // O que é "do dia" só vale na data em que foi marcado.
  const checklistHoje = checklist.data === hojeKey ? checklist.itens : ITENS_VAZIOS

  const escolherPlano = useCallback((planoId: string) => {
    // A semana 1 do plano é a semana atual (a partir de segunda). Trocar de plano zera os reagendamentos.
    setPlanoAtivo({ planoId, inicio: chaveDia(inicioDaSemana(new Date())) })
    setReag({})
  }, [setPlanoAtivo, setReag])

  const encerrarPlano = useCallback(() => {
    setPlanoAtivo(null)
    setReag({})
  }, [setPlanoAtivo, setReag])

  const reagendar = useCallback((semana: number, sessaoId: string, diaSemana: number) => {
    setReag(prev => ({ ...prev, [chaveReagendamento(semana, sessaoId)]: diaSemana }))
  }, [setReag])

  const toggleChecklist = useCallback((itemId: string) => {
    const hoje = chaveDia(new Date())
    setChecklist(prev => {
      const itens = prev.data === hoje ? prev.itens : {}
      return { data: hoje, itens: { ...itens, [itemId]: !itens[itemId] } }
    })
  }, [setChecklist])

  /** Se o treino registrado corresponde à sessão de hoje, completa o checklist dela. */
  const concluirChecklistDeHoje = useCallback((tipo: RegType, agora: Date) => {
    if (!plano || !planoAtivo) return
    const hoje = sessaoDeHoje(plano, planoAtivo, [], agora, reag)
    if (!hoje || hoje.sessao.tipo !== tipo) return
    const dia = chaveDia(agora)
    setChecklist(prev => {
      const itens = { ...(prev.data === dia ? prev.itens : {}) }
      hoje.sessao.checklist.forEach((_, i) => { itens[`${hoje.sessao.id}:${i}`] = true })
      return { data: dia, itens }
    })
  }, [plano, planoAtivo, reag, setChecklist])

  return { planoAtivo, plano, escolherPlano, encerrarPlano, reag, reagendar, checklistHoje, toggleChecklist, concluirChecklistDeHoje }
}

/** A sessão do plano que cai hoje (com o status), ou `null` sem plano. */
export function useSessaoDeHoje() {
  const pronto = useHidratado()
  const { plano, planoAtivo, reag } = usePlano()
  const { historico } = useHistorico()
  return useMemo(
    () => (pronto && plano && planoAtivo ? sessaoDeHoje(plano, planoAtivo, historico, new Date(), reag) : null),
    [pronto, plano, planoAtivo, historico, reag],
  )
}
