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

export function montarFases(rounds: number, roundSeg: number, descansoSeg: number): FaseCrono[] {
  const fases: FaseCrono[] = []
  let t = 0
  const add = (tipo: FaseCrono['tipo'], round: number, duracao: number) => {
    fases.push({ tipo, round, duracao, inicio: t })
    t += duracao
  }
  add('preparo', 1, PREPARO_SEG)
  for (let r = 1; r <= rounds; r++) {
    add('round', r, roundSeg)
    if (r < rounds && descansoSeg > 0) add('descanso', r, descansoSeg)
  }
  return fases
}

export type EstadoCrono = 'pronto' | 'rodando' | 'pausado' | 'fim'

interface Execucao {
  inicio: number
  pausadoEm: number | null
  pausadoTotal: number
  /** Segundos pulados pelo usuário ao avançar de fase */
  adiantado: number
  fimEm: number | null
}

interface Opcoes {
  rounds: number
  roundSeg: number
  descansoSeg: number
}

/**
 * Cronômetro de rounds. O tempo vem do relógio (Date.now) e não de contar "ticks",
 * então segue correto mesmo quando o navegador reduz a frequência dos timers em segundo plano.
 */
export function useCronometro({ rounds, roundSeg, descansoSeg }: Opcoes) {
  const [fases] = useState(() => montarFases(rounds, roundSeg, descansoSeg))
  const [exec, setExec] = useState<Execucao | null>(null)
  const [agora, setAgora] = useState(0)
  const audioRef = useRef<AudioContext | null>(null)
  const disparados = useRef(new Set<string>())

  const total = fases[fases.length - 1].inicio + fases[fases.length - 1].duracao
  const fimDoRelogio = exec ? (exec.fimEm ?? exec.pausadoEm ?? agora) : 0
  const decorridoReal = exec ? Math.max(0, (fimDoRelogio - exec.inicio - exec.pausadoTotal) / 1000) : 0
  const decorrido = exec ? decorridoReal + exec.adiantado : 0

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
      disparar('fim', () => { tocarSino(ctx, 3); vibrar([300, 100, 300]) })
      return
    }
    if (fase.tipo === 'round') disparar('inicio', () => { tocarSino(ctx, 1); vibrar(250) })
    if (fase.tipo === 'descanso') disparar('inicio', () => { tocarSino(ctx, 2); vibrar([120, 80, 120]) })
    if (fase.tipo === 'round' && fase.duracao > 25 && restante <= 10 && restante > 0) {
      disparar('aviso', () => { tocarMatraca(ctx); vibrar([80, 60, 80]) })
    }
    if (fase.tipo !== 'round' && restante >= 1 && restante <= 3) disparar(`c${restante}`, () => tocarBip(ctx))
  }, [estado, idx, fase, restante])

  const iniciar = useCallback(() => {
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
    setExec(e => (e && e.fimEm === null ? { ...e, fimEm: t } : e))
    setAgora(t)
  }, [])

  return { estado, fases, idx, fase, restante, decorrido, decorridoReal, total, roundsFeitos, iniciar, pausar, retomar, pular, encerrar }
}
