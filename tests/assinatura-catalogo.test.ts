import { describe, expect, it } from 'vitest'
import { PLANOS } from '@/data/planos'
import {
  ANUAL_EM_MESES, NIVEIS, NIVEL_GRATUITO, type RecursoId, PERIODOS, PRECO_MENSAL_CENTAVOS, RECURSOS, RECURSO_DO_PLANO_DE_TREINO, TESTE_GRATIS_DIAS,
  formatarPreco, lookupKey, nivelDeLookupKey, ordemDeAcesso, ordemDoNivel, precoEmCentavos, recurso,
} from '@/lib/assinatura/catalogo'

describe('preços', () => {
  it('mensal: R$ 39,90, R$ 52,90 e R$ 69,90 (em centavos, sem números quebrados)', () => {
    expect(PRECO_MENSAL_CENTAVOS).toEqual({ iniciante: 3990, amador: 5290, profissional: 6990 })
    for (const centavos of Object.values(PRECO_MENSAL_CENTAVOS)) expect(Number.isInteger(centavos)).toBe(true)
  })

  it('anual é o mensal vezes ANUAL_EM_MESES, e sempre menos que 12 meses (senão não há desconto)', () => {
    expect(ANUAL_EM_MESES).toBeLessThan(12)
    expect(ANUAL_EM_MESES).toBeGreaterThanOrEqual(10)
    for (const n of NIVEIS) {
      expect(precoEmCentavos(n, 'anual')).toBe(PRECO_MENSAL_CENTAVOS[n] * ANUAL_EM_MESES)
      expect(precoEmCentavos(n, 'mensal')).toBe(PRECO_MENSAL_CENTAVOS[n])
      expect(precoEmCentavos(n, 'anual')).toBeLessThan(precoEmCentavos(n, 'mensal') * 12)
    }
  })

  it('o plano mais alto custa mais, no mensal e no anual', () => {
    for (const periodo of PERIODOS) {
      expect(precoEmCentavos('iniciante', periodo)).toBeLessThan(precoEmCentavos('amador', periodo))
      expect(precoEmCentavos('amador', periodo)).toBeLessThan(precoEmCentavos('profissional', periodo))
    }
  })

  it('o teste grátis é de 7 dias', () => {
    expect(TESTE_GRATIS_DIAS).toBe(7)
  })
})

describe('formatarPreco', () => {
  it.each([
    [3990, 'R$ 39,90'], [5290, 'R$ 52,90'], [6990, 'R$ 69,90'], [100, 'R$ 1,00'], [5, 'R$ 0,05'],
    [39900, 'R$ 399,00'], [123450, 'R$ 1.234,50'], [100000, 'R$ 1.000,00'], [0, 'R$ 0,00'],
  ])('%i centavos vira %s', (centavos, texto) => {
    expect(formatarPreco(centavos)).toBe(texto)
  })

  it('não depende do idioma do computador (sempre vírgula nos centavos e ponto nos milhares)', () => {
    expect(formatarPreco(123456)).toBe('R$ 1.234,56')
  })
})

describe('lookup keys (o nome que cada preço tem no Stripe)', () => {
  it('há uma chave diferente para cada combinação de plano e período (6 no total)', () => {
    const chaves = NIVEIS.flatMap(n => PERIODOS.map(p => lookupKey(n, p)))
    expect(chaves).toHaveLength(6)
    expect(new Set(chaves).size).toBe(6)
    expect(chaves).toContain('iniciante_mensal')
    expect(chaves).toContain('profissional_anual')
  })

  it('ida e volta: o nível e o período saem da chave', () => {
    for (const n of NIVEIS) for (const p of PERIODOS) expect(nivelDeLookupKey(lookupKey(n, p))).toEqual({ nivel: n, periodo: p })
  })

  it.each(['', 'iniciante', 'iniciante_semanal', 'gold_mensal', 'iniciante_mensal_x', null, undefined])('chave desconhecida (%s) vira null', chave => {
    expect(nivelDeLookupKey(chave)).toBeNull()
  })
})

