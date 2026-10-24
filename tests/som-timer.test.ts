import { describe, expect, it } from 'vitest'
import {
  BIPES_AVISO_10S, BIPES_FIM_DE_ROUND, BIPES_FIM_DO_TREINO, BIPES_INICIO_DE_ROUND, criarSonsDoTimer, ganhoDoVolume, tocarBipes, type Bipe,
} from '@/lib/som-timer'

// Os sons do Timer, gerados na hora com Web Audio (sem arquivos): o que cada aviso toca e o volume.

describe('os bipes de cada aviso (frequência em Hz, tempos em segundos)', () => {
  it('início de round: 3 bipes curtos de 100 ms (com 150 ms entre eles) e 1 longo de 600 ms, todos em 880 Hz', () => {
    expect(BIPES_INICIO_DE_ROUND).toEqual([
      { freq: 880, inicio: 0, duracao: 0.1 },
      { freq: 880, inicio: 0.25, duracao: 0.1 },
      { freq: 880, inicio: 0.5, duracao: 0.1 },
      { freq: 880, inicio: 0.75, duracao: 0.6 },
    ])
  })

  it('aviso dos 10 segundos: 1 bipe de 200 ms em 660 Hz', () => {
    expect(BIPES_AVISO_10S).toEqual([{ freq: 660, inicio: 0, duracao: 0.2 }])
  })

  it('fim de round e início do descanso: 1 bipe longo de 800 ms em 440 Hz', () => {
    expect(BIPES_FIM_DE_ROUND).toEqual([{ freq: 440, inicio: 0, duracao: 0.8 }])
  })

  it('fim de todos os rounds: 3 bipes longos de 400 ms subindo 880 -> 1100 -> 1320 Hz, um depois do outro', () => {
    expect(BIPES_FIM_DO_TREINO.map(b => b.freq)).toEqual([880, 1100, 1320])
    expect(BIPES_FIM_DO_TREINO.map(b => b.duracao)).toEqual([0.4, 0.4, 0.4])
    for (let i = 1; i < BIPES_FIM_DO_TREINO.length; i++) {
      const anterior = BIPES_FIM_DO_TREINO[i - 1]
      expect(BIPES_FIM_DO_TREINO[i].inicio, `bipe ${i + 1} começa depois do anterior terminar`).toBeGreaterThanOrEqual(anterior.inicio + anterior.duracao)
    }
  })

  it('nenhum bipe de nenhum aviso se sobrepõe a outro do mesmo aviso', () => {
    for (const lista of [BIPES_INICIO_DE_ROUND, BIPES_AVISO_10S, BIPES_FIM_DE_ROUND, BIPES_FIM_DO_TREINO]) {
      for (let i = 1; i < lista.length; i++) expect(lista[i].inicio).toBeGreaterThanOrEqual(lista[i - 1].inicio + lista[i - 1].duracao)
    }
  })
})

describe('ganhoDoVolume (volume de 0 a 100 vira a força do som, de 0 a 1)', () => {
  it('0% é silêncio e 100% é o máximo seguro (abaixo de 1, para não estourar o alto-falante)', () => {
    expect(ganhoDoVolume(0, false)).toBe(0)
    expect(ganhoDoVolume(100, false)).toBeGreaterThan(0.4)
    expect(ganhoDoVolume(100, false)).toBeLessThanOrEqual(0.8)
  })

  it('mudo é silêncio, qualquer que seja o volume', () => {
    for (const v of [0, 30, 100]) expect(ganhoDoVolume(v, true)).toBe(0)
  })

  it('quanto maior o volume, mais forte o som (nunca diminui)', () => {
    let anterior = -1
    for (let v = 0; v <= 100; v += 5) {
      const g = ganhoDoVolume(v, false)
      expect(g).toBeGreaterThanOrEqual(anterior)
      anterior = g
    }
  })

  it('valores absurdos não passam do limite nem ficam negativos', () => {
    expect(ganhoDoVolume(500, false)).toBe(ganhoDoVolume(100, false))
    expect(ganhoDoVolume(-20, false)).toBe(0)
    expect(ganhoDoVolume(Number.NaN, false)).toBe(0)
  })
})

// Um AudioContext de mentira que anota o que seria tocado: cada oscilador, a rampa do volume dele e as ligações.
interface Oscilador { freq: number; inicio: number; fim: number; ligadoAoGanho: boolean; ganhoLigadoAoAlto: boolean; ganhos: [number, number][]; readonly maximo: number }
interface NoDeGanho { ganhos: [number, number][]; saiParaOAlto: boolean; gain: object; connect: (alvo: unknown) => unknown }

function audioFalso() {
  const osciladores: Oscilador[] = []
  const saida = { tipo: 'saida' }
  const ctx = {
    currentTime: 10,
    destination: saida,
    createOscillator() {
      let no: NoDeGanho | null = null
      const registro: Oscilador = {
        freq: 0, inicio: 0, fim: 0,
        get ligadoAoGanho() { return no !== null },
        get ganhoLigadoAoAlto() { return no?.saiParaOAlto ?? false },
        get ganhos() { return no?.ganhos ?? [] },
        get maximo() { return Math.max(0, ...(no?.ganhos ?? []).map(([, v]) => v)) },
      } as Oscilador
      return {
        type: 'sine',
        frequency: { set value(v: number) { registro.freq = v }, get value() { return registro.freq } },
        connect(alvo: NoDeGanho) { no = alvo; return alvo },
        start(t: number) { registro.inicio = t; osciladores.push(registro) },
        stop(t: number) { registro.fim = t },
      }
    },
    createGain(): NoDeGanho {
      const no: NoDeGanho = {
        ganhos: [],
        saiParaOAlto: false,
        gain: {
          setValueAtTime(valor: number, t: number) { no.ganhos.push([t, valor]) },
          linearRampToValueAtTime(valor: number, t: number) { no.ganhos.push([t, valor]) },
        },
        connect(alvo: unknown) { no.saiParaOAlto = alvo === saida; return alvo },
      }
      return no
    },
  }
  return { ctx: ctx as unknown as AudioContext, osciladores }
}

