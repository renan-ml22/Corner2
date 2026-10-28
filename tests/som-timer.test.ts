import { describe, expect, it } from 'vitest'
import {
  BADALADAS_FIM_DE_ROUND, BADALADAS_FIM_DO_TREINO, BADALADAS_INICIO_DE_ROUND, BIPES_AVISO_10S, PARCIAIS_DO_SINO, SATURACAO_DO_SINO,
  bipeDeContagem, criarSonsDoTimer, ganhoDoVolume, tocarBadaladas, tocarBipes, type Bipe,
} from '@/lib/som-timer'

// Os sons do Timer, gerados na hora com Web Audio (sem arquivos): o que cada aviso toca e o volume.

describe('o sino de ringue', () => {
  it('é feito de vários tons que NÃO são múltiplos um do outro (é isso que dá o som metálico de sino, e não de apito)', () => {
    expect(PARCIAIS_DO_SINO.length).toBeGreaterThanOrEqual(6)
    const quebrados = PARCIAIS_DO_SINO.filter(p => Math.abs(p.razao - Math.round(p.razao)) > 0.05)
    expect(quebrados.length).toBeGreaterThanOrEqual(4)
  })

  it('tem tons agudos (acima de 3 kHz), que o alto-falante pequeno do celular reproduz bem, e nenhum grave demais para ele', () => {
    const base = 1000
    const freqs = PARCIAIS_DO_SINO.map(p => p.razao * base)
    expect(Math.max(...freqs)).toBeGreaterThan(3000)
    expect(Math.min(...freqs)).toBeGreaterThanOrEqual(400)
  })

  it('os tons agudos somem antes dos graves (como num sino de verdade): o mais agudo dura bem menos que o mais grave', () => {
    const maisGrave = PARCIAIS_DO_SINO.reduce((a, b) => (b.razao < a.razao ? b : a))
    const maisAgudo = PARCIAIS_DO_SINO.reduce((a, b) => (b.razao > a.razao ? b : a))
    expect(maisAgudo.duracao).toBeLessThan(maisGrave.duracao / 2)
    for (const p of PARCIAIS_DO_SINO) {
      expect(p.duracao).toBeGreaterThan(0)
      expect(p.duracao).toBeLessThanOrEqual(1)
      expect(p.ganho).toBeGreaterThan(0)
    }
  })

  it('início do round: uma badalada longa (o "dinnnng" do ringue)', () => {
    expect(BADALADAS_INICIO_DE_ROUND).toHaveLength(1)
    expect(BADALADAS_INICIO_DE_ROUND[0].inicio).toBe(0)
    expect(BADALADAS_INICIO_DE_ROUND[0].duracao).toBeGreaterThanOrEqual(2)
  })

  it('fim do round (entra no descanso): "ting ting ting", 3 badaladas num ritmo de ~½ segundo', () => {
    expect(BADALADAS_FIM_DE_ROUND).toHaveLength(3)
    const passos = BADALADAS_FIM_DE_ROUND.slice(1).map((b, i) => b.inicio - BADALADAS_FIM_DE_ROUND[i].inicio)
    for (const p of passos) {
      expect(p).toBeGreaterThanOrEqual(0.35)
      expect(p).toBeLessThanOrEqual(0.7)
    }
  })

  it('fim de todos os rounds: 4 badaladas, uma a mais que o fim de round, a última mais longa', () => {
    expect(BADALADAS_FIM_DO_TREINO).toHaveLength(BADALADAS_FIM_DE_ROUND.length + 1)
    const duracoes = BADALADAS_FIM_DO_TREINO.map(b => b.duracao)
    expect(duracoes[duracoes.length - 1]).toBe(Math.max(...duracoes))
  })
})

