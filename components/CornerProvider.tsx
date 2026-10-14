'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, ReactNode } from 'react'
import { useStorage, useHidratado } from '@/hooks/useStorage'
import { getPlano, type Plano } from '@/data/planos'
import { chaveDia, inicioDaSemana } from '@/lib/datas'
import { notificar } from '@/lib/notificar'
import { checkinDeHoje, gerarAlertas, type Alerta } from '@/lib/saude'
import { sessaoDeHoje, chaveReagendamento } from '@/lib/treinos'
import {
  isAjuste, isArrayDe, isCheckin, isChecklist, isConfigParcial, isLesao, isObj, isPesoRegistro, isPlanoAtivo, isReag, isWorkoutEntry,
} from '@/lib/dados/contrato'
import {
  CONFIG_PADRAO,
  type AjusteDoDia, type Checkin, type ChecklistDoDia, type Configuracoes, type ImpactoCabeca, type Intensidade,
  type Lesao, type PesoRegistro, type PlanoAtivo, type Reagendamentos, type RegType, type RegiaoCorpo, type WorkoutEntry,
} from '@/lib/tipos'

export type { RegType, WorkoutEntry } from '@/lib/tipos'
export { CAT_LABELS } from '@/lib/tipos'

export type Sheet = null | 'type' | 'details' | 'done' | 'notif' | 'planos' | 'onboarding'

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
  reag: Reagendamentos
  reagendar: (semana: number, sessaoId: string, diaSemana: number) => void

  checkins: Checkin[]
  checkinHoje: Checkin | null
  registrarCheckin: (valores: Omit<Checkin, 'data'>) => void
  ajusteAplicado: boolean
  aplicarAjuste: (aplicar: boolean) => void
  lesoes: Lesao[]
  adicionarLesao: (l: { regiao: RegiaoCorpo; intensidade: number; nota?: string }) => void
  resolverLesao: (id: string) => void
  removerLesao: (id: string) => void
  pesos: PesoRegistro[]
  registrarPeso: (kg: number) => void
  removerPeso: (id: string) => void
  alertas: Alerta[]

  exportarDados: () => string
  importarDados: (texto: string) => { ok: boolean; erro?: string }

  sheet: Sheet; setSheet: (s: Sheet) => void
  regType: RegType; setRegType: (t: RegType) => void
  rounds: number; setRounds: (n: number) => void
  roundMin: number; setRoundMin: (n: number) => void
  rpe: number; setRpe: (n: number) => void
  extras: ExtrasRegistro; setExtras: (parcial: Partial<ExtrasRegistro>) => void
  elapsed: number
  ultimoSalvo: WorkoutEntry | null
  /** O registro aberto veio do cronômetro (o treino já foi feito) */
  viaCronometro: boolean
  toast: string | null
  openRegister: (preset?: PresetTreino) => void
  openNotif: () => void
  openPlanos: () => void
  openOnboarding: () => void
  closeSheet: () => void
  saveWorkout: () => void
  showToast: (msg: string) => void
}

const Ctx = createContext<CornerCtx | null>(null)

// ── Validação do que vem do localStorage (contrato em lib/dados/contrato.ts) ──
const isHistorico = isArrayDe(isWorkoutEntry)
const isCheckins = isArrayDe(isCheckin)
const isLesoes = isArrayDe(isLesao)
const isPesos = isArrayDe(isPesoRegistro)

const CHECKLIST_VAZIO: ChecklistDoDia = { data: '', itens: {} }
const AJUSTE_VAZIO: AjusteDoDia = { data: '', aplicado: false }
const CONFIG_VAZIA: Partial<Configuracoes> = {}
const REAG_VAZIO: Reagendamentos = {}
const LISTA_VAZIA: never[] = []