describe('tocarBipes', () => {
  it('cria um oscilador por bipe, na frequência e no tempo certos (a partir do relógio do áudio)', () => {
    const { ctx, osciladores } = audioFalso()
    tocarBipes(ctx, BIPES_INICIO_DE_ROUND, 0.5)
    expect(osciladores).toHaveLength(4)
    expect(osciladores.map(o => o.freq)).toEqual([880, 880, 880, 880])
    // O relógio do áudio está em 10 s: os bipes saem um pouco depois disso, sem cair no passado.
    const inicios = osciladores.map(o => o.inicio)
    expect(inicios[0]).toBeGreaterThanOrEqual(10)
    expect(inicios[0]).toBeLessThan(10.1)
    expect(inicios[3] - inicios[0]).toBeCloseTo(0.75, 5)
    // O último bipe dura 600 ms.
    expect(osciladores[3].fim - inicios[3]).toBeGreaterThanOrEqual(0.6)
  })

  it('volume zero não cria som nenhum', () => {
    const { ctx, osciladores } = audioFalso()
    tocarBipes(ctx, BIPES_FIM_DO_TREINO, 0)
    expect(osciladores).toHaveLength(0)
  })

  it('sem áudio (navegador sem suporte ou ainda não liberado): não faz nada e não dá erro', () => {
    expect(() => tocarBipes(null, BIPES_AVISO_10S, 0.5)).not.toThrow()
  })

  it('cada som passa por um controle de ganho que vai até a saída (senão o volume e o mudo não valeriam)', () => {
    const { ctx, osciladores } = audioFalso()
    tocarBipes(ctx, BIPES_INICIO_DE_ROUND, 0.5)
    for (const o of osciladores) {
      expect(o.ligadoAoGanho).toBe(true)
      expect(o.ganhoLigadoAoAlto).toBe(true)
    }
  })

  it('o som começa e termina em silêncio (sem estalo): sobe do zero e volta a zero no fim do bipe', () => {
    const { ctx, osciladores } = audioFalso()
    tocarBipes(ctx, BIPES_FIM_DE_ROUND, 0.5)
    const { ganhos, inicio } = osciladores[0]
    expect(ganhos[0]).toEqual([inicio, 0])
    expect(ganhos[ganhos.length - 1][1]).toBe(0)
    // O último ajuste de volume acontece quando o bipe de 800 ms termina.
    expect(ganhos[ganhos.length - 1][0]).toBeCloseTo(inicio + 0.8, 5)
  })

  it('o ganho aplicado ao som é o pedido (não passa dele)', () => {
    const { ctx, osciladores } = audioFalso()
    tocarBipes(ctx, [{ freq: 440, inicio: 0, duracao: 0.2 }] as Bipe[], 0.3)
    expect(osciladores[0].maximo).toBeCloseTo(0.3, 5)
  })
})

describe('criarSonsDoTimer: lê o volume e o mudo na hora de tocar (mudar o volume com o timer rodando vale na hora)', () => {
  it('cada aviso toca os bipes dele (e a contagem é um bipe curto de 880 Hz)', () => {
    const { ctx, osciladores } = audioFalso()
    const sons = criarSonsDoTimer(() => ({ volume: 100, mudo: false }))
    sons.inicioRound(ctx)
    expect(osciladores.map(o => o.freq)).toEqual([880, 880, 880, 880])
    osciladores.length = 0
    sons.aviso(ctx)
    expect(osciladores.map(o => o.freq)).toEqual([660])
    osciladores.length = 0
    sons.inicioDescanso(ctx)
    expect(osciladores.map(o => o.freq)).toEqual([440])
    osciladores.length = 0
    sons.fim(ctx)
    expect(osciladores.map(o => o.freq)).toEqual([880, 1100, 1320])
    osciladores.length = 0
    sons.contagem(ctx)
    expect(osciladores.map(o => o.freq)).toEqual([880])
    expect(osciladores[0].fim - osciladores[0].inicio).toBeLessThan(0.3)
  })

  it('mudo: nada toca', () => {
    const { ctx, osciladores } = audioFalso()
    const sons = criarSonsDoTimer(() => ({ volume: 100, mudo: true }))
    sons.inicioRound(ctx); sons.aviso(ctx); sons.inicioDescanso(ctx); sons.fim(ctx); sons.contagem(ctx)
    expect(osciladores).toHaveLength(0)
  })

  it('o volume é lido a cada aviso, não só uma vez', () => {
    const { ctx, osciladores } = audioFalso()
    let volume = 100
    const sons = criarSonsDoTimer(() => ({ volume, mudo: false }))
    sons.aviso(ctx)
    const alto = osciladores[0].maximo
    volume = 20
    sons.aviso(ctx)
    expect(osciladores[1].maximo).toBeLessThan(alto)
    expect(osciladores[1].maximo).toBeGreaterThan(0)
  })
})
