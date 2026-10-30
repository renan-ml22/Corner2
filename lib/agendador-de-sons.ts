// Programa os sons do cronômetro no relógio do áudio (AudioContext.currentTime), e não num cronômetro de JavaScript.
// Com a página em segundo plano o navegador congela o JavaScript, mas o áudio já programado segue tocando no horário.
// O horário de cada som vem do relógio do aparelho (ver `medirRelogio`): a cada pausa, retomada, pulo de fase ou volta
// à tela, tudo o que ainda não tocou é cortado e programado de novo a partir dele.

import type { EventoDeSom, SonsDoCronometro } from '@/lib/agenda-sons'

/** Um som que passou há menos que isto ainda toca (na hora): o JavaScript pode demorar uns instantes para perceber a troca. */
export const TOLERANCIA_DO_AGENDADOR_S = 0.5

/** Quanto o relógio do áudio pode se afastar do andamento do treino antes de valer a pena programar tudo de novo. */
export const DESCOLAMENTO_MAXIMO_S = 0.1

export interface Agendador {
  /** Programa o que ainda vem. `decorrido` é o andamento do treino, em segundos, neste instante. */
  sincronizar(decorrido: number, sons: SonsDoCronometro): void
  /**
   * Como `sincronizar`, mas só se o relógio do áudio se descolou do treino (o iPhone para o áudio com o app em segundo
   * plano: o horário programado deixa de bater com o relógio do aparelho). Se andaram juntos, o que está programado vale.
   */
  ressincronizar(decorrido: number, sons: SonsDoCronometro): void
  /** Corta os sons que ainda não começaram (pausa, saída da tela). O que já está soando termina. */
  cancelarPendentes(): void
  /** Encerrou na mão: corta o que falta e toca o fim do treino agora (uma vez só). */
  encerrar(sons: SonsDoCronometro): void
}

/**
 * O mesmo áudio, mas com o relógio adiantado em `atraso` segundos e a saída trocada por `destino`. Assim os sons
 * (lib/som.ts, lib/som-timer.ts) são escritos como se tocassem "agora", e o agendador os põe no futuro e pode cortá-los.
 */
function audioDoSom(ctx: AudioContext, destino: AudioNode, atraso: number): AudioContext {
  return new Proxy(ctx, {
    get(alvo, prop) {
      if (prop === 'currentTime') return alvo.currentTime + atraso
      if (prop === 'destination') return destino
      const valor = Reflect.get(alvo, prop, alvo)
      return typeof valor === 'function' ? valor.bind(alvo) : valor
    },
  })
}

function tocarEvento(ctx: AudioContext, sons: SonsDoCronometro, e: EventoDeSom, destino: AudioNode, atraso: number): void {
  const c = audioDoSom(ctx, destino, atraso)
  if (e.nome === 'contagem') sons.contagem(c, e.restante ?? 1)
  else sons[e.nome](c)
}

export function criarAgendador(ctx: AudioContext | null, eventos: EventoDeSom[]): Agendador {
  /** Chaves dos sons que já começaram: nunca tocam de novo. */
  const comecados = new Set<string>()
  const pendentes = new Map<string, { quando: number; porta: AudioNode }>()

  /** Passa para "começados" os pendentes cujo horário já chegou no relógio do áudio. */
  const separarOsQueComecaram = () => {
    if (!ctx) return
    const agora = ctx.currentTime
    for (const [chave, p] of pendentes) {
      if (p.quando <= agora) {
        comecados.add(chave)
        pendentes.delete(chave)
      }
    }
  }

  const cancelarPendentes = () => {
    if (!ctx) return
    separarOsQueComecaram()
    for (const p of pendentes.values()) {
      try { p.porta.disconnect() } catch { /* já desligada */ }
    }
    pendentes.clear()
  }

  const programar = (e: EventoDeSom, atraso: number, sons: SonsDoCronometro) => {
    if (!ctx) return
    try {
      // Uma porta por som: desligá-la corta aquele som (e só ele) antes de começar.
      const porta = ctx.createGain()
      porta.connect(ctx.destination)
      pendentes.set(e.chave, { quando: ctx.currentTime + atraso, porta })
      tocarEvento(ctx, sons, e, porta, atraso)
    } catch {
      // Áudio fechado ou som com defeito: os outros sons continuam.
    }
  }

  /** O relógio do áudio e o andamento do treino na última programação: a partir deles se vê se andaram juntos. */
  let ancora: { audio: number; treino: number } | null = null

  const sincronizar = (decorrido: number, sons: SonsDoCronometro) => {
    if (!ctx) return
    cancelarPendentes()
    ancora = { audio: ctx.currentTime, treino: decorrido }
    for (const e of eventos) {
      if (comecados.has(e.chave) || e.em < decorrido - TOLERANCIA_DO_AGENDADOR_S) continue
      programar(e, Math.max(0, e.em - decorrido), sons)
    }
  }

  return {
    sincronizar,
    ressincronizar(decorrido, sons) {
      if (!ctx) return
      const descolamento = ancora ? Math.abs(ctx.currentTime - ancora.audio - (decorrido - ancora.treino)) : Infinity
      if (descolamento > DESCOLAMENTO_MAXIMO_S) sincronizar(decorrido, sons)
    },
    cancelarPendentes,
    encerrar(sons) {
      if (!ctx) return
      cancelarPendentes()
      const fim = eventos.find(e => e.nome === 'fim')
      if (fim && !comecados.has(fim.chave)) programar(fim, 0, sons)
    },
  }
}
