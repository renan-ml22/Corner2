import { describe, expect, it } from 'vitest'
import type { TreinoDoAluno } from '@/lib/cornerman/aluno-dados'
import { filtrarTreinos, resumoDosTreinos, treinosPorSemana } from '@/lib/cornerman/treinos-do-aluno'

// Meio-dia local: a semana (segunda a domingo) é a do fuso do aparelho, então os testes usam datas locais.
const t = (dia: string, extra: Partial<TreinoDoAluno> = {}): TreinoDoAluno => ({
  data: new Date(`${dia}T12:00:00`).toISOString(), tipo: 'tec', rounds: 5, minPorRound: 3, rpe: 6, duracaoSegundos: 900, ...extra,
})
const HOJE = new Date('2026-10-28T12:00:00') // quarta-feira

describe('filtrarTreinos', () => {
  const lista = [t('2026-10-27'), t('2026-10-26', { tipo: 'spa' }), t('2026-10-25', { tipo: 'con' })]

  it('"todos" devolve tudo; um tipo devolve só ele', () => {
    expect(filtrarTreinos(lista, 'todos')).toHaveLength(3)
    expect(filtrarTreinos(lista, 'spa').map(x => x.tipo)).toEqual(['spa'])
  })
})

describe('resumoDosTreinos', () => {
  it('conta treinos, soma os minutos (rounds × minutos por round) e tira a média do esforço com uma casa', () => {
    const r = resumoDosTreinos([t('2026-10-27', { rounds: 5, minPorRound: 3, rpe: 6 }), t('2026-10-26', { rounds: 4, minPorRound: 2.5, rpe: 7 })], 'todos')
    expect(r).toEqual({ total: 2, minutos: 25, rpeMedio: 6.5 })
  })

  it('o filtro vale também para o resumo', () => {
    const lista = [t('2026-10-27', { tipo: 'spa', rpe: 9 }), t('2026-10-26', { rpe: 3 })]
    expect(resumoDosTreinos(lista, 'spa')).toEqual({ total: 1, minutos: 15, rpeMedio: 9 })
  })

  it('sem treino: zeros e esforço nulo (nunca NaN)', () => {
    expect(resumoDosTreinos([], 'todos')).toEqual({ total: 0, minutos: 0, rpeMedio: null })
  })

  it('arredonda os minutos para inteiro', () => {
    expect(resumoDosTreinos([t('2026-10-27', { rounds: 3, minPorRound: 2.4 })], 'todos').minutos).toBe(7)
  })
})

describe('treinosPorSemana: 5 semanas de segunda a domingo, terminando na semana de hoje', () => {
  it('conta cada treino na sua semana; semana sem treino é 0', () => {
    const lista = [t('2026-10-27'), t('2026-10-26'), t('2026-10-18'), t('2026-10-02')]
    const semanas = treinosPorSemana(lista, HOJE, 'todos')
    expect(semanas.map(s => s.inicio)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'])
    expect(semanas.map(s => s.total)).toEqual([1, 0, 1, 0, 2])
  })

  it('domingo e segunda ficam em semanas diferentes', () => {
    const semanas = treinosPorSemana([t('2026-10-25'), t('2026-10-26')], HOJE, 'todos')
    expect(semanas.map(s => s.total)).toEqual([0, 0, 0, 1, 1])
  })

  it('treino fora das 5 semanas não entra', () => {
    expect(treinosPorSemana([t('2026-09-20')], HOJE, 'todos').every(s => s.total === 0)).toBe(true)
  })

  it('respeita o filtro e dá rótulo curto em português', () => {
    const semanas = treinosPorSemana([t('2026-10-27', { tipo: 'spa' }), t('2026-10-27')], HOJE, 'spa')
    expect(semanas[4].total).toBe(1)
    expect(semanas[4].rotulo).toMatch(/^26 (de )?out/)
  })

  it('sem treino algum: cinco semanas zeradas', () => {
    expect(treinosPorSemana([], HOJE, 'todos').map(s => s.total)).toEqual([0, 0, 0, 0, 0])
  })
})
