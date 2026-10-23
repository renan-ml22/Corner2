import { describe, expect, it } from 'vitest'
import {
  NIVEIS, OPCOES_DE_DIAS, experienciaDoNivel, metaDoOnboarding, nivelDaExperiencia, planoDoOnboarding, validarCadastro,
  type Nivel,
} from '@/lib/onboarding'
import { PLANOS } from '@/data/planos'
import type { Experiencia } from '@/lib/tipos'

describe('níveis do onboarding', () => {
  it('são três, na ordem do iniciante ao avançado, cada um com título, descrição e ícone do Phosphor', () => {
    expect(NIVEIS.map(n => n.id)).toEqual(['iniciante', 'intermediario', 'avancado'])
    for (const n of NIVEIS) {
      expect(n.titulo.length).toBeGreaterThan(3)
      expect(n.descricao.length).toBeGreaterThan(10)
      expect(n.icone).toMatch(/^ph-[a-z-]+$/)
    }
    expect(new Set(NIVEIS.map(n => n.icone)).size).toBe(3)
  })

  it('cada nível corresponde a uma experiência que o app já conhece', () => {
    expect(experienciaDoNivel('iniciante')).toBe('ate1')
    expect(experienciaDoNivel('intermediario')).toBe('1a3')
    expect(experienciaDoNivel('avancado')).toBe('mais3')
  })

  it('da experiência de volta ao nível: "nunca treinei" e "menos de 1 ano" são iniciante', () => {
    const esperado: [Experiencia, Nivel][] = [['nenhuma', 'iniciante'], ['ate1', 'iniciante'], ['1a3', 'intermediario'], ['mais3', 'avancado']]
    for (const [exp, nivel] of esperado) expect(nivelDaExperiencia(exp)).toBe(nivel)
    expect(nivelDaExperiencia(null)).toBeNull()
    expect(nivelDaExperiencia(undefined)).toBeNull()
  })

  it('ida e volta: o nível escolhido é o nível lido depois', () => {
    for (const n of NIVEIS) expect(nivelDaExperiencia(experienciaDoNivel(n.id))).toBe(n.id)
  })
})

describe('dias por semana', () => {
  it('são 2, 3, 4 ou 5', () => {
    expect([...OPCOES_DE_DIAS]).toEqual([2, 3, 4, 5])
  })
})

describe('plano recomendado', () => {
  const tabela: [Nivel, number, string][] = [
    ['iniciante', 2, 'fundamentos'], ['iniciante', 3, 'fundamentos'], ['iniciante', 4, 'fundamentos'], ['iniciante', 5, 'fundamentos'],
    ['intermediario', 2, 'base-aerobica'], ['intermediario', 3, 'base-aerobica'], ['intermediario', 4, 'base-aerobica'], ['intermediario', 5, 'base-aerobica'],
    ['avancado', 2, 'tecnica-avancada'], ['avancado', 3, 'tecnica-avancada'], ['avancado', 4, 'tecnica-avancada'], ['avancado', 5, 'pre-competicao'],
  ]

  it.each(tabela)('%s treinando %i dias: %s', (nivel, dias, id) => {
    expect(planoDoOnboarding(nivel, dias).id).toBe(id)
  })

  it('sempre devolve um plano que existe', () => {
    for (const n of NIVEIS) for (const d of OPCOES_DE_DIAS) expect(PLANOS).toContain(planoDoOnboarding(n.id, d))
  })

  it('a meta semanal é o que a pessoa pode treinar, limitada ao que o plano pede', () => {
    expect(metaDoOnboarding('iniciante', 5)).toBe(3) // Fundamentos pede 3
    expect(metaDoOnboarding('iniciante', 2)).toBe(2)
    expect(metaDoOnboarding('intermediario', 3)).toBe(3)
    expect(metaDoOnboarding('avancado', 5)).toBe(5)
    expect(metaDoOnboarding('avancado', 4)).toBe(4)
  })
})