describe('bipes: aviso dos 10 segundos e contagem 3-2-1', () => {
  it('aviso dos 10 segundos: 1 bipe de 200 ms em 660 Hz', () => {
    expect(BIPES_AVISO_10S).toEqual([{ freq: 660, inicio: 0, duracao: 0.2 }])
  })

  it('a contagem 3-2-1 sobe de tom a cada número (1000, 1250 e 1600 Hz): dá para saber que falta pouco só de ouvir', () => {
    const freq = (n: number) => bipeDeContagem(n)[0].freq
    expect([freq(3), freq(2), freq(1)]).toEqual([1000, 1250, 1600])
  })

  it('cada número da contagem é um bipe curto, de onda quadrada (som seco, bem diferente do sino)', () => {
    for (const n of [3, 2, 1]) {
      const bipes = bipeDeContagem(n)
      expect(bipes).toHaveLength(1)
      expect(bipes[0].duracao).toBeLessThanOrEqual(0.3)
      expect(bipes[0].onda).toBe('square')
    }
  })

  it('número fora de 1 a 3 cai no mais próximo (nunca quebra)', () => {
    expect(bipeDeContagem(0)[0].freq).toBe(bipeDeContagem(1)[0].freq)
    expect(bipeDeContagem(7)[0].freq).toBe(bipeDeContagem(3)[0].freq)
    expect(bipeDeContagem(Number.NaN)[0].freq).toBeGreaterThan(0)
  })
})