describe('níveis', () => {
  it('a ordem vai de iniciante a profissional', () => {
    expect(NIVEIS).toEqual(['iniciante', 'amador', 'profissional'])
    expect(ordemDoNivel('iniciante')).toBeLessThan(ordemDoNivel('amador'))
    expect(ordemDoNivel('amador')).toBeLessThan(ordemDoNivel('profissional'))
  })
})

describe('recursos', () => {
  it('todo recurso tem nome e um nível mínimo válido', () => {
    for (const r of Object.values(RECURSOS)) {
      expect(r.nome.length).toBeGreaterThan(3)
      expect([NIVEL_GRATUITO, ...NIVEIS]).toContain(r.nivelMinimo)
    }
  })

  it('os nomes dos recursos não se repetem', () => {
    const nomes = Object.values(RECURSOS).map(r => r.nome)
    expect(new Set(nomes).size).toBe(nomes.length)
  })

  it('cada plano tem pelo menos um recurso exclusivo (senão não haveria motivo para subir)', () => {
    for (const n of NIVEIS) {
      expect(Object.values(RECURSOS).some(r => r.nivelMinimo === n), n).toBe(true)
    }
  })

  it('registro de lesões e de pancadas na cabeça, com os alertas de segurança, é gratuito para todos', () => {
    expect(RECURSOS.alertasSeguranca.nivelMinimo).toBe(NIVEL_GRATUITO)
  })

  it('exportar os próprios dados é gratuito', () => {
    expect(recurso('exportarDados').nivelMinimo).toBe(NIVEL_GRATUITO)
  })

  it('o plano gratuito tem exatamente: registrar treino, cronômetro, alertas de segurança e exportar dados', () => {
    const gratis = (Object.keys(RECURSOS) as RecursoId[]).filter(id => recurso(id).nivelMinimo === NIVEL_GRATUITO).sort()
    expect(gratis).toEqual(['alertasSeguranca', 'cronometro', 'exportarDados', 'registroTreino'])
  })

  it('o gratuito é menor que o Iniciante: o Iniciante acrescenta biblioteca técnica e plano Fundamentos', () => {
    const novos = (Object.keys(RECURSOS) as RecursoId[]).filter(id => recurso(id).nivelMinimo === 'iniciante').sort()
    expect(novos).toEqual(['biblioteca', 'planoFundamentos'])
  })

  it('o gratuito vem antes de qualquer plano pago na ordem de acesso', () => {
    expect(ordemDeAcesso(NIVEL_GRATUITO)).toBeLessThan(ordemDeAcesso('iniciante'))
  })

  it('todo plano de treino do app está ligado a um recurso (senão ficaria liberado ou bloqueado por acidente)', () => {
    for (const p of PLANOS) {
      const recurso = RECURSO_DO_PLANO_DE_TREINO[p.id]
      expect(recurso, p.id).toBeDefined()
      expect(RECURSOS[recurso]).toBeDefined()
    }
  })

  it('lesões e pancadas na cabeça não ficam atrás de plano pago (senão o alerta de segurança nunca dispararia)', () => {
    expect(recurso('alertasSeguranca').nivelMinimo).toBe(NIVEL_GRATUITO)
    expect(recurso('saude').nome).not.toMatch(/lesõ/i)
    expect(recurso('sparringDetalhado').nome).not.toMatch(/pancadas? na cabeça\)?$/i)
  })

  it('Fundamentos no Iniciante; Base Aeróbica e Técnica Avançada no Amador; Pré-competição no Profissional', () => {
    expect(RECURSOS[RECURSO_DO_PLANO_DE_TREINO.fundamentos].nivelMinimo).toBe('iniciante')
    expect(RECURSOS[RECURSO_DO_PLANO_DE_TREINO['base-aerobica']].nivelMinimo).toBe('amador')
    expect(RECURSOS[RECURSO_DO_PLANO_DE_TREINO['tecnica-avancada']].nivelMinimo).toBe('amador')
    expect(RECURSOS[RECURSO_DO_PLANO_DE_TREINO['pre-competicao']].nivelMinimo).toBe('profissional')
  })
})
