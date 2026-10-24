'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { criarAudio, tocarBip, tocarMatraca, tocarSino, vibrar } from '@/lib/som'

export const PREPARO_SEG = 10

export interface FaseCrono {
  tipo: 'preparo' | 'round' | 'descanso'
  /** Round a que a fase pertence (no preparo, o primeiro; no descanso, o que acabou de terminar) */
  round: number
  duracao: number
  /** Segundo, desde o início, em que a fase começa */
  inicio: number
}

export function montarFases(rounds: number, roundSeg: number, descansoSeg: number, preparoSeg: number = PREPARO_SEG): FaseCrono[] {
  const fases: FaseCrono[] = []
  let t = 0
  const add = (tipo: FaseCrono['tipo'], round: number, duracao: number) => {
    fases.push({ tipo, round, duracao, inicio: t })
    t += duracao
  }
  if (preparoSeg > 0) add('preparo', 1, preparoSeg)
  for (let r = 1; r <= rounds; r++) {
    add('round', r, roundSeg)
    if (r < rounds && descansoSeg > 0) add('descanso', r, descansoSeg)
  }
  return fases
}

function fecharAudio(ctx: AudioContext | null, depoisDeMs: number) {
  if (!ctx) return
  window.setTimeout(() => { void ctx.close().catch(() => undefined) }, depoisDeMs)
}

export type EstadoCrono = 'pronto' | 'rodando' | 'pausado' | 'fim'

export interface Execucao {
  inicio: number
  pausadoEm: number | null
  pausadoTotal: number
  /** Segundos pulados pelo usuário ao avançar de fase */
  adiantado: number
  fimEm: number | null
}

/** Os avisos sonoros do cronômetro. Cada tela escolhe os seus (o treino do plano usa o sino; o Timer usa bipes). */
export interface SonsDoCronometro {
  inicioRound: (ctx: AudioContext | null) => void
  inicioDescanso: (ctx: AudioContext | null) => void
  /** Faltam 10 segundos para o fim do round */
  aviso: (ctx: AudioContext | null) => void
  /** Últimos 3 segundos do preparo e do descanso */
  contagem: (ctx: AudioContext | null) => void
  fim: (ctx: AudioContext | null) => void
}

export const SONS_DO_TREINO: SonsDoCronometro = {
  inicioRound: ctx => tocarSino(ctx, 1),
  inicioDescanso: ctx => tocarSino(ctx, 2),
  aviso: ctx => tocarMatraca(ctx),
  contagem: ctx => tocarBip(ctx),
  fim: ctx => tocarSino(ctx, 3),
}

/**
 * Quanto tempo passou, pelo relógio. `decorrido` é o andamento do treino (conta os segundos pulados);
 * `decorridoReal` é o tempo de fato treinado. Nenhum dos dois passa do total: voltar de segundo plano
 * minutos depois do fim não pode inflar o tempo do treino.
 */
export function medirRelogio(exec: Execucao | null, agora: number, total: number): { decorridoReal: number; decorrido: number } {
  if (!exec) return { decorridoReal: 0, decorrido: 0 }
  const fimDoRelogio = exec.fimEm ?? exec.pausadoEm ?? agora
  const bruto = Math.max(0, (fimDoRelogio - exec.inicio - exec.pausadoTotal) / 1000)
  const decorrido = Math.min(bruto + exec.adiantado, total)
  return { decorridoReal: decorrido - exec.adiantado, decorrido }
}

/** Encerra o treino. Se estiver pausado, termina no momento da pausa: o tempo parado não é treino. */
export function encerrarExecucao(e: Execucao, agora: number): Execucao {
  return e.fimEm === null ? { ...e, fimEm: e.pausadoEm ?? agora } : e
}

interface Opcoes {
  rounds: number
  roundSeg: number
  descansoSeg: number
  /** Segundos de contagem antes do primeiro round (0 = sem preparo). Padrão: 10. */
  preparoSeg?: number
  sons?: SonsDoCronometro
  /** Vibrar a cada troca de fase (onde o aparelho deixa). Padrão: sim. */
  vibracao?: boolean
}

/**
 * Cronômetro de rounds. O tempo vem do relógio (Date.now) e não de contar "ticks",
 * então segue correto mesmo quando o navegador reduz a frequência dos timers em segundo plano.
 */
