'use client'

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react'

export type RegType = 'tec' | 'con' | 'spa'
export type Sheet = null | 'type' | 'details' | 'done' | 'notif'

export interface WorkoutEntry {
  date: string; cat: RegType; title: string; meta: string; rpe: number; bpm: string | number; rounds: number;
}

export const CAT_LABELS: Record<RegType, string> = { tec: 'Técnica', con: 'Condicionamento', spa: 'Sparring' }

interface CornerCtx {
  sheet: Sheet; setSheet: (s: Sheet) => void
  regType: RegType; setRegType: (t: RegType) => void
  rounds: number; setRounds: (n: number) => void
  roundMin: number; setRoundMin: (n: number) => void
  rpe: number; setRpe: (n: number) => void
  elapsed: number
  checks: Record<string, boolean>; toggleCheck: (id: string) => void
  autoAdjust: boolean; setAutoAdjust: (v: boolean) => void
  adjustAccepted: boolean; setAdjustAccepted: (v: boolean) => void
  toast: string | null
  unread: boolean; setUnread: (v: boolean) => void
  extra: WorkoutEntry[]
  openRegister: () => void
  openNotif: () => void
  closeSheet: () => void
  saveWorkout: () => void
  showToast: (msg: string) => void
}

const Ctx = createContext<CornerCtx | null>(null)

export function CornerProvider({ children }: { children: ReactNode }) {
  const [sheet, setSheet] = useState<Sheet>(null)
  const [regType, setRegTypeRaw] = useState<RegType>('spa')
  const [rounds, setRounds] = useState(4)
  const [roundMin, setRoundMin] = useState(2)
  const [rpe, setRpe] = useState(7)
  const [elapsed, setElapsed] = useState(0)
  const [checks, setChecks] = useState<Record<string, boolean>>({ c1: true, c3: true })
  const [autoAdjust, setAutoAdjust] = useState(true)
  const [adjustAccepted, setAdjustAccepted] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [unread, setUnread] = useState(true)
  const [extra, setExtra] = useState<WorkoutEntry[]>([])
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

  const openRegister = useCallback(() => { t0Ref.current = Date.now(); setSheet('type') }, [])
  const openNotif = useCallback(() => { setUnread(false); setSheet('notif') }, [])
  const closeSheet = useCallback(() => setSheet(null), [])
  const toggleCheck = useCallback((id: string) => { setChecks(p => ({ ...p, [id]: !p[id] })) }, [])

  const saveWorkout = useCallback(() => {
    const e = Math.max(4, Math.round((Date.now() - t0Ref.current) / 1000))
    setElapsed(e)
    const catChecks: Record<RegType, string[]> = { tec: ['c1', 'c2'], con: ['c3', 'c5'], spa: ['c4'] }
    setChecks(p => { const next = { ...p }; (catChecks[regType] || []).forEach(id => { next[id] = true }); return next })
    setExtra(p => [{ date: 'Hoje', cat: regType, title: CAT_LABELS[regType], meta: `${rounds} rounds · ${rounds * roundMin} min`, rpe, bpm: '—', rounds }, ...p])
    setSheet('done')
  }, [regType, rounds, roundMin, rpe])

  return (
    <Ctx.Provider value={{ sheet, setSheet, regType, setRegType, rounds, setRounds, roundMin, setRoundMin, rpe, setRpe, elapsed, checks, toggleCheck, autoAdjust, setAutoAdjust, adjustAccepted, setAdjustAccepted, toast, unread, setUnread, extra, openRegister, openNotif, closeSheet, saveWorkout, showToast }}>
      {children}
    </Ctx.Provider>
  )
}

export function useCorner() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCorner must be inside CornerProvider')
  return ctx
}
