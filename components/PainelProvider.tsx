'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useHistorico } from '@/hooks/useHistorico'
import { usePlano } from '@/hooks/usePlano'
import { novoId } from '@/lib/id'
import { track } from '@/lib/posthog'
import type { ImpactoCabeca, Intensidade, RegType, WorkoutEntry } from '@/lib/tipos'

export type Sheet = null | 'type' | 'details' | 'done' | 'notif' | 'planos' | 'onboarding'

/** Nome de cada painel nas métricas. Os três passos do registro de treino são um painel só. */
const NOME_DO_PAINEL: Record<Exclude<Sheet, null>, string> = {
  type: 'registro_treino', details: 'registro_treino', done: 'registro_treino',
  notif: 'alertas', planos: 'escolher_plano', onboarding: 'perfil_atleta',
}

export interface PresetTreino {
  tipo: RegType
  rounds: number
  minPorRound: number
  /** Duração real, quando o treino veio do cronômetro */
  duracaoSegundos?: number
  sessaoId?: string
}

export interface ExtrasRegistro {
  intensidade: Intensidade
  cabeca: ImpactoCabeca
  parceiro: string
  nota: string
}

const EXTRAS_PADRAO: ExtrasRegistro = { intensidade: 'moderada', cabeca: 'nenhum', parceiro: '', nota: '' }

// Dois contextos: as ações são estáveis (quem só abre um painel não re-renderiza a cada toque no formulário);
// o estado muda o tempo todo enquanto o painel de registro está aberto.
interface Acoes {
  setSheet: (s: Sheet) => void
  openRegister: (preset?: PresetTreino) => void
  openNotif: () => void
  openPlanos: () => void
  openOnboarding: () => void
  closeSheet: () => void
}

interface Estado {
  sheet: Sheet
  regType: RegType; setRegType: (t: RegType) => void
  rounds: number; setRounds: (n: number) => void
  roundMin: number; setRoundMin: (n: number) => void
  rpe: number; setRpe: (n: number) => void
  extras: ExtrasRegistro; setExtras: (parcial: Partial<ExtrasRegistro>) => void
  elapsed: number
  ultimoSalvo: WorkoutEntry | null
  /** O registro aberto veio do cronômetro (o treino já foi feito) */
  viaCronometro: boolean
  saveWorkout: () => void
}

const AcoesContext = createContext<Acoes | null>(null)
const EstadoContext = createContext<Estado | null>(null)

