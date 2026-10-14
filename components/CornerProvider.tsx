'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo, ReactNode } from 'react'
import { useEntidade, useHidratado } from '@/hooks/useEntidade'
import { getPlano, type Plano } from '@/data/planos'
import { chaveDia, inicioDaSemana } from '@/lib/datas'
import { notificar } from '@/lib/notificar'
import { checkinDeHoje, gerarAlertas, type Alerta } from '@/lib/saude'
import { sessaoDeHoje, chaveReagendamento } from '@/lib/treinos'
import { lerBackup, montarBackup } from '@/lib/dados/backup'
import { ENTIDADES } from '@/lib/dados/entidades'
import { criarRepositorioLocal } from '@/lib/dados/repositorio-local'
import {
  CONFIG_PADRAO,
  type Checkin, type Configuracoes, type ImpactoCabeca, type Intensidade,
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

const ITENS_VAZIOS = ENTIDADES.checklist.inicial.itens

function novoId(): string {
  // crypto.randomUUID só existe em contexto seguro (https/localhost)
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function CornerProvider({ usuario, children }: { usuario: UsuarioApp; children: ReactNode }) {
  const pronto = useHidratado()
  // Os dados passam pelo repositório: o provider não conhece chaves nem o armazenamento.
  const repo = useMemo(() => criarRepositorioLocal({ usuarioId: usuario.id }), [usuario.id])

  const [historico, setHistorico] = useEntidade(repo, 'historico')
  const [planoAtivo, setPlanoAtivo] = useEntidade(repo, 'plano')
  const [configSalva, setConfig] = useEntidade(repo, 'config')
  const [checklist, setChecklist] = useEntidade(repo, 'checklist')
  const [checkins, setCheckins] = useEntidade(repo, 'checkins')
  const [lesoes, setLesoes] = useEntidade(repo, 'lesoes')
  const [pesos, setPesos] = useEntidade(repo, 'pesos')
  const [ajuste, setAjuste] = useEntidade(repo, 'ajuste')
  const [reag, setReag] = useEntidade(repo, 'reag')

  const config = useMemo<Configuracoes>(() => ({ ...CONFIG_PADRAO, ...configSalva }), [configSalva])
  const plano = useMemo(() => getPlano(planoAtivo?.planoId), [planoAtivo])
  const hojeKey = pronto ? chaveDia(new Date()) : ''
  // O que é "do dia" só vale na data em que foi marcado.
  const checklistHoje = checklist.data === hojeKey ? checklist.itens : ITENS_VAZIOS
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

  const exportarDados = useCallback(
    () => montarBackup({ historico, plano: planoAtivo, config: configSalva, checkins, lesoes, pesos, reag }, new Date()),
    [historico, planoAtivo, configSalva, checkins, lesoes, pesos, reag],
  )

  const importarDados = useCallback((texto: string): { ok: boolean; erro?: string } => {
    // lerBackup valida tudo antes de devolver: backup parcial ou corrompido não apaga dados bons.
    const r = lerBackup(texto)
    if (!r.ok) return { ok: false, erro: r.erro }
    repo.gravarVarias(r.dados)
    return { ok: true }
  }, [repo])

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
      if (repo.obter('lembrete') === hojeChave) return
      repo.gravar('lembrete', hojeChave)
      void notificar('Hora de treinar', tituloSessaoHoje ? `Hoje: ${tituloSessaoHoje}. Abra o Corner e comece o cronômetro.` : 'Que tal um treino hoje? Abra o Corner e registre.')
    }
    verificar()
    const id = window.setInterval(verificar, 30_000)
    return () => window.clearInterval(id)
  }, [pronto, config.notificacoes, config.lembreteHora, treinouHoje, tituloSessaoHoje, repo])

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
