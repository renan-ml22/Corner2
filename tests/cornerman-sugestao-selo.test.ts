import { describe, expect, it } from 'vitest'
import type { SugestaoParaOAluno } from '@/lib/cornerman/sugestao'
import { treinadorDoPlano } from '@/lib/cornerman/sugestao-selo'

// O selo "Sugerido pelo seu treinador": o plano ativo é o da última sugestão aceita e foi escolhido na semana da aceitação ou depois.

const aceita = (extra: Partial<SugestaoParaOAluno> = {}): SugestaoParaOAluno => ({
  id: 'x', planoId: 'fundamentos', planoNome: 'Fundamentos', mensagem: '', treinador: 'Marcos',
  criadaEm: '2026-10-26T12:00:00.000Z', respondidaEm: '2026-10-28T15:00:00.000Z', ...extra,
})

// 28/10/2026 é uma quarta-feira: a semana começa na segunda 26/10.
describe('treinadorDoPlano', () => {
  it('plano escolhido na semana da aceitação: mostra o nome do treinador', () => {
    expect(treinadorDoPlano({ planoId: 'fundamentos', inicio: '2026-10-26' }, aceita())).toBe('Marcos')
  })

  it('plano que começa em semana depois da aceitação também vale', () => {
    expect(treinadorDoPlano({ planoId: 'fundamentos', inicio: '2026-11-02' }, aceita())).toBe('Marcos')
  })

  it('plano escolhido ANTES da semana da aceitação não é o sugerido', () => {
    expect(treinadorDoPlano({ planoId: 'fundamentos', inicio: '2026-10-19' }, aceita())).toBeNull()
  })

  it('outro plano ativo: sem selo', () => {
    expect(treinadorDoPlano({ planoId: 'base-aerobica', inicio: '2026-10-26' }, aceita())).toBeNull()
  })

  it('sem plano ativo ou sem sugestão aceita: sem selo', () => {
    expect(treinadorDoPlano(null, aceita())).toBeNull()
    expect(treinadorDoPlano({ planoId: 'fundamentos', inicio: '2026-10-26' }, null)).toBeNull()
  })

  it('sugestão aceita sem data de resposta (dado incompleto): sem selo, não quebra', () => {
    expect(treinadorDoPlano({ planoId: 'fundamentos', inicio: '2026-10-26' }, aceita({ respondidaEm: null }))).toBeNull()
    expect(treinadorDoPlano({ planoId: 'fundamentos', inicio: '2026-10-26' }, aceita({ respondidaEm: 'ontem' }))).toBeNull()
  })

  it('aceitou no domingo: a semana da aceitação começou na segunda anterior', () => {
    // 01/11/2026 é domingo; a semana dele começa em 26/10.
    const noDomingo = aceita({ respondidaEm: '2026-11-01T15:00:00.000Z' })
    expect(treinadorDoPlano({ planoId: 'fundamentos', inicio: '2026-10-26' }, noDomingo)).toBe('Marcos')
    expect(treinadorDoPlano({ planoId: 'fundamentos', inicio: '2026-10-19' }, noDomingo)).toBeNull()
  })
})
