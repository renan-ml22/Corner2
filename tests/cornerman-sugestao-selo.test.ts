import { describe, expect, it } from 'vitest'
import type { SugestaoParaOAluno } from '@/lib/cornerman/sugestao'
import { treinadorDoPlano } from '@/lib/cornerman/sugestao-selo'

// O selo "Sugerido pelo seu treinador": o plano ativo é o da última sugestão aceita neste vínculo.

const aceita = (extra: Partial<SugestaoParaOAluno> = {}): SugestaoParaOAluno => ({
  id: 'x', planoId: 'fundamentos', planoNome: 'Fundamentos', mensagem: '', treinador: 'Marcos',
  criadaEm: '2026-10-26T12:00:00.000Z', respondidaEm: '2026-10-28T15:00:00.000Z', ...extra,
})

describe('treinadorDoPlano', () => {
  it('o plano ativo é o da sugestão aceita: mostra o nome do treinador', () => {
    expect(treinadorDoPlano({ planoId: 'fundamentos', inicio: '2026-10-26' }, aceita())).toBe('Marcos')
  })

  it('aceitar o plano que a pessoa JÁ usava (semana de início antiga) também mostra o selo', () => {
    expect(treinadorDoPlano({ planoId: 'fundamentos', inicio: '2026-10-05' }, aceita())).toBe('Marcos')
  })

  it('outro plano ativo: sem selo', () => {
    expect(treinadorDoPlano({ planoId: 'base-aerobica', inicio: '2026-10-26' }, aceita())).toBeNull()
  })

  it('sem plano ativo ou sem sugestão aceita: sem selo', () => {
    expect(treinadorDoPlano(null, aceita())).toBeNull()
    expect(treinadorDoPlano({ planoId: 'fundamentos', inicio: '2026-10-26' }, null)).toBeNull()
  })

  it('sugestão que ainda não foi respondida (sem data de resposta) não dá selo', () => {
    expect(treinadorDoPlano({ planoId: 'fundamentos', inicio: '2026-10-26' }, aceita({ respondidaEm: null }))).toBeNull()
  })
})
