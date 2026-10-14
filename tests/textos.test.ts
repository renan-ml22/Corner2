import { describe, expect, it } from 'vitest'
import { TEXTOS } from '@/lib/textos'

/** Todos os textos do objeto, com o caminho de cada um (funções são chamadas com um nome de exemplo). */
function folhas(obj: unknown, caminho = ''): [string, string][] {
  if (typeof obj === 'string') return [[caminho, obj]]
  if (typeof obj === 'function') return [[caminho, (obj as (n: string) => string)('Fundamentos')]]
  if (obj && typeof obj === 'object') return Object.entries(obj).flatMap(([k, v]) => folhas(v, caminho ? `${caminho}.${k}` : k))
  return []
}

describe('TEXTOS (avisos, confirmações e mensagens de validação)', () => {
  const todos = folhas(TEXTOS)

  it('há textos nos três grupos', () => {
    for (const grupo of ['aviso', 'confirmar', 'erro'] as const) expect(Object.keys(TEXTOS[grupo]).length).toBeGreaterThan(0)
  })

  it.each(todos)('%s não é vazio e não tem espaços sobrando nas pontas', (_caminho, texto) => {
    expect(texto.length).toBeGreaterThan(3)
    expect(texto).toBe(texto.trim())
  })

  it('avisos de ação terminam sem ponto final; perguntas de confirmação terminam em ponto de interrogação ou ponto', () => {
    for (const [caminho, texto] of todos.filter(([c]) => c.startsWith('confirmar.'))) {
      expect(/[?.]$/.test(texto), caminho).toBe(true)
    }
  })

  it('os textos com nome de plano usam o nome recebido', () => {
    expect(TEXTOS.aviso.planoAtivado('Base Aeróbica')).toBe('Plano Base Aeróbica ativado')
    expect(TEXTOS.aviso.perfilSalvo('Fundamentos')).toContain('Fundamentos')
    expect(TEXTOS.confirmar.encerrarPlano('Fundamentos')).toContain('Fundamentos')
    expect(TEXTOS.confirmar.trocarPlano('Pré-competição')).toContain('Pré-competição')
  })

  it('não há dois avisos com o mesmo texto (cada ação diz o que aconteceu)', () => {
    const avisos = folhas(TEXTOS.aviso).map(([, t]) => t)
    expect(new Set(avisos).size).toBe(avisos.length)
  })
})
