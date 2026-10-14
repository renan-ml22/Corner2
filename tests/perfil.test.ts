import { describe, expect, it } from 'vitest'
import { OBJETIVOS, metaInicial, recomendarPlano, type Objetivo } from '@/lib/perfil'
import { PLANOS } from '@/data/planos'
import type { Experiencia } from '@/lib/tipos'

const EXPERIENCIAS: Experiencia[] = ['nenhuma', 'ate1', '1a3', 'mais3']

describe('recomendarPlano', () => {
  it.each(['nenhuma', 'ate1'] as Experiencia[])('quem tem pouca experiência (%s) começa nos Fundamentos, qualquer que seja o objetivo', exp => {
    for (const obj of OBJETIVOS) expect(recomendarPlano(exp, obj).id).toBe('fundamentos')
  })

  it.each(['1a3', 'mais3'] as Experiencia[])('com experiência (%s), quem quer condicionamento vai para a Base Aeróbica', exp => {
    expect(recomendarPlano(exp, 'condicionamento').id).toBe('base-aerobica')
  })

  it('com mais de 3 anos e objetivo de competir, vai para a Pré-competição', () => {
    expect(recomendarPlano('mais3', 'competir').id).toBe('pre-competicao')
  })

  it('de 1 a 3 anos competindo ainda não chega à Pré-competição: vai para Técnica Avançada', () => {
    expect(recomendarPlano('1a3', 'competir').id).toBe('tecnica-avancada')
  })

  it('com experiência e foco em técnica, vai para Técnica Avançada', () => {
    expect(recomendarPlano('1a3', 'tecnica').id).toBe('tecnica-avancada')
    expect(recomendarPlano('mais3', 'tecnica').id).toBe('tecnica-avancada')
  })

  it('toda combinação devolve um plano que existe', () => {
    for (const exp of EXPERIENCIAS) {
      for (const obj of OBJETIVOS) expect(PLANOS).toContain(recomendarPlano(exp, obj))
    }
  })
})

describe('metaInicial', () => {
  it('é o menor entre os dias que o atleta pode treinar e os que o plano pede', () => {
    const plano = PLANOS[0]
    expect(metaInicial(2, plano)).toBe(Math.min(2, plano.diasPorSemana))
    expect(metaInicial(6, plano)).toBe(Math.min(6, plano.diasPorSemana))
  })

  it('nunca passa dos dias que o plano pede', () => {
    for (const p of PLANOS) expect(metaInicial(7, p)).toBe(p.diasPorSemana)
  })
})

describe('OBJETIVOS', () => {
  it('lista os três objetivos do perfil', () => {
    expect([...OBJETIVOS].sort()).toEqual((['competir', 'condicionamento', 'tecnica'] as Objetivo[]).sort())
  })
})