function novoId(): string {
  // crypto.randomUUID só existe em contexto seguro (https/localhost)
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function CornerProvider({ usuario, children }: { usuario: UsuarioApp; children: ReactNode }) {
  const pronto = useHidratado()
  const k = (nome: string) => `corner:${usuario.id}:${nome}`

  const [historico, setHistorico] = useStorage<WorkoutEntry[]>(k('historico'), LISTA_VAZIA, isHistorico)
  const [planoAtivo, setPlanoAtivo] = useStorage<PlanoAtivo | null>(k('plano'), null, isPlanoAtivo)
  const [configSalva, setConfig] = useStorage<Partial<Configuracoes>>(k('config'), CONFIG_VAZIA, isConfigParcial)
  const [checklist, setChecklist] = useStorage<ChecklistDoDia>(k('checklist'), CHECKLIST_VAZIO, isChecklist)
  const [checkins, setCheckins] = useStorage<Checkin[]>(k('checkins'), LISTA_VAZIA, isCheckins)
  const [lesoes, setLesoes] = useStorage<Lesao[]>(k('lesoes'), LISTA_VAZIA, isLesoes)
  const [pesos, setPesos] = useStorage<PesoRegistro[]>(k('pesos'), LISTA_VAZIA, isPesos)
  const [ajuste, setAjuste] = useStorage<AjusteDoDia>(k('ajuste'), AJUSTE_VAZIO, isAjuste)
  const [reag, setReag] = useStorage<Reagendamentos>(k('reag'), REAG_VAZIO, isReag)

  const config = useMemo<Configuracoes>(() => ({ ...CONFIG_PADRAO, ...configSalva }), [configSalva])
  const plano = useMemo(() => getPlano(planoAtivo?.planoId), [planoAtivo])
  const hojeKey = pronto ? chaveDia(new Date()) : ''
  // O que é "do dia" só vale na data em que foi marcado.
  const checklistHoje = checklist.data === hojeKey ? checklist.itens : CHECKLIST_VAZIO.itens
  const ajusteAplicado = ajuste.data === hojeKey && ajuste.aplicado
  const checkinHoje = useMemo(() => (pronto ? checkinDeHoje(checkins, new Date()) : null), [pronto, checkins])

  const sessaoHoje = useMemo(
    () => (pronto && plano && planoAtivo ? sessaoDeHoje(plano, planoAtivo, historico, new Date(), reag) : null),
    [pronto, plano, planoAtivo, historico, reag],
  )

  const alertas = useMemo(
    () => (pronto
      ? gerarAlertas({ historico, lesoes, sessaoHojeTipo: sessaoHoje && sessaoHoje.status !== 'feita' ? sessaoHoje.sessao.tipo : null, metaSemanal: config.metaSemanal, hoje: new Date() })
      : []),
    [pronto, historico, lesoes, sessaoHoje, config.metaSemanal],
  )

  const [sheet, setSheet] = useState<Sheet>(null)
  const [regType, setRegTypeRaw] = useState<RegType>('spa')
  const [rounds, setRounds] = useState(4)
  const [roundMin, setRoundMin] = useState(2)
  const [rpe, setRpe] = useState(7)
  const [extras, setExtrasState] = useState<ExtrasRegistro>(EXTRAS_PADRAO)
  const [elapsed, setElapsed] = useState(0)
  const [ultimoSalvo, setUltimoSalvo] = useState<WorkoutEntry | null>(null)
  const [viaCronometro, setViaCronometro] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const t0Ref = useRef(0)
  const presetRef = useRef<PresetTreino | null>(null)
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
  }, [])

  const openNotif = useCallback(() => setSheet('notif'), [])
  const openPlanos = useCallback(() => setSheet('planos'), [])
  const openOnboarding = useCallback(() => setSheet('onboarding'), [])
  const closeSheet = useCallback(() => setSheet(null), [])

  const toggleChecklist = useCallback((itemId: string) => {
    const hoje = chaveDia(new Date())
    setChecklist(prev => {
      const itens = prev.data === hoje ? prev.itens : {}
      return { data: hoje, itens: { ...itens, [itemId]: !itens[itemId] } }
    })
  }, [setChecklist])

  const escolherPlano = useCallback((planoId: string) => {
    // A semana 1 do plano é a semana atual (a partir de segunda). Trocar de plano zera os reagendamentos.
    setPlanoAtivo({ planoId, inicio: chaveDia(inicioDaSemana(new Date())) })
    setReag({})
  }, [setPlanoAtivo, setReag])

  const encerrarPlano = useCallback(() => {
    setPlanoAtivo(null)
    setReag({})
  }, [setPlanoAtivo, setReag])

  const atualizarConfig = useCallback((parcial: Partial<Configuracoes>) => {
    setConfig(prev => ({ ...prev, ...parcial }))
  }, [setConfig])

  const reagendar = useCallback((semana: number, sessaoId: string, diaSemana: number) => {
    setReag(prev => ({ ...prev, [chaveReagendamento(semana, sessaoId)]: diaSemana }))
  }, [setReag])

  const registrarCheckin = useCallback((valores: Omit<Checkin, 'data'>) => {
    const data = chaveDia(new Date())
    setCheckins(prev => [{ data, ...valores }, ...prev.filter(c => c.data !== data)].slice(0, 120))
    setAjuste({ data, aplicado: false }) // novo check-in = novo ajuste a decidir
  }, [setCheckins, setAjuste])

  const aplicarAjuste = useCallback((aplicar: boolean) => {
    setAjuste({ data: chaveDia(new Date()), aplicado: aplicar })
  }, [setAjuste])

  const adicionarLesao = useCallback((l: { regiao: RegiaoCorpo; intensidade: number; nota?: string }) => {
    const nota = l.nota?.trim().slice(0, 200)
    setLesoes(prev => [{ id: novoId(), regiao: l.regiao, intensidade: l.intensidade, inicio: chaveDia(new Date()), ...(nota ? { nota } : {}) }, ...prev])
  }, [setLesoes])

  const resolverLesao = useCallback((id: string) => {
    const hoje = chaveDia(new Date())
    setLesoes(prev => prev.map(l => (l.id === id ? { ...l, resolvidaEm: hoje } : l)))
  }, [setLesoes])

  const removerLesao = useCallback((id: string) => setLesoes(prev => prev.filter(l => l.id !== id)), [setLesoes])

  const registrarPeso = useCallback((kg: number) => {
    const data = chaveDia(new Date())
    setPesos(prev => [...prev.filter(p => p.data !== data), { id: novoId(), data, kg }].sort((a, b) => a.data.localeCompare(b.data)).slice(-400))
  }, [setPesos])

  const removerPeso = useCallback((id: string) => setPesos(prev => prev.filter(p => p.id !== id)), [setPesos])

  const exportarDados = useCallback(() => JSON.stringify({
    app: 'corner', versao: 1, exportadoEm: new Date().toISOString(),
    dados: { historico, plano: planoAtivo, config: configSalva, checkins, lesoes, pesos, reag },
  }, null, 2), [historico, planoAtivo, configSalva, checkins, lesoes, pesos, reag])

  const importarDados = useCallback((texto: string): { ok: boolean; erro?: string } => {
    let raiz: unknown
    try { raiz = JSON.parse(texto) } catch { return { ok: false, erro: 'O arquivo não é um JSON válido.' } }
    if (!isObj(raiz) || raiz.app !== 'corner' || !isObj(raiz.dados)) return { ok: false, erro: 'Este arquivo não é um backup do Corner.' }
    const d = raiz.dados
    // Valida tudo antes de gravar qualquer coisa: backup parcial ou corrompido não pode apagar dados bons.
    if (d.historico !== undefined && !isHistorico(d.historico)) return { ok: false, erro: 'O histórico do backup está corrompido.' }
    if (d.plano !== undefined && !isPlanoAtivo(d.plano)) return { ok: false, erro: 'O plano do backup é inválido.' }
    if (d.config !== undefined && !isConfigParcial(d.config)) return { ok: false, erro: 'As configurações do backup são inválidas.' }
    if (d.checkins !== undefined && !isCheckins(d.checkins)) return { ok: false, erro: 'Os check-ins do backup estão corrompidos.' }
    if (d.lesoes !== undefined && !isLesoes(d.lesoes)) return { ok: false, erro: 'As lesões do backup estão corrompidas.' }
    if (d.pesos !== undefined && !isPesos(d.pesos)) return { ok: false, erro: 'Os registros de peso do backup estão corrompidos.' }
    if (d.reag !== undefined && !isReag(d.reag)) return { ok: false, erro: 'Os reagendamentos do backup são inválidos.' }
    if (d.historico !== undefined) setHistorico(d.historico as WorkoutEntry[])
    if (d.plano !== undefined) setPlanoAtivo(d.plano as PlanoAtivo | null)
    if (d.config !== undefined) setConfig(d.config as Partial<Configuracoes>)
    if (d.checkins !== undefined) setCheckins(d.checkins as Checkin[])
    if (d.lesoes !== undefined) setLesoes(d.lesoes as Lesao[])
    if (d.pesos !== undefined) setPesos(d.pesos as PesoRegistro[])
    if (d.reag !== undefined) setReag(d.reag as Reagendamentos)
    return { ok: true }
  }, [setHistorico, setPlanoAtivo, setConfig, setCheckins, setLesoes, setPesos, setReag])

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
    setHistorico(prev => [entrada, ...prev])
    setUltimoSalvo(entrada)

    // Se o treino corresponde à sessão de hoje, completa o checklist dela.
    if (plano && planoAtivo) {
      const hoje = sessaoDeHoje(plano, planoAtivo, [], agora, reag)
      if (hoje && hoje.sessao.tipo === regType) {
        const dia = chaveDia(agora)
        setChecklist(prev => {
          const itens = { ...(prev.data === dia ? prev.itens : {}) }
          hoje.sessao.checklist.forEach((_, i) => { itens[`${hoje.sessao.id}:${i}`] = true })
          return { data: dia, itens }
        })
      }
    }
    presetRef.current = null
    setSheet('done')
  }, [regType, rounds, roundMin, rpe, extras, plano, planoAtivo, reag, setHistorico, setChecklist])

  // Lembrete diário: só dispara com o app aberto (lembretes com o app fechado exigem um servidor de push).
  const chaveLembrete = `corner:${usuario.id}:lembrete`
  const tituloSessaoHoje = sessaoHoje && sessaoHoje.status !== 'feita' ? sessaoHoje.sessao.titulo : null
  const treinouHoje = useMemo(() => {
    if (!pronto) return false
    const hoje = chaveDia(new Date())
    return historico.some(t => chaveDia(new Date(t.data)) === hoje)
  }, [pronto, historico])

  useEffect(() => {
    if (!pronto || !config.notificacoes || !config.lembreteHora) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const [h, m] = config.lembreteHora.split(':').map(Number)
    if (!Number.isFinite(h) || !Number.isFinite(m)) return

    const verificar = () => {
      const agora = new Date()
      const hojeChave = chaveDia(agora)
      if (agora < new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), h, m) || treinouHoje) return
      try {
        if (localStorage.getItem(chaveLembrete) === hojeChave) return
        localStorage.setItem(chaveLembrete, hojeChave)
      } catch { /* sem storage: pode repetir, mas não quebra */ }
      void notificar('Hora de treinar', tituloSessaoHoje ? `Hoje: ${tituloSessaoHoje}. Abra o Corner e comece o cronômetro.` : 'Que tal um treino hoje? Abra o Corner e registre.')
    }
    verificar()
    const id = window.setInterval(verificar, 30_000)
    return () => window.clearInterval(id)
  }, [pronto, config.notificacoes, config.lembreteHora, treinouHoje, tituloSessaoHoje, chaveLembrete])

  return (
    <Ctx.Provider value={{
      usuario, pronto,
      historico, planoAtivo, plano, escolherPlano, encerrarPlano, config, atualizarConfig, checklistHoje, toggleChecklist, reag, reagendar,
      checkins, checkinHoje, registrarCheckin, ajusteAplicado, aplicarAjuste,
      lesoes, adicionarLesao, resolverLesao, removerLesao, pesos, registrarPeso, removerPeso, alertas,
      exportarDados, importarDados,
      sheet, setSheet, regType, setRegType, rounds, setRounds, roundMin, setRoundMin, rpe, setRpe, extras, setExtras, elapsed, ultimoSalvo, viaCronometro, toast,
      openRegister, openNotif, openPlanos, openOnboarding, closeSheet, saveWorkout, showToast,
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
