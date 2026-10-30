import { describe, expect, it } from 'vitest'
import { montarFases } from '@/hooks/useCronometro'
import { agendaDeSons, type SonsDoCronometro } from '@/lib/agenda-sons'
import { TOLERANCIA_DO_AGENDADOR_S, criarAgendador } from '@/lib/agendador-de-sons'

// O agendador programa os sons do treino no relógio do áudio. O áudio de mentira abaixo guarda cada ligação, cada corte
// e o horário em que cada som foi pedido, para conferir o que o navegador receberia.

interface Porta { conectadoA: unknown[]; desligada: boolean; connect(alvo: unknown): void; disconnect(): void }
interface Pedido { nome: string; restante?: number; quando: number; destino: unknown; ctx: AudioContext }

function mundo() {
  const saida = { rotulo: 'saida-real' }
  const portas: Porta[] = []
  const ctx = {
    currentTime: 100,
    destination: saida,
    sampleRate: 48000,
    // Se o agendador chamar isto com o "this" errado, o teste falha como o navegador falharia.
    createGain(this: unknown) {
      if (this !== ctx) throw new Error('this errado')
      const p: Porta = {
        conectadoA: [], desligada: false,
        connect(alvo) { p.conectadoA.push(alvo) },
        disconnect() { p.desligada = true },
      }
      portas.push(p)
      return p
    },
  }
  const pedidos: Pedido[] = []
  const pedir = (nome: string) => (c: AudioContext | null, restante?: number) => {
    pedidos.push({ nome, restante, quando: c!.currentTime, destino: c!.destination, ctx: c! })
  }
  const sons: SonsDoCronometro = {
    inicioRound: pedir('inicioRound'), inicioDescanso: pedir('inicioDescanso'), aviso: pedir('aviso'), contagem: pedir('contagem'), fim: pedir('fim'),
  }
  return { ctx: ctx as unknown as AudioContext, bruto: ctx, saida, portas, pedidos, sons }
}

// preparo 0-10, round 1 10-70, descanso 70-100, round 2 100-160
const eventos = agendaDeSons(montarFases(2, 60, 30, 10), true)

