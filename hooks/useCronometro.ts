'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { agendaDeSons, numeroDaContagem, type FaseCrono, type SonsDoCronometro } from '@/lib/agenda-sons'
import { criarAgendador, type Agendador } from '@/lib/agendador-de-sons'
import { criarAudio, tocarBip, tocarMatraca, tocarSino, vibrar } from '@/lib/som'

export const PREPARO_SEG = 10

export type { FaseCrono, SonsDoCronometro }
export { numeroDaContagem }

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
  /** Contar 3-2-1 também no fim de cada round (padrão: não; o treino do plano só conta no preparo e no descanso). */
  contagemNoRound?: boolean
  /** Vibrar a cada troca de fase (onde o aparelho deixa). Padrão: sim. */
  vibracao?: boolean
}

/**
 * Cronômetro de rounds. O tempo vem do relógio (Date.now) e não de contar "ticks",
 * então segue correto mesmo quando o navegador reduz a frequência dos timers em segundo plano.
 */
export function useCronometro({ rounds, roundSeg, descansoSeg, preparoSeg = PREPARO_SEG, sons = SONS_DO_TREINO, contagemNoRound = false, vibracao = true }: Opcoes) {
  const [fases] = useState(() => montarFases(rounds, roundSeg, descansoSeg, preparoSeg))
  const eventos = useMemo(() => agendaDeSons(fases, contagemNoRound), [fases, contagemNoRound])
  const [exec, setExec] = useState<Execucao | null>(null)
  const [agora, setAgora] = useState(0)
  const audioRef = useRef<AudioContext | null>(null)
  const agendadorRef = useRef<Agendador | null>(null)
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

  // Os sons são programados no relógio do áudio, e não disparados por este componente: assim tocam no horário mesmo com a
  // página em segundo plano (o navegador congela o JavaScript, o áudio já programado não). Tudo o que ainda não tocou é
  // programado de novo a cada pausa, retomada, pulo de fase, mudança de volume e quando a página volta à tela ou o áudio
  // volta a rodar (o iPhone para o relógio do áudio com o app em segundo plano).
  useEffect(() => {
    const agendador = agendadorRef.current
    if (!agendador || !exec) return
    const sincronizar = (soSeDescolou: boolean) => {
      if (exec.fimEm !== null) agendador.encerrar(sons)
      else if (exec.pausadoEm !== null) agendador.cancelarPendentes()
      else {
        const decorrido = medirRelogio(exec, Date.now(), total).decorrido
        if (soSeDescolou) agendador.ressincronizar(decorrido, sons)
        else agendador.sincronizar(decorrido, sons)
      }
    }
    sincronizar(false)
    const aoVoltar = () => sincronizar(true)
    document.addEventListener('visibilitychange', aoVoltar)
    // O áudio que voltou a rodar depois de parado pelo aparelho (ligação, outro app): o relógio dele ficou para trás.
    // A primeira partida do áudio (suspenso -> rodando) não conta: ele ainda não tinha tocado nada.
    const ctx = audioRef.current
    let rodou = ctx?.state === 'running'
    let parou = false
    const aoMudarEstado = () => {
      if (ctx?.state === 'running') {
        if (rodou && parou) aoVoltar()
        rodou = true
        parou = false
      } else if (rodou) {
        parou = true
      }
    }
    // Safari antigo (webkitAudioContext) pode não ter addEventListener: sem ele só não acompanha o áudio parar e voltar.
    ctx?.addEventListener?.('statechange', aoMudarEstado)
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar)
      ctx?.removeEventListener?.('statechange', aoMudarEstado)
    }
  }, [exec, sons, total])

  // Vibração, uma vez por evento (só com a página aberta: nenhum aparelho vibra em segundo plano).
  useEffect(() => {
    if (!vibracao || estado === 'pronto' || estado === 'pausado') return
    const disparar = (nome: string, fn: () => void) => {
      const chave = `${idx}:${nome}`
      if (disparados.current.has(chave)) return
      disparados.current.add(chave)
      fn()
    }
    if (estado === 'fim') {
      disparar('fim', () => vibrar([300, 100, 300]))
      return
    }
    // Voltar de segundo plano no meio de uma fase não vibra o início atrasado.
    const atrasada = decorrido - fase.inicio > 2
    if (fase.tipo === 'round') disparar('inicio', () => { if (!atrasada) vibrar(250) })
    if (fase.tipo === 'descanso') disparar('inicio', () => { if (!atrasada) vibrar([120, 80, 120]) })
    if (fase.tipo === 'round' && fase.duracao > 25 && restante <= 10 && restante > 0) {
      disparar('aviso', () => vibrar([80, 60, 80]))
    }
  }, [estado, idx, fase, restante, decorrido, vibracao])

  // O áudio é fechado ao sair da tela (com uma folga para o som do fim terminar de tocar) e ao iniciar de novo: o Safari limita quantos ficam abertos.
  // Os sons que ainda não começaram são cortados: sair da tela com o treino andando não pode deixar sino programado para depois.
  useEffect(() => () => {
    agendadorRef.current?.cancelarPendentes()
    fecharAudio(audioRef.current, 3000)
  }, [])

  // Bloquear a tela suspende o áudio no iPhone: ao voltar, religa.
  useEffect(() => {
    const aoVoltar = () => { if (document.visibilityState === 'visible' && audioRef.current?.state !== 'running') void audioRef.current?.resume().catch(() => undefined) }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => document.removeEventListener('visibilitychange', aoVoltar)
  }, [])

  const iniciar = useCallback(() => {
    agendadorRef.current?.cancelarPendentes()
    fecharAudio(audioRef.current, 0)
    audioRef.current = criarAudio() // precisa nascer de um toque do usuário
    agendadorRef.current = criarAgendador(audioRef.current, eventos)
    const t = Date.now()
    disparados.current.clear()
    setExec({ inicio: t, pausadoEm: null, pausadoTotal: 0, adiantado: 0, fimEm: null })
    setAgora(t)
  }, [eventos])

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
    // Mede pelo relógio no instante do toque (e não pelo último desenho da tela, até 0,2 s atrasado): o pulo cai logo
    // depois da virada, e os sons da fase nova (que começam na virada) entram na tolerância do agendador.
    setExec(e => {
      if (!e || e.fimEm !== null) return e
      const { decorrido: agoraDecorrido } = medirRelogio(e, Date.now(), total)
      const atual = fases.find(f => agoraDecorrido < f.inicio + f.duracao) ?? fases[fases.length - 1]
      const falta = atual.inicio + atual.duracao - agoraDecorrido
      return { ...e, adiantado: e.adiantado + Math.max(0, falta) + 0.01 }
    })
  }, [fases, total])

  const encerrar = useCallback(() => {
    const t = Date.now()
    setExec(e => (e ? encerrarExecucao(e, t) : e))
    setAgora(t)
  }, [])

  return { estado, fases, idx, fase, restante, decorrido, decorridoReal, total, roundsFeitos, iniciar, pausar, retomar, pular, encerrar }
}