describe('ganhoDoVolume (volume de 0 a 100 vira a força do som, de 0 a 1)', () => {
  it('0% é silêncio e 100% é a força máxima (1)', () => {
    expect(ganhoDoVolume(0, false)).toBe(0)
    expect(ganhoDoVolume(100, false)).toBe(1)
  })

  it('80% (o volume que já estava guardado em quem usou o Timer antes) fica mais forte do que era (era 0,48)', () => {
    expect(ganhoDoVolume(80, false)).toBeGreaterThan(0.48)
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
interface No { saidas: unknown[] }
interface Oscilador { tipo: string; freq: number; inicio: number; fim: number; ganhos: [number, number][]; alcancaASaida: boolean; readonly maximo: number }

function audioFalso() {
  const osciladores: Oscilador[] = []
  const saida = { saidas: [] as unknown[] }
  const alcanca = (no: unknown, visitados = new Set<unknown>()): boolean => {
    if (no === saida) return true
    if (visitados.has(no)) return false
    visitados.add(no)
    return ((no as No).saidas ?? []).some(s => alcanca(s, visitados))
  }
  const ganhosDaSaida: { gain: { value: number } }[] = []
  const formas: { curve: Float32Array | null }[] = []
  const barras: { gain: { value: number } }[] = []
  const ctx = {
    currentTime: 10,
    destination: saida,
    createOscillator() {
      const no: No = { saidas: [] }
      let ganhoLigado: { ganhos: [number, number][] } | null = null
      const registro = {
        tipo: 'sine', freq: 0, inicio: 0, fim: 0,
        get ganhos() { return ganhoLigado?.ganhos ?? [] },
        get alcancaASaida() { return alcanca(no) },
        get maximo() { return Math.max(0, ...(ganhoLigado?.ganhos ?? []).map(([, v]) => v)) },
      } as Oscilador
      return {
        set type(t: string) { registro.tipo = t },
        get type() { return registro.tipo },
        frequency: { set value(v: number) { registro.freq = v }, get value() { return registro.freq } },
        connect(alvo: No & { ganhos?: [number, number][] }) { no.saidas.push(alvo); if (alvo.ganhos) ganhoLigado = alvo as { ganhos: [number, number][] }; return alvo },
        start(t: number) { registro.inicio = t; osciladores.push(registro) },
        stop(t: number) { registro.fim = t },
      }
    },
    createGain() {
      const no = {
        saidas: [] as unknown[],
        ganhos: [] as [number, number][],
        gain: {
          value: 1,
          setValueAtTime(valor: number, t: number) { no.ganhos.push([t, valor]) },
          linearRampToValueAtTime(valor: number, t: number) { no.ganhos.push([t, valor]) },
          exponentialRampToValueAtTime(valor: number, t: number) { no.ganhos.push([t, valor]) },
        },
        connect(alvo: unknown) {
          no.saidas.push(alvo)
          if (alvo === saida) ganhosDaSaida.push(no)
          if ((alvo as { curve?: unknown } | null)?.curve !== undefined) barras.push(no)
          return alvo
        },
      }
      return no
    },
    createWaveShaper() {
      const no = { saidas: [] as unknown[], curve: null as Float32Array | null, connect(alvo: unknown) { no.saidas.push(alvo); return alvo } }
      formas.push(no)
      return no
    },
  }
  return { ctx: ctx as unknown as AudioContext, osciladores, ganhosDaSaida, formas, barras }
}

const iniciosDistintos = (osc: Oscilador[]) => [...new Set(osc.map(o => o.inicio))].sort((a, b) => a - b)

describe('tocarBadaladas', () => {
  it('cada badalada vira um oscilador por tom do sino, todos começando juntos', () => {
    const { ctx, osciladores } = audioFalso()
    tocarBadaladas(ctx, BADALADAS_INICIO_DE_ROUND, 1)
    expect(osciladores).toHaveLength(PARCIAIS_DO_SINO.length)
    expect(iniciosDistintos(osciladores)).toHaveLength(1)
    expect(osciladores.every(o => o.tipo === 'sine')).toBe(true)
  })

  it('"ting ting ting": três badaladas, uma depois da outra, no ritmo combinado', () => {
    const { ctx, osciladores } = audioFalso()
    tocarBadaladas(ctx, BADALADAS_FIM_DE_ROUND, 1)
    expect(osciladores).toHaveLength(3 * PARCIAIS_DO_SINO.length)
    const inicios = iniciosDistintos(osciladores)
    expect(inicios).toHaveLength(3)
    expect(inicios[1] - inicios[0]).toBeCloseTo(BADALADAS_FIM_DE_ROUND[1].inicio, 5)
    expect(inicios[2] - inicios[0]).toBeCloseTo(BADALADAS_FIM_DE_ROUND[2].inicio, 5)
    // Começa logo depois do relógio do áudio (10 s), sem cair no passado.
    expect(inicios[0]).toBeGreaterThanOrEqual(10)
    expect(inicios[0]).toBeLessThan(10.1)
  })

  it('o tom mais grave toca pela duração da badalada inteira; os agudos terminam antes', () => {
    const { ctx, osciladores } = audioFalso()
    tocarBadaladas(ctx, BADALADAS_INICIO_DE_ROUND, 1)
    const duracoes = osciladores.map(o => o.fim - o.inicio)
    expect(Math.max(...duracoes)).toBeGreaterThanOrEqual(BADALADAS_INICIO_DE_ROUND[0].duracao)
    expect(Math.min(...duracoes)).toBeLessThan(Math.max(...duracoes) / 2)
  })

  it('o som nasce e termina em silêncio (sem estalo) e some pouco a pouco', () => {
    const { ctx, osciladores } = audioFalso()
    tocarBadaladas(ctx, BADALADAS_INICIO_DE_ROUND, 1)
    for (const o of osciladores) {
      expect(o.ganhos[0]).toEqual([o.inicio, 0])
      expect(o.ganhos[o.ganhos.length - 1][1]).toBeLessThan(0.001)
      expect(o.maximo).toBeGreaterThan(0)
    }
  })

  it('os tons somam 1 (a força de cada um é a parte dele no sino): o volume NÃO entra na força dos tons, entra no controle final', () => {
    const { ctx, osciladores } = audioFalso()
    tocarBadaladas(ctx, BADALADAS_INICIO_DE_ROUND, 0.5)
    expect(osciladores.reduce((s, o) => s + o.maximo, 0)).toBeCloseTo(1, 5)
  })

  it('o volume pedido é o controle final antes da saída: metade do volume, metade da força', () => {
    for (const volume of [1, 0.5, 0.2]) {
      const { ctx, ganhosDaSaida } = audioFalso()
      tocarBadaladas(ctx, BADALADAS_INICIO_DE_ROUND, volume)
      expect(ganhosDaSaida).toHaveLength(1)
      expect(ganhosDaSaida[0].gain.value).toBeCloseTo(volume, 5)
    }
  })

  it('os tons passam por uma saturação suave (curva que nunca passa de 1): o sino fica bem mais forte sem estourar o alto-falante', () => {
    const { ctx, formas } = audioFalso()
    tocarBadaladas(ctx, BADALADAS_FIM_DE_ROUND, 1)
    expect(formas).toHaveLength(1)
    const curva = formas[0].curve!
    expect(curva.length).toBeGreaterThanOrEqual(256)
    const meio = (curva.length - 1) / 2
    expect(Math.abs(curva[Math.floor(meio)])).toBeLessThan(0.01)
    for (let i = 1; i < curva.length; i++) expect(curva[i]).toBeGreaterThanOrEqual(curva[i - 1])
    expect(Math.max(...curva)).toBeCloseTo(1, 5)
    expect(Math.min(...curva)).toBeCloseTo(-1, 5)
    // Simétrica: o som não ganha "ruído" de um lado só.
    expect(curva[10] + curva[curva.length - 1 - 10]).toBeCloseTo(0, 5)
  })

  it('antes da saturação os tons são amplificados (SATURACAO_DO_SINO vezes): é isso que engorda o som', () => {
    const { ctx, barras } = audioFalso()
    tocarBadaladas(ctx, BADALADAS_INICIO_DE_ROUND, 1)
    expect(SATURACAO_DO_SINO).toBeGreaterThan(1)
    expect(barras).toHaveLength(1)
    expect(barras[0].gain.value).toBe(SATURACAO_DO_SINO)
  })

  it('tudo chega à saída do aparelho (senão o volume e o mudo não valeriam)', () => {
    const { ctx, osciladores } = audioFalso()
    tocarBadaladas(ctx, BADALADAS_FIM_DE_ROUND, 1)
    expect(osciladores.every(o => o.alcancaASaida)).toBe(true)
  })

  it('volume zero ou sem áudio: não faz nada e não dá erro', () => {
    const { ctx, osciladores } = audioFalso()
    tocarBadaladas(ctx, BADALADAS_FIM_DE_ROUND, 0)
    expect(osciladores).toHaveLength(0)
    expect(() => tocarBadaladas(null, BADALADAS_FIM_DE_ROUND, 1)).not.toThrow()
  })
})

describe('tocarBipes', () => {
  it('cria um oscilador por bipe, na frequência e no tempo certos (a partir do relógio do áudio)', () => {
    const { ctx, osciladores } = audioFalso()
    tocarBipes(ctx, [{ freq: 880, inicio: 0, duracao: 0.1 }, { freq: 880, inicio: 0.25, duracao: 0.6 }], 0.5)
    expect(osciladores.map(o => o.freq)).toEqual([880, 880])
    expect(osciladores[1].inicio - osciladores[0].inicio).toBeCloseTo(0.25, 5)
    expect(osciladores[0].inicio).toBeGreaterThanOrEqual(10)
    expect(osciladores[0].inicio).toBeLessThan(10.1)
    expect(osciladores[1].fim - osciladores[1].inicio).toBeGreaterThanOrEqual(0.6)
  })

  it('a onda do bipe é a pedida (padrão: senoide)', () => {
    const { ctx, osciladores } = audioFalso()
    tocarBipes(ctx, [{ freq: 440, inicio: 0, duracao: 0.2 }, { freq: 440, inicio: 0.3, duracao: 0.2, onda: 'square' }], 0.5)
    expect(osciladores.map(o => o.tipo)).toEqual(['sine', 'square'])
  })

  it('volume zero não cria som nenhum', () => {
    const { ctx, osciladores } = audioFalso()
    tocarBipes(ctx, BIPES_AVISO_10S, 0)
    expect(osciladores).toHaveLength(0)
  })

  it('sem áudio (navegador sem suporte ou ainda não liberado): não faz nada e não dá erro', () => {
    expect(() => tocarBipes(null, BIPES_AVISO_10S, 0.5)).not.toThrow()
  })

  it('cada som passa por um controle de ganho que vai até a saída', () => {
    const { ctx, osciladores } = audioFalso()
    tocarBipes(ctx, BIPES_AVISO_10S, 0.5)
    expect(osciladores[0].ganhos.length).toBeGreaterThan(0)
    expect(osciladores[0].alcancaASaida).toBe(true)
  })

  it('o som começa e termina em silêncio (sem estalo)', () => {
    const { ctx, osciladores } = audioFalso()
    tocarBipes(ctx, [{ freq: 440, inicio: 0, duracao: 0.8 }], 0.5)
    const { ganhos, inicio } = osciladores[0]
    expect(ganhos[0]).toEqual([inicio, 0])
    expect(ganhos[ganhos.length - 1][1]).toBe(0)
    expect(ganhos[ganhos.length - 1][0]).toBeCloseTo(inicio + 0.8, 5)
  })

  it('o ganho aplicado ao som é o pedido (não passa dele)', () => {
    const { ctx, osciladores } = audioFalso()
    tocarBipes(ctx, [{ freq: 440, inicio: 0, duracao: 0.2 }] as Bipe[], 0.3)
    expect(osciladores[0].maximo).toBeCloseTo(0.3, 5)
  })

  it('o bipe de onda quadrada leva uma força menor (a quadrada soa bem mais alta que a senoide com o mesmo ganho)', () => {
    const { ctx, osciladores } = audioFalso()
    tocarBipes(ctx, bipeDeContagem(1), 1)
    expect(osciladores[0].maximo).toBeLessThan(1)
    expect(osciladores[0].maximo).toBeGreaterThan(0.3)
  })
})

describe('criarSonsDoTimer: lê o volume e o mudo na hora de tocar (mudar o volume com o timer rodando vale na hora)', () => {
  const sons = (volume = 100, mudo = false) => criarSonsDoTimer(() => ({ volume, mudo }))

  it('início de round: uma badalada; fim de round: três; fim do treino: quatro', () => {
    const contar = (tocar: (c: AudioContext) => void) => {
      const { ctx, osciladores } = audioFalso()
      tocar(ctx)
      return iniciosDistintos(osciladores).length
    }
    const s = sons()
    expect(contar(c => s.inicioRound(c))).toBe(1)
    expect(contar(c => s.inicioDescanso(c))).toBe(3)
    expect(contar(c => s.fim(c))).toBe(4)
  })

  it('o aviso dos 10 segundos é um bipe de 660 Hz', () => {
    const { ctx, osciladores } = audioFalso()
    sons().aviso(ctx)
    expect(osciladores.map(o => o.freq)).toEqual([660])
  })

  it('a contagem 3-2-1 toca um bipe por número, cada um mais agudo que o anterior', () => {
    const { ctx, osciladores } = audioFalso()
    const s = sons()
    s.contagem(ctx, 3)
    s.contagem(ctx, 2)
    s.contagem(ctx, 1)
    expect(osciladores.map(o => o.freq)).toEqual([1000, 1250, 1600])
  })

  it('mudo: nada toca', () => {
    const { ctx, osciladores } = audioFalso()
    const s = sons(100, true)
    s.inicioRound(ctx); s.aviso(ctx); s.inicioDescanso(ctx); s.fim(ctx); s.contagem(ctx, 2)
    expect(osciladores).toHaveLength(0)
  })

  it('o volume é lido a cada aviso, não só uma vez', () => {
    const { ctx, osciladores } = audioFalso()
    let volume = 100
    const s = criarSonsDoTimer(() => ({ volume, mudo: false }))
    s.aviso(ctx)
    const alto = osciladores[0].maximo
    volume = 20
    s.aviso(ctx)
    expect(osciladores[1].maximo).toBeLessThan(alto)
    expect(osciladores[1].maximo).toBeGreaterThan(0)
  })
})
