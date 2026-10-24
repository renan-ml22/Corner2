import { describe, expect, it } from 'vitest'
import { CATEGORIAS, EXERCICIOS, exercicioPorId, exerciciosDaCategoria, type CategoriaDeExercicio } from '@/data/exercicios'

// A biblioteca de exercícios do plano gratuito: 20 exercícios em 5 categorias, cada um com descrição, 3 dicas e 2 erros comuns.

const POR_CATEGORIA: Record<CategoriaDeExercicio, string[]> = {
  footwork: ['Passo lateral (shuffle step)', 'Passo em L (L-step)', 'Pivot', 'In-and-out'],
  'esquivas-cabeca': ['Slip externo', 'Slip interno', 'Duck', 'Bob and weave'],
  'esquivas-tronco': ['Shoulder roll', 'Pull back', 'Lean back'],
  golpes: ['Jab', 'Direto (Cross)', 'Gancho (Hook)', 'Uppercut', 'Body shot'],
  combinacoes: ['1-2 (Jab + Direto)', '1-2-3 (Jab + Direto + Gancho)', '1-1-2 (Jab duplo + Direto)', '1-2-3-2 (Jab + Direto + Gancho + Direto)'],
}

describe('categorias', () => {
  it('são cinco, com nome e ícone do Phosphor, na ordem combinada', () => {
    expect(CATEGORIAS.map(c => c.id)).toEqual(['footwork', 'esquivas-cabeca', 'esquivas-tronco', 'golpes', 'combinacoes'])
    for (const c of CATEGORIAS) {
      expect(c.nome.trim().length).toBeGreaterThan(3)
      expect(c.icone).toMatch(/^ph-[a-z-]+$/)
    }
    expect(CATEGORIAS.map(c => c.nome)).toEqual(['Footwork', 'Esquivas de cabeça', 'Esquivas de tronco', 'Golpes', 'Combinações'])
  })
})

describe('exercícios: o conjunto', () => {
  it('são 20, os combinados, cada um na sua categoria', () => {
    expect(EXERCICIOS).toHaveLength(20)
    for (const categoria of Object.keys(POR_CATEGORIA) as CategoriaDeExercicio[]) {
      expect(exerciciosDaCategoria(categoria).map(e => e.nome), categoria).toEqual(POR_CATEGORIA[categoria])
    }
  })

  it('ids únicos, em minúsculas e sem espaços (vão para endereço e para chave de lista)', () => {
    const ids = EXERCICIOS.map(e => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('há exercícios nos três níveis, e todo nível é um dos três', () => {
    expect(new Set(EXERCICIOS.map(e => e.nivel))).toEqual(new Set(['iniciante', 'intermediario', 'avancado']))
  })

  it('os fundamentos (jab, direto e 1-2) são de nível iniciante', () => {
    for (const nome of ['Jab', 'Direto (Cross)', '1-2 (Jab + Direto)', 'Passo lateral (shuffle step)']) {
      expect(EXERCICIOS.find(e => e.nome === nome)?.nivel, nome).toBe('iniciante')
    }
  })
})

describe('exercícios: cada um', () => {
  it.each(EXERCICIOS.map(e => [e.nome, e] as const))('%s tem descrição de 2 ou 3 frases, 3 dicas e 2 erros comuns', (_nome, e) => {
    const frases = e.descricao.split(/(?<=[.!?])\s+/).filter(Boolean)
    expect(frases.length, 'frases na descrição').toBeGreaterThanOrEqual(2)
    expect(frases.length, 'frases na descrição').toBeLessThanOrEqual(3)
    expect(e.descricao.length).toBeGreaterThan(100)
    expect(e.descricao.length).toBeLessThan(450)
    expect(e.dicas).toHaveLength(3)
    expect(e.errosComuns).toHaveLength(2)
  })

  it.each(EXERCICIOS.map(e => [e.nome, e] as const))('%s: dicas e erros são frases de verdade, sem repetição e sem sobras de espaço', (_nome, e) => {
    for (const texto of [e.descricao, ...e.dicas, ...e.errosComuns]) {
      expect(texto, texto).toBe(texto.trim())
      expect(texto.length, texto).toBeGreaterThan(20)
      expect(texto, texto).not.toMatch(/\s{2,}/)
      expect(texto[0], texto).toBe(texto[0].toUpperCase())
    }
    expect(new Set(e.dicas).size).toBe(e.dicas.length)
    expect(new Set(e.errosComuns).size).toBe(e.errosComuns.length)
  })

  it('nenhum texto promete o que não pode: sem "garantido", "infalível" ou "sempre funciona"', () => {
    const tudo = EXERCICIOS.flatMap(e => [e.descricao, ...e.dicas, ...e.errosComuns]).join(' ')
    expect(tudo).not.toMatch(/garantid|infal[ií]vel|sempre funciona/i)
  })
})

describe('exercicioPorId', () => {
  it('acha pelo id e devolve a mesma referência', () => {
    for (const e of EXERCICIOS) expect(exercicioPorId(e.id)).toBe(e)
  })

  it('id desconhecido ou vazio: null', () => {
    expect(exercicioPorId('nao-existe')).toBeNull()
    expect(exercicioPorId('')).toBeNull()
    expect(exercicioPorId(undefined)).toBeNull()
  })
})

describe('exercícios: segurança de quem está começando', () => {
  const texto = (id: string) => {
    const e = exercicioPorId(id)!
    return [e.descricao, ...e.dicas, ...e.errosComuns].join(' ')
  }

  it.each(['pivot', 'direto', 'gancho'])('%s gira sobre o pé fixo: avisa que o joelho acompanha o pé (para não torcer o joelho)', id => {
    expect(texto(id)).toMatch(/joelho acompanha/i)
  })

  it.each(['jab', 'direto'])('%s manda esticar o braço sem travar o cotovelo', id => {
    expect(texto(id)).toMatch(/sem travar o cotovelo/i)
  })

  it.each(['jab', 'direto', 'combo-1-2'])('%s lembra de soltar o ar a cada golpe (nunca prender a respiração)', id => {
    expect(texto(id)).toMatch(/soltando o ar/i)
  })

  it('o shoulder roll defende de golpes retos de trás (o direto), e a mão da frente baixa não é listada como erro', () => {
    const e = exercicioPorId('shoulder-roll')!
    expect(e.descricao).not.toMatch(/contra o jab/i)
    expect(e.descricao).toMatch(/direto/i)
    expect(e.errosComuns.join(' ')).not.toMatch(/baixar a mão da frente/i)
  })
})
