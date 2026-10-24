import { describe, expect, it } from 'vitest'
import { PREPARO_SEG, encerrarExecucao, medirRelogio, montarFases, type Execucao } from '@/hooks/useCronometro'

// A lista de fases do cronômetro: preparo, rounds e descansos, cada uma com o segundo em que começa.

describe('montarFases', () => {
  it('padrão (tela de treino do plano): 10 s de preparo, e descanso só ENTRE os rounds', () => {
    const fases = montarFases(3, 180, 60)
    expect(fases.map(f => [f.tipo, f.round, f.duracao, f.inicio])).toEqual([
      ['preparo', 1, PREPARO_SEG, 0],
      ['round', 1, 180, 10],
      ['descanso', 1, 60, 190],
      ['round', 2, 180, 250],
      ['descanso', 2, 60, 430],
      ['round', 3, 180, 490],
    ])
  })

  it('preparo de 0 s (desligado no Timer): começa direto no round 1, sem fase de preparo', () => {
    const fases = montarFases(2, 120, 30, 0)
    expect(fases.map(f => [f.tipo, f.round, f.duracao, f.inicio])).toEqual([
      ['round', 1, 120, 0],
      ['descanso', 1, 30, 120],
      ['round', 2, 120, 150],
    ])
  })

  it('preparo de outra duração', () => {
    expect(montarFases(1, 60, 30, 5)[0]).toEqual({ tipo: 'preparo', round: 1, duracao: 5, inicio: 0 })
  })

  it('um round só: sem descanso', () => {
    expect(montarFases(1, 60, 60, 0).map(f => f.tipo)).toEqual(['round'])
  })

  it('o tempo total é a soma das fases, sem buracos nem sobreposição', () => {
    const fases = montarFases(20, 300, 180)
    for (let i = 1; i < fases.length; i++) expect(fases[i].inicio).toBe(fases[i - 1].inicio + fases[i - 1].duracao)
    const ultima = fases[fases.length - 1]
    expect(ultima.inicio + ultima.duracao).toBe(PREPARO_SEG + 20 * 300 + 19 * 180)
  })
})

describe('medirRelogio: quanto tempo passou, pelo relógio', () => {
  const exec = (parcial: Partial<Execucao> = {}): Execucao => ({ inicio: 1000, pausadoEm: null, pausadoTotal: 0, adiantado: 0, fimEm: null, ...parcial })

  it('antes de iniciar, nada passou', () => {
    expect(medirRelogio(null, 99999, 600)).toEqual({ decorridoReal: 0, decorrido: 0 })
  })

  it('andando: o tempo é "agora" menos o início, em segundos', () => {
    expect(medirRelogio(exec(), 46_000, 600)).toEqual({ decorridoReal: 45, decorrido: 45 })
  })

  it('pausado: o tempo para no momento da pausa, por mais que o relógio ande', () => {
    expect(medirRelogio(exec({ pausadoEm: 31_000 }), 900_000, 600)).toEqual({ decorridoReal: 30, decorrido: 30 })
  })

  it('pausas anteriores não contam', () => {
    expect(medirRelogio(exec({ pausadoTotal: 20_000 }), 61_000, 600)).toEqual({ decorridoReal: 40, decorrido: 40 })
  })

  it('segundos pulados contam no andamento do treino, mas não no tempo real treinado', () => {
    expect(medirRelogio(exec({ adiantado: 30 }), 11_000, 600)).toEqual({ decorridoReal: 10, decorrido: 40 })
  })

  it('encerrado: o tempo para no fim', () => {
    expect(medirRelogio(exec({ fimEm: 21_000 }), 900_000, 600)).toEqual({ decorridoReal: 20, decorrido: 20 })
  })

  it('nunca passa do total: voltar de segundo plano minutos depois do fim não infla o tempo do treino', () => {
    const r = medirRelogio(exec(), 1000 + 9 * 60_000, 150)
    expect(r.decorrido).toBe(150)
    expect(r.decorridoReal).toBe(150)
  })

  it('com segundos pulados, o limite vale para a soma (o tempo real treinado é o que sobra)', () => {
    const r = medirRelogio(exec({ adiantado: 50 }), 1000 + 9 * 60_000, 150)
    expect(r.decorrido).toBe(150)
    expect(r.decorridoReal).toBe(100)
  })

  it('relógio que anda para trás (ajuste de hora do aparelho) não gera tempo negativo', () => {
    expect(medirRelogio(exec(), 500, 600)).toEqual({ decorridoReal: 0, decorrido: 0 })
  })
})

describe('encerrarExecucao', () => {
  const base: Execucao = { inicio: 1000, pausadoEm: null, pausadoTotal: 0, adiantado: 0, fimEm: null }

  it('andando: encerra agora', () => {
    expect(encerrarExecucao(base, 5000).fimEm).toBe(5000)
  })

  it('pausado: encerra no momento da pausa (o tempo parado não vira treino)', () => {
    const e = encerrarExecucao({ ...base, pausadoEm: 31_000 }, 151_000)
    expect(e.fimEm).toBe(31_000)
    expect(medirRelogio(e, 900_000, 600).decorridoReal).toBe(30)
  })

  it('já encerrado: não muda', () => {
    const feito = { ...base, fimEm: 2000 }
    expect(encerrarExecucao(feito, 9000)).toBe(feito)
  })
})