describe('criarAgendador', () => {
  it('programa o treino inteiro de uma vez, cada som no horário do relógio do áudio (agora + quanto falta)', () => {
    const m = mundo()
    criarAgendador(m.ctx, eventos).sincronizar(0, m.sons)
    expect(m.pedidos).toHaveLength(eventos.length)
    eventos.forEach((e, i) => {
      expect(m.pedidos[i].nome).toBe(e.nome)
      expect(m.pedidos[i].quando).toBeCloseTo(100 + e.em, 6)
    })
    expect(m.pedidos.filter(p => p.nome === 'contagem').map(p => p.restante)).toEqual([3, 2, 1, 3, 2, 1, 3, 2, 1, 3, 2, 1])
  })

  it('começando no meio do treino, só programa o que ainda vem pela frente', () => {
    const m = mundo()
    criarAgendador(m.ctx, eventos).sincronizar(65, m.sons)
    expect(m.pedidos.map(p => p.nome)).toEqual(eventos.filter(e => e.em >= 65 - TOLERANCIA_DO_AGENDADOR_S).map(e => e.nome))
    // O primeiro que sobra é a contagem do fim do round 1, 2 s à frente.
    expect(m.pedidos[0]).toMatchObject({ nome: 'contagem', restante: 3 })
    expect(m.pedidos[0].quando).toBeCloseTo(102, 6)
  })

  it('som que acabou de passar (dentro da tolerância) toca já; mais velho que isso não toca', () => {
    const m = mundo()
    // 0,2 s depois do sino do round 1 (segundo 10): ainda toca, agora mesmo.
    criarAgendador(m.ctx, eventos).sincronizar(10.2, m.sons)
    expect(m.pedidos[0]).toMatchObject({ nome: 'inicioRound' })
    expect(m.pedidos[0].quando).toBeCloseTo(100, 6)
    // 3 s depois: já era (voltar de segundo plano não toca o sino atrasado).
    const m2 = mundo()
    criarAgendador(m2.ctx, eventos).sincronizar(13, m2.sons)
    expect(m2.pedidos[0]).toMatchObject({ nome: 'aviso' })
  })

  it('cada som passa por uma porta própria, ligada à saída do aparelho (é o que permite cortar só os que ainda não tocaram)', () => {
    const m = mundo()
    criarAgendador(m.ctx, eventos).sincronizar(0, m.sons)
    expect(m.portas).toHaveLength(eventos.length)
    expect(m.portas.every(p => p.conectadoA.length === 1 && p.conectadoA[0] === m.saida)).toBe(true)
    m.pedidos.forEach((p, i) => expect(p.destino).toBe(m.portas[i]))
  })

  it('o resto do áudio continua funcionando pelo intermediário (funções com o "this" certo)', () => {
    const m = mundo()
    let rate = 0
    const sons: SonsDoCronometro = { ...m.sons, inicioRound: c => { rate = c!.sampleRate; c!.createGain() } }
    criarAgendador(m.ctx, eventos).sincronizar(10, sons)
    expect(rate).toBe(48000)
  })

  it('pausar (cancelarPendentes): corta os sons que ainda não tocaram e deixa o que já está soando', () => {
    const m = mundo()
    const ag = criarAgendador(m.ctx, eventos)
    ag.sincronizar(0, m.sons)
    m.bruto.currentTime = 110.5 // passaram a contagem do preparo (107-109) e o sino do round 1 (110)
    ag.cancelarPendentes()
    const cortadas = m.pedidos.map((p, i) => ({ p, porta: m.portas[i] })).filter(x => x.porta.desligada).map(x => x.p.quando)
    expect(cortadas.length).toBeGreaterThan(0)
    expect(cortadas.every(q => q > 110.5)).toBe(true)
    // As quatro primeiras (contagem 3-2-1 e sino) já tinham começado: seguem soando.
    expect(m.portas.slice(0, 4).every(p => !p.desligada)).toBe(true)
  })

  it('programar de novo (retomar, voltar à tela) troca os pendentes e não repete o que já tocou', () => {
    const m = mundo()
    const ag = criarAgendador(m.ctx, eventos)
    ag.sincronizar(0, m.sons)
    m.bruto.currentTime = 110.3 // o sino do round 1 (segundo 10) acabou de tocar
    m.pedidos.length = 0
    ag.sincronizar(10.3, m.sons)
    expect(m.pedidos.filter(p => p.nome === 'inicioRound')).toHaveLength(1) // só o do round 2
    expect(m.pedidos[0].nome).not.toBe('inicioRound')
    expect(m.pedidos.map(p => p.nome)).toEqual(eventos.filter(e => e.em > 10.3).map(e => e.nome))
  })

  it('pular de fase: o sino da fase nova, ligeiramente atrasado, toca uma vez', () => {
    const m = mundo()
    const ag = criarAgendador(m.ctx, eventos)
    ag.sincronizar(20, m.sons)
    m.pedidos.length = 0
    // Pulou o resto do round 1 e caiu 0,01 s dentro do descanso (segundo 70).
    ag.sincronizar(70.01, m.sons)
    expect(m.pedidos[0]).toMatchObject({ nome: 'inicioDescanso' })
    expect(m.pedidos.filter(p => p.nome === 'inicioDescanso')).toHaveLength(1)
    // Os sons que estavam programados para a fase antiga (aviso, contagem) foram cortados.
    expect(m.portas.filter(p => p.desligada).length).toBeGreaterThan(0)
    // Programar de novo logo depois não repete o sino que já começou.
    ag.sincronizar(70.4, m.sons)
    expect(m.pedidos.filter(p => p.nome === 'inicioDescanso')).toHaveLength(1)
  })

  describe('ressincronizar (voltar à tela, áudio que voltou a rodar): só reprograma se o relógio do áudio se descolou', () => {
    it('áudio e treino andaram juntos: não mexe em nada (o que está programado segue valendo)', () => {
      const m = mundo()
      const ag = criarAgendador(m.ctx, eventos)
      ag.sincronizar(0, m.sons)
      const antes = m.pedidos.length
      m.bruto.currentTime = 105 // 5 s de áudio...
      ag.ressincronizar(5, m.sons) // ...e 5 s de treino
      expect(m.pedidos).toHaveLength(antes)
      expect(m.portas.some(p => p.desligada)).toBe(false)
    })

    it('o áudio parou (iPhone em segundo plano) enquanto o treino andou: corta e programa de novo a partir do relógio', () => {
      const m = mundo()
      const ag = criarAgendador(m.ctx, eventos)
      ag.sincronizar(0, m.sons)
      const antes = m.pedidos.length
      m.bruto.currentTime = 100.2 // o áudio andou 0,2 s...
      ag.ressincronizar(40, m.sons) // ...mas o treino já está nos 40 s
      const novos = m.pedidos.slice(antes)
      expect(novos.map(p => p.nome)).toEqual(eventos.filter(e => e.em >= 40 - TOLERANCIA_DO_AGENDADOR_S).map(e => e.nome))
      // O primeiro som que sobra é o aviso dos 10 s do round 1 (segundo 60 do treino): 20 s à frente do relógio do áudio.
      expect(novos[0]).toMatchObject({ nome: 'aviso' })
      expect(novos[0].quando).toBeCloseTo(120.2, 6)
      expect(m.portas.slice(0, antes).filter(p => p.desligada).length).toBeGreaterThan(0)
    })

    it('sem programação anterior, programa', () => {
      const m = mundo()
      criarAgendador(m.ctx, eventos).ressincronizar(0, m.sons)
      expect(m.pedidos).toHaveLength(eventos.length)
    })

    it('sincronizar (pausa, retomada, volume) sempre reprograma, mesmo sem descolamento', () => {
      const m = mundo()
      const ag = criarAgendador(m.ctx, eventos)
      ag.sincronizar(0, m.sons)
      ag.sincronizar(0, m.sons)
      expect(m.pedidos).toHaveLength(2 * eventos.length)
    })
  })

  it('encerrar na mão: corta o que falta e toca o fim do treino agora, uma vez só', () => {
    const m = mundo()
    const ag = criarAgendador(m.ctx, eventos)
    ag.sincronizar(30, m.sons)
    m.pedidos.length = 0
    ag.encerrar(m.sons)
    expect(m.pedidos).toHaveLength(1)
    expect(m.pedidos[0]).toMatchObject({ nome: 'fim' })
    expect(m.pedidos[0].quando).toBeCloseTo(100, 6)
    ag.encerrar(m.sons)
    expect(m.pedidos).toHaveLength(1)
  })

  it('o fim que já tocou sozinho não toca de novo ao encerrar', () => {
    const m = mundo()
    const ag = criarAgendador(m.ctx, eventos)
    ag.sincronizar(0, m.sons)
    m.bruto.currentTime = 100 + 160.5
    m.pedidos.length = 0
    ag.encerrar(m.sons)
    expect(m.pedidos).toHaveLength(0)
  })

  it('sem áudio (navegador sem suporte): não faz nada e não dá erro', () => {
    const ag = criarAgendador(null, eventos)
    const { sons } = mundo()
    expect(() => { ag.sincronizar(0, sons); ag.cancelarPendentes(); ag.encerrar(sons) }).not.toThrow()
  })

  it('um som que falha não derruba os outros', () => {
    const m = mundo()
    const sons: SonsDoCronometro = { ...m.sons, aviso: () => { throw new Error('boom') } }
    expect(() => criarAgendador(m.ctx, eventos).sincronizar(0, sons)).not.toThrow()
    expect(m.pedidos.some(p => p.nome === 'fim')).toBe(true)
  })

  it('áudio fechado (createGain falha): não dá erro', () => {
    const m = mundo()
    m.bruto.createGain = () => { throw new Error('closed') }
    expect(() => criarAgendador(m.ctx, eventos).sincronizar(0, m.sons)).not.toThrow()
  })
})
