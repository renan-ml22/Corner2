import { describe, expect, it } from 'vitest'
import { statusDeTreino, textoDoStatus } from '@/lib/cornerman/status-treino'

// Meio-dia em São Paulo (UTC-3) do dia indicado: longe da virada, para os testes de limite não dependerem do fuso.
const meioDia = (dia: string) => new Date(`${dia}T15:00:00.000Z`)
const AGORA = meioDia('2026-10-20')

describe('statusDeTreino: dias de calendário desde o último treino', () => {
  it.each([
    ['2026-10-20', 0, 'verde'],
    ['2026-10-19', 1, 'verde'],
    ['2026-10-18', 2, 'verde'],
    ['2026-10-17', 3, 'amarelo'],
    ['2026-10-14', 6, 'amarelo'],
    ['2026-10-13', 7, 'vermelho'],
    ['2026-09-20', 30, 'vermelho'],
  ])('treino em %s (%i dias) é %s', (dia, dias, cor) => {
    expect(statusDeTreino(meioDia(dia).toISOString(), AGORA)).toEqual({ cor, dias })
  })

  it('sem treino nenhum é cinza, sem número de dias', () => {
    expect(statusDeTreino(null, AGORA)).toEqual({ cor: 'cinza', dias: null })
  })

  it('data que não existe é cinza (nunca NaN)', () => {
    expect(statusDeTreino('ontem', AGORA)).toEqual({ cor: 'cinza', dias: null })
    expect(statusDeTreino('', AGORA)).toEqual({ cor: 'cinza', dias: null })
  })

  it('treino no futuro (relógio errado) conta como hoje', () => {
    expect(statusDeTreino(meioDia('2026-10-25').toISOString(), AGORA)).toEqual({ cor: 'verde', dias: 0 })
  })

  it('os dias são os de São Paulo, não os de Greenwich', () => {
    // 02:30 UTC de 10/10 ainda é noite de 9/10 em São Paulo. Em 12/10 às 02:00 UTC já é noite de 11/10: 2 dias, verde.
    expect(statusDeTreino('2026-10-10T02:30:00.000Z', new Date('2026-10-12T02:00:00.000Z'))).toEqual({ cor: 'verde', dias: 2 })
    // Em 13/10 às 02:00 UTC (noite de 12/10 em São Paulo) já são 3 dias: amarelo.
    expect(statusDeTreino('2026-10-10T02:30:00.000Z', new Date('2026-10-13T02:00:00.000Z'))).toEqual({ cor: 'amarelo', dias: 3 })
  })

  it('o mesmo dia de calendário é "hoje" mesmo com horas de diferença', () => {
    expect(statusDeTreino('2026-10-20T03:30:00.000Z', new Date('2026-10-21T02:30:00.000Z'))).toEqual({ cor: 'verde', dias: 0 })
  })
})

describe('textoDoStatus: a cor nunca é a única informação', () => {
  it.each([
    [{ cor: 'verde', dias: 0 }, 'Treinou hoje'],
    [{ cor: 'verde', dias: 1 }, 'Treinou ontem'],
    [{ cor: 'verde', dias: 2 }, 'Treinou há 2 dias'],
    [{ cor: 'amarelo', dias: 5 }, 'Treinou há 5 dias'],
    [{ cor: 'vermelho', dias: 12 }, 'Treinou há 12 dias'],
    [{ cor: 'cinza', dias: null }, 'Sem treinos registrados'],
  ] as const)('%j → %s', (status, texto) => {
    expect(textoDoStatus(status)).toBe(texto)
  })
})
