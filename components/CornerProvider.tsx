'use client'

import { createContext, useContext, useState, useCallback, useRef, useMemo, ReactNode } from 'react'
import { useStorage, useHidratado } from '@/hooks/useStorage'
import { getPlano, type Plano } from '@/data/planos'
import { chaveDia, inicioDaSemana } from '@/lib/datas'
import { sessaoDeHoje } from '@/lib/treinos'
import {
  CONFIG_PADRAO, isWorkoutEntry,
  type ChecklistDoDia, type Configuracoes, type PlanoAtivo, type RegType, type WorkoutEntry,
} from '@/lib/tipos'

export type { RegType, WorkoutEntry } from '@/lib/tipos'
export { CAT_LABELS } from '@/lib/tipos'

export type Sheet = null | 'type' | 'details' | 'done' | 'notif' | 'planos'

export interface PresetTreino { tipo: RegType; rounds: number; minPorRound: number }

export interface UsuarioApp { id: string; nome: string }

interface CornerCtx {
  usuario: UsuarioApp
  /** false durante a renderização no servidor/hidratação (dados do localStorage ainda não lidos) */
  pronto: boolean

  historico: WorkoutEntry[]
  planoAtivo: PlanoAtivo | null
  plano: Plano | null
  escolherPlano: (planoId: string) => void
  encerrarPlano: () => void
  config: Configuracoes
  atualizarConfig: (parcial: Partial<Configuracoes>) => void
  checklistHoje: Record<string, boolean>
  toggleChecklist: (itemId: string) => void

  sheet: Sheet; setSheet: (s: Sheet) => void
  regType: RegType; setRegType: (t: RegType) => void
  rounds: number; setRounds: (n: number) => void
  roundMin: number; setRoundMin: (n: number) => void
  rpe: number; setRpe: (n: number) => void
  elapsed: number
  autoAdjust: boolean; setAutoAdjust: (v: boolean) => void
  adjustAccepted: boolean; setAdjustAccepted: (v: boolean) => void
  toast: string | null
  unread: boolean; setUnread: (v: boolean) => void
  openRegister: (preset?: PresetTreino) => void
  openNotif: () => void
  openPlanos: () => void
  closeSheet: () => void
  saveWorkout: () => void
  showToast: (msg: string) => void
}

const Ctx = createContext<CornerCtx | null>(null)

// ── Validação do que vem do localStorage ─────────────────────
const isHistorico = (v: unknown): v is WorkoutEntry[] => Array.isArray(v) && v.every(isWorkoutEntry)

const isPlanoAtivo = (v: unknown): v is PlanoAtivo | null => {
  if (v === null) return true
  if (typeof v !== 'object') return false
  const p = v as Record<string, unknown>
  return typeof p.planoId === 'string' && getPlano(p.planoId) !== null
    && typeof p.inicio === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.inicio)
}

const isConfig = (v: unknown): v is Configuracoes => {
  if (typeof v !== 'object' || v === null) return false
  const c = v as Record<string, unknown>
  return typeof c.metaSemanal === 'number' && c.metaSemanal >= 1 && c.metaSemanal <= 7 && typeof c.notificacoes === 'boolean'
}

const isChecklist = (v: unknown): v is ChecklistDoDia => {
  if (typeof v !== 'object' || v === null) return false
  const c = v as Record<string, unknown>
  return typeof c.data === 'string' && typeof c.itens === 'object' && c.itens !== null
}

const CHECKLIST_VAZIO: ChecklistDoDia = { data: '', itens: {} }