describe('validarCadastro', () => {
  const ok = { nome: 'Renan Lopes', email: 'renan@exemplo.com', senha: 'senha-forte-123' }

  it('aceita dados válidos e devolve os valores limpos', () => {
    expect(validarCadastro(ok)).toEqual({ ok: true, valores: ok })
  })

  it('limpa os espaços do nome e coloca o e-mail em minúsculas, sem tocar na senha', () => {
    const r = validarCadastro({ nome: '  Renan   Lopes  ', email: '  Renan@Exemplo.COM ', senha: '  senha com espaço  ' })
    expect(r).toEqual({ ok: true, valores: { nome: 'Renan Lopes', email: 'renan@exemplo.com', senha: '  senha com espaço  ' } })
  })

  it.each([
    ['vazio', ''],
    ['só espaços', '   '],
    ['uma letra só', 'R'],
    ['só números', '12345'],
    ['só símbolos', '!!!!'],
    ['comprido demais', 'a'.repeat(81)],
  ])('nome %s: erro no nome', (_nome, nome) => {
    const r = validarCadastro({ ...ok, nome })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.erros)).toEqual(['nome'])
  })

  it('aceita nomes com acento, apóstrofo, hífen e outros alfabetos', () => {
    for (const nome of ['José d’Ávila', 'Ana-Júlia Souza', 'Zé', 'Åsa Öberg']) expect(validarCadastro({ ...ok, nome }).ok, nome).toBe(true)
  })

  it.each([
    ['vazio', ''],
    ['sem arroba', 'renan.exemplo.com'],
    ['sem domínio', 'renan@'],
    ['sem ponto no domínio', 'renan@exemplo'],
    ['com espaço no meio', 'renan @exemplo.com'],
    ['dois arrobas', 'a@b@c.com'],
    ['comprido demais', `${'a'.repeat(250)}@exemplo.com`],
  ])('e-mail %s: erro no e-mail', (_nome, email) => {
    const r = validarCadastro({ ...ok, email })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.erros)).toEqual(['email'])
  })

  it.each([
    ['vazia', ''],
    ['curta (7)', 'abcdefg'],
    ['só espaços', '        '],
    ['igual ao e-mail', 'renan@exemplo.com'],
  ])('senha %s: erro na senha', (_nome, senha) => {
    const r = validarCadastro({ ...ok, senha })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.erros)).toEqual(['senha'])
  })

  it('senha com 8 caracteres passa; com 72 bytes passa; com 73 não (o Supabase corta em 72 em silêncio)', () => {
    expect(validarCadastro({ ...ok, senha: 'abcdefgh' }).ok).toBe(true)
    expect(validarCadastro({ ...ok, senha: 'a'.repeat(72) }).ok).toBe(true)
    expect(validarCadastro({ ...ok, senha: 'a'.repeat(73) }).ok).toBe(false)
  })

  it('o limite da senha conta bytes: 40 emojis (160 bytes) passam do limite de 72', () => {
    expect(validarCadastro({ ...ok, senha: '🥊'.repeat(40) }).ok).toBe(false)
    expect(validarCadastro({ ...ok, senha: '🥊'.repeat(18) }).ok).toBe(true) // 72 bytes
  })

  it('vários campos errados: um erro para cada, todos em português e sem repetir a senha digitada', () => {
    const r = validarCadastro({ nome: '', email: 'x', senha: 'curta12' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(Object.keys(r.erros).sort()).toEqual(['email', 'nome', 'senha'])
      for (const msg of Object.values(r.erros)) expect(msg).toMatch(/[a-zçãé]/)
      expect(JSON.stringify(r.erros)).not.toContain('curta12')
    }
  })

  it('valores que não são texto (formulário adulterado) são recusados sem lançar erro', () => {
    expect(validarCadastro({ nome: null, email: undefined, senha: 5 } as never).ok).toBe(false)
  })
})
