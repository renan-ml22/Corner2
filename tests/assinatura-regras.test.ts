import { describe, expect, it } from 'vitest'
import { NIVEIS, RECURSOS, recurso, type RecursoId } from '@/lib/assinatura/catalogo'
import {
  DIAS_DE_TOLERANCIA, SEM_ASSINATURA, planoDeTreinoLiberado, podeUsar, temAcesso, type EstadoAssinatura,
} from '@/lib/assinatura/regras'

const AGORA = new Date('2026-10-20T12:00:00.000Z')
const dias = (n: number) => new Date(AGORA.getTime() + n * 86_400_000).toISOString()

const estado = (parcial: Partial<EstadoAssinatura>): EstadoAssinatura => ({
  situacao: 'ativa', nivel: 'amador', periodo: 'mensal', fimDoPeriodo: dias(20), fimDoTeste: null, cancelaNoFim: false, ...parcial,
})

describe('temAcesso', () => {
  it('sem assinatura: não', () => {
    expect(temAcesso(SEM_ASSINATURA, AGORA)).toBe(false)
  })

  it('ativa: sim', () => {
    expect(temAcesso(estado({ situacao: 'ativa' }), AGORA)).toBe(true)
  })

  it('ativa que já foi marcada para cancelar no fim do período continua valendo até o fim', () => {
    expect(temAcesso(estado({ situacao: 'ativa', cancelaNoFim: true, fimDoPeriodo: dias(5) }), AGORA)).toBe(true)
  })

  it('em teste grátis: sim, enquanto o teste não terminou', () => {
    expect(temAcesso(estado({ situacao: 'teste', fimDoTeste: dias(3) }), AGORA)).toBe(true)
  })

  it('em teste grátis com a data de fim já passada: não (o cookie pode estar velho)', () => {
    expect(temAcesso(estado({ situacao: 'teste', fimDoTeste: dias(-1) }), AGORA)).toBe(false)
  })

  it('em teste grátis sem data de fim: sim (o Stripe é quem decide)', () => {
    expect(temAcesso(estado({ situacao: 'teste', fimDoTeste: null }), AGORA)).toBe(true)
  })

  it('cancelada: não', () => {
    expect(temAcesso(estado({ situacao: 'cancelada' }), AGORA)).toBe(false)
  })

  describe('pagamento atrasado: tolerância de alguns dias depois do fim do período', () => {
    it('a tolerância é de 3 dias', () => {
      expect(DIAS_DE_TOLERANCIA).toBe(3)
    })

    it('dentro da tolerância: sim', () => {
      expect(temAcesso(estado({ situacao: 'atrasada', fimDoPeriodo: dias(-2) }), AGORA)).toBe(true)
    })

    it('exatamente no último instante da tolerância: sim', () => {
      expect(temAcesso(estado({ situacao: 'atrasada', fimDoPeriodo: dias(-DIAS_DE_TOLERANCIA) }), AGORA)).toBe(true)
    })

    it('depois da tolerância: não', () => {
      expect(temAcesso(estado({ situacao: 'atrasada', fimDoPeriodo: dias(-DIAS_DE_TOLERANCIA - 0.01) }), AGORA)).toBe(false)
    })

    it('sem data do período, por cautela: não', () => {
      expect(temAcesso(estado({ situacao: 'atrasada', fimDoPeriodo: null }), AGORA)).toBe(false)
    })
  })

  it('sem nível conhecido, não há acesso, mesmo "ativa"', () => {
    expect(temAcesso(estado({ situacao: 'ativa', nivel: null }), AGORA)).toBe(false)
  })
})

describe('podeUsar', () => {
  const ids = Object.keys(RECURSOS) as RecursoId[]

  it.each(NIVEIS)('com assinatura ativa %s: libera exatamente os recursos do nível ou abaixo', nivel => {
    for (const id of ids) {
      const esperado = recurso(id).semAssinatura === true || NIVEIS.indexOf(recurso(id).nivelMinimo) <= NIVEIS.indexOf(nivel)
      expect(podeUsar(id, estado({ nivel }), AGORA), `${id} no ${nivel}`).toBe(esperado)
    }
  })

  it('Iniciante não vê o que é do Amador nem do Profissional', () => {
    const e = estado({ nivel: 'iniciante' })
    expect(podeUsar('checkin', e, AGORA)).toBe(false)
    expect(podeUsar('planoPreCompeticao', e, AGORA)).toBe(false)
    expect(podeUsar('registroTreino', e, AGORA)).toBe(true)
  })

  it('Profissional vê tudo', () => {
    const e = estado({ nivel: 'profissional' })
    for (const id of ids) expect(podeUsar(id, e, AGORA), id).toBe(true)
  })

  it('o teste grátis dá os recursos do plano escolhido', () => {
    const e = estado({ situacao: 'teste', nivel: 'profissional', fimDoTeste: dias(5) })
    expect(podeUsar('planoPreCompeticao', e, AGORA)).toBe(true)
  })

  it('sem assinatura, só exportar os próprios dados continua liberado', () => {
    for (const id of ids) expect(podeUsar(id, SEM_ASSINATURA, AGORA), id).toBe(id === 'exportarDados')
  })

  it('assinatura cancelada: também só exportar os próprios dados', () => {
    const e = estado({ situacao: 'cancelada' })
    for (const id of ids) expect(podeUsar(id, e, AGORA), id).toBe(id === 'exportarDados')
  })
})

describe('planoDeTreinoLiberado', () => {
  it('Iniciante só tem o Fundamentos', () => {
    const e = estado({ nivel: 'iniciante' })
    expect(planoDeTreinoLiberado('fundamentos', e, AGORA)).toBe(true)
    expect(planoDeTreinoLiberado('base-aerobica', e, AGORA)).toBe(false)
    expect(planoDeTreinoLiberado('tecnica-avancada', e, AGORA)).toBe(false)
    expect(planoDeTreinoLiberado('pre-competicao', e, AGORA)).toBe(false)
  })

  it('Amador tem os três primeiros e não a Pré-competição', () => {
    const e = estado({ nivel: 'amador' })
    expect(planoDeTreinoLiberado('base-aerobica', e, AGORA)).toBe(true)
    expect(planoDeTreinoLiberado('tecnica-avancada', e, AGORA)).toBe(true)
    expect(planoDeTreinoLiberado('pre-competicao', e, AGORA)).toBe(false)
  })

  it('Profissional tem todos', () => {
    const e = estado({ nivel: 'profissional' })
    for (const id of ['fundamentos', 'base-aerobica', 'tecnica-avancada', 'pre-competicao']) expect(planoDeTreinoLiberado(id, e, AGORA), id).toBe(true)
  })

  it('plano de treino desconhecido: não libera', () => {
    expect(planoDeTreinoLiberado('inexistente', estado({ nivel: 'profissional' }), AGORA)).toBe(false)
  })

  it('sem assinatura, nenhum plano de treino fica liberado', () => {
    expect(planoDeTreinoLiberado('fundamentos', SEM_ASSINATURA, AGORA)).toBe(false)
  })
})