function novoId(): string {
  // crypto.randomUUID só existe em contexto seguro (https/localhost)
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function CornerProvider({ usuario, children }: { usuario: UsuarioApp; children: ReactNode }) {
  const pronto = useHidratado()
  const k = (nome: string) => `corner:${usuario.id}:${nome}`

  const [historico, setHistorico] = useStorage<WorkoutEntry[]>(k('historico'), [], isHistorico)
  const [planoAtivo, setPlanoAtivo] = useStorage<PlanoAtivo | null>(k('plano'), null, isPlanoAtivo)
  const [config, setConfig] = useStorage<Configuracoes>(k('config'), CONFIG_PADRAO, isConfig)
  const [checklist, setChecklist] = useStorage<ChecklistDoDia>(k('checklist'), CHECKLIST_VAZIO, isChecklist)

  const plano = useMemo(() => getPlano(planoAtivo?.planoId), [planoAtivo])
  const hojeKey = pronto ? chaveDia(new Date()) : ''
  // O checklist salvo só vale para o dia em que foi marcado.
  const checklistHoje = checklist.data === hojeKey ? checklist.itens : CHECKLIST_VAZIO.itens

  const [sheet, setSheet] = useState<Sheet>(null)
  const [regType, setRegTypeRaw] = useState<RegType>('spa')
  const [rounds, setRounds] = useState(4)
  const [roundMin, setRoundMin] = useState(2)
  const [rpe, setRpe] = useState(7)
  const [elapsed, setElapsed] = useState(0)
  const [autoAdjust, setAutoAdjust] = useState(true)
  const [adjustAccepted, setAdjustAccepted] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [unread, setUnread] = useState(true)
  const t0Ref = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast(msg)
    timerRef.current = setTimeout(() => setToast(null), 2200)
  }, [])

  const setRegType = useCallback((t: RegType) => {
    setRegTypeRaw(t)
    setRounds(t === 'spa' ? 4 : 6)
    setRoundMin(t === 'spa' ? 2 : 3)
  }, [])

  const openRegister = useCallback((preset?: PresetTreino) => {
    t0Ref.current = Date.now()
    if (preset) {
      // Vindo de uma sessão do plano: já abre nos detalhes, com os valores da sessão.
      setRegTypeRaw(preset.tipo)
      setRounds(preset.rounds)
      setRoundMin(preset.minPorRound)
      setSheet('details')
    } else {
      setSheet('type')
    }
  }, [])
  const openNotif = useCallback(() => { setUnread(false); setSheet('notif') }, [])
  const openPlanos = useCallback(() => setSheet('planos'), [])
  const closeSheet = useCallback(() => setSheet(null), [])

  const toggleChecklist = useCallback((itemId: string) => {
    const hoje = chaveDia(new Date())
    setChecklist(prev => {
      const itens = prev.data === hoje ? prev.itens : {}
      return { data: hoje, itens: { ...itens, [itemId]: !itens[itemId] } }
    })
  }, [setChecklist])

  const escolherPlano = useCallback((planoId: string) => {
    // A semana 1 do plano é a semana atual (a partir de segunda).
    setPlanoAtivo({ planoId, inicio: chaveDia(inicioDaSemana(new Date())) })
  }, [setPlanoAtivo])

  const encerrarPlano = useCallback(() => setPlanoAtivo(null), [setPlanoAtivo])

  const atualizarConfig = useCallback((parcial: Partial<Configuracoes>) => {
    setConfig(prev => ({ ...prev, ...parcial }))
  }, [setConfig])

  const saveWorkout = useCallback(() => {
    const e = Math.max(4, Math.round((Date.now() - t0Ref.current) / 1000))
    setElapsed(e)
    const agora = new Date()
    const entrada: WorkoutEntry = {
      id: novoId(), data: agora.toISOString(), tipo: regType, rounds, minPorRound: roundMin, rpe, duracaoSegundos: e,
    }
    setHistorico(prev => [entrada, ...prev])

    // Se o treino corresponde à sessão de hoje, completa o checklist dela.
    if (plano && planoAtivo) {
      const hoje = sessaoDeHoje(plano, planoAtivo, [], agora)
      if (hoje && hoje.sessao.tipo === regType) {
        const dia = chaveDia(agora)
        setChecklist(prev => {
          const itens = { ...(prev.data === dia ? prev.itens : {}) }
          hoje.sessao.checklist.forEach((_, i) => { itens[`${hoje.sessao.id}:${i}`] = true })
          return { data: dia, itens }
        })
      }
    }
    setSheet('done')
  }, [regType, rounds, roundMin, rpe, plano, planoAtivo, setHistorico, setChecklist])

  return (
    <Ctx.Provider value={{
      usuario, pronto,
      historico, planoAtivo, plano, escolherPlano, encerrarPlano, config, atualizarConfig, checklistHoje, toggleChecklist,
      sheet, setSheet, regType, setRegType, rounds, setRounds, roundMin, setRoundMin, rpe, setRpe, elapsed,
      autoAdjust, setAutoAdjust, adjustAccepted, setAdjustAccepted, toast, unread, setUnread,
      openRegister, openNotif, openPlanos, closeSheet, saveWorkout, showToast,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useCorner() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCorner must be inside CornerProvider')
  return ctx
}
