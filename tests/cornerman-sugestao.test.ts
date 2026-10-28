import { describe, expect, it } from 'vitest'
import { RECURSO_DO_PLANO_DE_TREINO } from '@/lib/assinatura/catalogo'
import { getPlano } from '@/data/planos'
import {
  LIMITE_DA_MENSAGEM, ehPlanoSugerivel, nomeDoPlanoSugerido, planosSugeriveis, rotuloDoStatusDaSugestao, validarNovaSugestao,
} from '@/lib/cornerman/sugestao'

describe('planos que o treinador pode sugerir', () => {
  it('são exatamente os planos que têm dono no catálogo de assinatura', () => {
    expect(planosSugeriveis().map(p => p.id).sort()).toEqual(Object.keys(RECURSO_DO_PLANO_DE_TREINO).sort())
  })

  it('cada um existe nos dados do app e vem com o nome para a tela', () => {
    for (const p of planosSugeriveis()) {
      expect(getPlano(p.id)?.nome).toBe(p.nome)
      expect(p.nome.length).toBeGreaterThan(0)
    }
  })

  it('reconhece só os ids da lista', () => {
    expect(ehPlanoSugerivel('fundamentos')).toBe(true)
    expect(ehPlanoSugerivel('atleta-ali')).toBe(true)
    expect(ehPlanoSugerivel('inexistente')).toBe(false)
    expect(ehPlanoSugerivel('')).toBe(false)
    expect(ehPlanoSugerivel(null)).toBe(false)
    expect(ehPlanoSugerivel(7)).toBe(false)
    // Chaves herdadas do objeto não contam como plano.
    expect(ehPlanoSugerivel('constructor')).toBe(false)
    expect(ehPlanoSugerivel('__proto__')).toBe(false)
  })

  it('o nome do plano sugerido: o da lista, ou o próprio id se o plano sumiu dos dados', () => {
    expect(nomeDoPlanoSugerido('fundamentos')).toBe(getPlano('fundamentos')?.nome)
    expect(nomeDoPlanoSugerido('plano-que-saiu')).toBe('Plano removido')
  })
})

describe('validarNovaSugestao', () => {
  it('aceita um plano da lista, com ou sem mensagem', () => {
    expect(validarNovaSugestao({ planoId: 'fundamentos', mensagem: 'Foque na guarda.' })).toEqual({ ok: true, valor: { planoId: 'fundamentos', mensagem: 'Foque na guarda.' } })
    expect(validarNovaSugestao({ planoId: 'fundamentos' })).toEqual({ ok: true, valor: { planoId: 'fundamentos', mensagem: '' } })
  })

  it('apara os espaços da mensagem', () => {
    expect(validarNovaSugestao({ planoId: 'fundamentos', mensagem: '  oi  ' })).toEqual({ ok: true, valor: { planoId: 'fundamentos', mensagem: 'oi' } })
  })

  it('aceita a mensagem no tamanho máximo e recusa 1 caractere a mais', () => {
    expect(validarNovaSugestao({ planoId: 'fundamentos', mensagem: 'a'.repeat(LIMITE_DA_MENSAGEM) }).ok).toBe(true)
    const r = validarNovaSugestao({ planoId: 'fundamentos', mensagem: 'a'.repeat(LIMITE_DA_MENSAGEM + 1) })
    expect(r.ok).toBe(false)
  })

  it('recusa plano fora da lista, ausente ou que não é texto', () => {
    for (const planoId of ['nao-existe', '', undefined, null, 3, {}, ['fundamentos']]) {
      expect(validarNovaSugestao({ planoId }).ok).toBe(false)
    }
  })

  it('recusa mensagem que não é texto', () => {
    for (const mensagem of [3, null, {}, ['a'], true]) {
      expect(validarNovaSugestao({ planoId: 'fundamentos', mensagem }).ok).toBe(false)
    }
  })

  it('recusa corpo que não é objeto e campos que não são da sugestão', () => {
    for (const corpo of [null, undefined, 'fundamentos', 3, [], ['fundamentos']]) {
      expect(validarNovaSugestao(corpo).ok).toBe(false)
    }
    // Nada de status, coach_id ou aluno_id vindo do navegador.
    expect(validarNovaSugestao({ planoId: 'fundamentos', status: 'aceita' }).ok).toBe(false)
    expect(validarNovaSugestao({ planoId: 'fundamentos', coach_id: 'outro' }).ok).toBe(false)
  })

  it('recusa caracteres de controle e de direção de texto na mensagem, mas aceita quebra de linha', () => {
    expect(validarNovaSugestao({ planoId: 'fundamentos', mensagem: 'linha 1\nlinha 2' }).ok).toBe(true)
    expect(validarNovaSugestao({ planoId: 'fundamentos', mensagem: 'a\u0000b' }).ok).toBe(false)
    expect(validarNovaSugestao({ planoId: 'fundamentos', mensagem: 'a‮b' }).ok).toBe(false)
  })

  it('o erro é um texto em português para mostrar à pessoa', () => {
    const r = validarNovaSugestao({ planoId: 'nao-existe' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/plano/i)
  })
})

describe('rotuloDoStatusDaSugestao', () => {
  it('cada status tem um rótulo em português', () => {
    expect(rotuloDoStatusDaSugestao('pendente')).toBe('Aguardando resposta')
    expect(rotuloDoStatusDaSugestao('aceita')).toBe('Aceita')
    expect(rotuloDoStatusDaSugestao('recusada')).toBe('Recusada')
    expect(rotuloDoStatusDaSugestao('substituida')).toBe('Substituída por outra')
    expect(rotuloDoStatusDaSugestao('cancelada')).toBe('Cancelada: o vínculo terminou')
    expect(rotuloDoStatusDaSugestao('registrada')).toBe('Registrada na ficha')
  })
})