export function useCronometro({ rounds, roundSeg, descansoSeg, preparoSeg = PREPARO_SEG, sons = SONS_DO_TREINO, vibracao = true }: Opcoes) {
  const [fases] = useState(() => montarFases(rounds, roundSeg, descansoSeg, preparoSeg))
  const [exec, setExec] = useState<Execucao | null>(null)
  const [agora, setAgora] = useState(0)
  const audioRef = useRef<AudioContext | null>(null)
  const disparados = useRef(new Set<string>())

  const total = fases[fases.length - 1].inicio + fases[fases.length - 1].duracao
  const { decorridoReal, decorrido } = medirRelogio(exec, agora, total)

  const estado: EstadoCrono = !exec ? 'pronto' : exec.fimEm !== null || decorrido >= total ? 'fim' : exec.pausadoEm !== null ? 'pausado' : 'rodando'

  const achado = fases.findIndex(f => decorrido < f.inicio + f.duracao)
  const idx = estado === 'fim' || achado < 0 ? fases.length - 1 : achado
  const fase = fases[idx]
  const restante = estado === 'fim' ? 0 : Math.max(0, Math.ceil(fase.inicio + fase.duracao - decorrido))
  const roundsFeitos = fases.filter(f => f.tipo === 'round' && f.inicio + f.duracao <= decorrido + 0.001).length

  // Relógio: só roda enquanto o cronômetro está andando.
  useEffect(() => {
    if (estado !== 'rodando') return
    const atualizar = () => setAgora(Date.now())
    const id = window.setInterval(atualizar, 200)
    document.addEventListener('visibilitychange', atualizar)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', atualizar)
    }
  }, [estado])

  // Mantém a tela acesa durante o treino (e pede de novo ao voltar para a aba).
  const ativo = estado === 'rodando' || estado === 'pausado'
  useEffect(() => {
    if (!ativo) return
    let cancelado = false
    let trava: WakeLockSentinel | null = null
    const pedir = async () => {
      try {
        const t = await navigator.wakeLock.request('screen')
        if (cancelado) void t.release()
        else trava = t
      } catch {
        // Sem suporte ou negado pela economia de bateria: o treino segue normalmente.
      }
    }
    void pedir()
    const aoVoltar = () => { if (document.visibilityState === 'visible') void pedir() }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      cancelado = true
      document.removeEventListener('visibilitychange', aoVoltar)
      void trava?.release()
    }
  }, [ativo])

  // Sons e vibração, uma vez por evento.
  useEffect(() => {
    if (estado === 'pronto' || estado === 'pausado') return
    const ctx = audioRef.current
    const disparar = (nome: string, fn: () => void) => {
      const chave = `${idx}:${nome}`
      if (disparados.current.has(chave)) return
      disparados.current.add(chave)
      fn()
    }
    if (estado === 'fim') {
      disparar('fim', () => { sons.fim(ctx); if (vibracao) vibrar([300, 100, 300]) })
      return
    }
    // Voltar de segundo plano no meio de uma fase não toca o sino de início atrasado.
    const atrasada = decorrido - fase.inicio > 2
    if (fase.tipo === 'round') disparar('inicio', () => { if (atrasada) return; sons.inicioRound(ctx); if (vibracao) vibrar(250) })
    if (fase.tipo === 'descanso') disparar('inicio', () => { if (atrasada) return; sons.inicioDescanso(ctx); if (vibracao) vibrar([120, 80, 120]) })
    if (fase.tipo === 'round' && fase.duracao > 25 && restante <= 10 && restante > 0) {
      disparar('aviso', () => { sons.aviso(ctx); if (vibracao) vibrar([80, 60, 80]) })
    }
    if (fase.tipo !== 'round' && restante >= 1 && restante <= 3) disparar(`c${restante}`, () => sons.contagem(ctx))
  }, [estado, idx, fase, restante, decorrido, sons, vibracao])

  // O áudio é fechado ao sair da tela (com uma folga para o som do fim terminar de tocar) e ao iniciar de novo: o Safari limita quantos ficam abertos.
  useEffect(() => () => fecharAudio(audioRef.current, 3000), [])

  // Bloquear a tela suspende o áudio no iPhone: ao voltar, religa.
  useEffect(() => {
    const aoVoltar = () => { if (document.visibilityState === 'visible' && audioRef.current?.state !== 'running') void audioRef.current?.resume().catch(() => undefined) }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => document.removeEventListener('visibilitychange', aoVoltar)
  }, [])

  const iniciar = useCallback(() => {
    fecharAudio(audioRef.current, 0)
    audioRef.current = criarAudio() // precisa nascer de um toque do usuário
    const t = Date.now()
    disparados.current.clear()
    setExec({ inicio: t, pausadoEm: null, pausadoTotal: 0, adiantado: 0, fimEm: null })
    setAgora(t)
  }, [])

  const pausar = useCallback(() => {
    const t = Date.now()
    setExec(e => (e && e.pausadoEm === null && e.fimEm === null ? { ...e, pausadoEm: t } : e))
    setAgora(t)
  }, [])

  const retomar = useCallback(() => {
    const t = Date.now()
    setExec(e => (e && e.pausadoEm !== null ? { ...e, pausadoTotal: e.pausadoTotal + (t - e.pausadoEm), pausadoEm: null } : e))
    setAgora(t)
  }, [])

  const pular = useCallback(() => {
    const falta = fase.inicio + fase.duracao - decorrido
    setExec(e => (e && e.fimEm === null ? { ...e, adiantado: e.adiantado + Math.max(0, falta) + 0.01 } : e))
  }, [fase, decorrido])

  const encerrar = useCallback(() => {
    const t = Date.now()
    setExec(e => (e ? encerrarExecucao(e, t) : e))
    setAgora(t)
  }, [])

  return { estado, fases, idx, fase, restante, decorrido, decorridoReal, total, roundsFeitos, iniciar, pausar, retomar, pular, encerrar }
}