export function PainelProvider({ children }: { children: ReactNode }) {
  const { adicionarTreino } = useHistorico()
  const { concluirChecklistDeHoje } = usePlano()

  const [sheet, setSheetBruto] = useState<Sheet>(null)
  const [regType, setRegTypeRaw] = useState<RegType>('spa')
  const [rounds, setRounds] = useState(4)
  const [roundMin, setRoundMin] = useState(2)
  const [rpe, setRpe] = useState(7)
  const [extras, setExtrasState] = useState<ExtrasRegistro>(EXTRAS_PADRAO)
  const [elapsed, setElapsed] = useState(0)
  const [ultimoSalvo, setUltimoSalvo] = useState<WorkoutEntry | null>(null)
  const [viaCronometro, setViaCronometro] = useState(false)
  const t0Ref = useRef(0)
  const sheetRef = useRef<Sheet>(null)
  const abridorRef = useRef<HTMLElement | null>(null)
  const restaurarRef = useRef<HTMLElement | null>(null)
  const presetRef = useRef<PresetTreino | null>(null)

  // Guarda quem abriu o painel para devolver o foco a esse elemento quando o painel fecha.
  const setSheet = useCallback((s: Sheet) => {
    if (s !== null && sheetRef.current === null) {
      abridorRef.current = document.activeElement as HTMLElement | null
      // Conta só quando um painel ABRE (fechado -> aberto); passar de um passo do registro para o seguinte não conta.
      track('sheet_opened', { sheet_name: NOME_DO_PAINEL[s] })
    }
    if (s === null) { restaurarRef.current = abridorRef.current; abridorRef.current = null }
    sheetRef.current = s
    setSheetBruto(s)
  }, [])

  useEffect(() => {
    if (sheet !== null) return
    const el = restaurarRef.current
    restaurarRef.current = null
    if (el && el.isConnected) el.focus()
  }, [sheet])

  const setRegType = useCallback((t: RegType) => {
    setRegTypeRaw(t)
    setRounds(t === 'spa' ? 4 : 6)
    setRoundMin(t === 'spa' ? 2 : 3)
  }, [])

  const setExtras = useCallback((parcial: Partial<ExtrasRegistro>) => setExtrasState(prev => ({ ...prev, ...parcial })), [])

  const openRegister = useCallback((preset?: PresetTreino) => {
    t0Ref.current = Date.now()
    presetRef.current = preset ?? null
    setViaCronometro(preset?.duracaoSegundos !== undefined)
    setExtrasState(EXTRAS_PADRAO)
    if (preset) {
      // Vindo de uma sessão do plano ou do cronômetro: já abre nos detalhes.
      setRegTypeRaw(preset.tipo)
      setRounds(preset.rounds)
      setRoundMin(preset.minPorRound)
      setSheet('details')
    } else {
      setSheet('type')
    }
  }, [setSheet])

  const openNotif = useCallback(() => setSheet('notif'), [setSheet])
  const openPlanos = useCallback(() => setSheet('planos'), [setSheet])
  const openOnboarding = useCallback(() => setSheet('onboarding'), [setSheet])
  const closeSheet = useCallback(() => setSheet(null), [setSheet])

  const saveWorkout = useCallback(() => {
    const preset = presetRef.current
    const decorrido = Math.max(4, Math.round((Date.now() - t0Ref.current) / 1000))
    const duracao = preset?.duracaoSegundos ?? decorrido
    setElapsed(duracao)
    const agora = new Date()
    const nota = extras.nota.trim().slice(0, 280)
    const parceiro = extras.parceiro.trim().slice(0, 60)
    const entrada: WorkoutEntry = {
      id: novoId(), data: agora.toISOString(), tipo: regType, rounds, minPorRound: roundMin, rpe, duracaoSegundos: duracao,
      ...(preset?.sessaoId ? { sessaoId: preset.sessaoId } : {}),
      ...(nota ? { nota } : {}),
      ...(regType === 'spa' ? { sparring: { intensidade: extras.intensidade, cabeca: extras.cabeca, ...(parceiro ? { parceiro } : {}) } } : {}),
    }
    adicionarTreino(entrada)
    setUltimoSalvo(entrada)
    concluirChecklistDeHoje(regType, agora)
    presetRef.current = null
    setSheet('done')
  }, [regType, rounds, roundMin, rpe, extras, adicionarTreino, concluirChecklistDeHoje, setSheet])

  const acoes = useMemo<Acoes>(() => ({ setSheet, openRegister, openNotif, openPlanos, openOnboarding, closeSheet }), [setSheet, openRegister, openNotif, openPlanos, openOnboarding, closeSheet])
  const estado = useMemo<Estado>(() => ({
    sheet, regType, setRegType, rounds, setRounds, roundMin, setRoundMin, rpe, setRpe, extras, setExtras, elapsed, ultimoSalvo, viaCronometro, saveWorkout,
  }), [sheet, regType, setRegType, rounds, roundMin, rpe, extras, setExtras, elapsed, ultimoSalvo, viaCronometro, saveWorkout])

  return (
    <AcoesContext.Provider value={acoes}>
      <EstadoContext.Provider value={estado}>{children}</EstadoContext.Provider>
    </AcoesContext.Provider>
  )
}

/** Abrir e fechar painéis. As funções são estáveis: não causam re-render. */
export function usePainelAcoes(): Acoes {
  const v = useContext(AcoesContext)
  if (!v) throw new Error('usePainelAcoes precisa estar dentro do CornerProvider')
  return v
}

/** Estado do painel aberto e do formulário de registro de treino. */
export function usePainelEstado(): Estado {
  const v = useContext(EstadoContext)
  if (!v) throw new Error('usePainelEstado precisa estar dentro do CornerProvider')
  return v
}
