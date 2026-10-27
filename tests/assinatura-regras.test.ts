import { describe, expect, it } from 'vitest'
import { NIVEIS, NIVEL_GRATUITO, RECURSOS, ordemDeAcesso, recurso, type RecursoId } from '@/lib/assinatura/catalogo'
import {
  DIAS_DE_TOLERANCIA, SEM_ASSINATURA, isEstadoAssinatura, planoDeTreinoLiberado, podeUsar, temAcesso, type EstadoAssinatura,
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
      const esperado = ordemDeAcesso(recurso(id).nivelMinimo) <= ordemDeAcesso(nivel)
      expect(podeUsar(id, estado({ nivel }), AGORA), `${id} no ${nivel}`).toBe(esperado)
    }
  })

  it('Iniciante não vê o que é do Amador nem do Profissional', () => {
    const e = estado({ nivel: 'iniciante' })
    expect(podeUsar('checkin', e, AGORA)).toBe(false)
    expect(podeUsar('planoPreCompeticao', e, AGORA)).toBe(false)
    expect(podeUsar('registroTreino', e, AGORA)).toBe(true)
    expect(podeUsar('biblioteca', e, AGORA)).toBe(true)
  })

  it('Cornerman libera tudo do Iniciante e do Amador e a gestão de alunos, e nada do Profissional', () => {
    const e = estado({ nivel: 'cornerman' })
    for (const id of ['checkin', 'carga', 'saude', 'reagendar', 'biblioteca', 'planoFundamentos', 'gestaoDeAlunos'] as RecursoId[]) expect(podeUsar(id, e, AGORA), id).toBe(true)
    for (const id of ['planoPreCompeticao', 'treinosDeAtletas', 'lembrete', 'importarDados', 'sparringDetalhado', 'perdaRapidaPeso'] as RecursoId[]) expect(podeUsar(id, e, AGORA), id).toBe(false)
  })

  it('Iniciante e Amador não têm a gestão de alunos; o Profissional tem', () => {
    expect(podeUsar('gestaoDeAlunos', estado({ nivel: 'iniciante' }), AGORA)).toBe(false)
    expect(podeUsar('gestaoDeAlunos', estado({ nivel: 'amador' }), AGORA)).toBe(false)
    expect(podeUsar('gestaoDeAlunos', estado({ nivel: 'profissional' }), AGORA)).toBe(true)
    expect(podeUsar('gestaoDeAlunos', SEM_ASSINATURA, AGORA)).toBe(false)
  })

  it('o estado guardado aceita o nível cornerman e continua aceitando os antigos', () => {
    for (const nivel of ['iniciante', 'amador', 'cornerman', 'profissional'] as const) expect(isEstadoAssinatura(estado({ nivel })), nivel).toBe(true)
    expect(isEstadoAssinatura({ ...estado({}), nivel: 'ouro' })).toBe(false)
  })

  it('Profissional vê tudo', () => {
    const e = estado({ nivel: 'profissional' })
    for (const id of ids) expect(podeUsar(id, e, AGORA), id).toBe(true)
  })

  it('o teste grátis dá os recursos do plano escolhido', () => {
    const e = estado({ situacao: 'teste', nivel: 'profissional', fimDoTeste: dias(5) })
    expect(podeUsar('planoPreCompeticao', e, AGORA)).toBe(true)
  })

  describe('modo gratuito (sem assinatura, cancelada ou vencida): só os recursos gratuitos', () => {
    const gratis = (id: RecursoId) => recurso(id).nivelMinimo === NIVEL_GRATUITO

    it('sem assinatura', () => {
      for (const id of ids) expect(podeUsar(id, SEM_ASSINATURA, AGORA), id).toBe(gratis(id))
    })

    it('assinatura cancelada', () => {
      const e = estado({ situacao: 'cancelada' })
      for (const id of ids) expect(podeUsar(id, e, AGORA), id).toBe(gratis(id))
    })

    it('teste grátis que já terminou', () => {
      const e = estado({ situacao: 'teste', fimDoTeste: dias(-1) })
      for (const id of ids) expect(podeUsar(id, e, AGORA), id).toBe(gratis(id))
    })

    it('pagamento atrasado além da tolerância', () => {
      const e = estado({ situacao: 'atrasada', fimDoPeriodo: dias(-10) })
      for (const id of ids) expect(podeUsar(id, e, AGORA), id).toBe(gratis(id))
    })

    it('o gratuito permite registrar treino, cronômetro, alertas de segurança e exportar', () => {
      for (const id of ['registroTreino', 'cronometro', 'alertasSeguranca', 'exportarDados'] as RecursoId[]) expect(podeUsar(id, SEM_ASSINATURA, AGORA), id).toBe(true)
    })

    it('e bloqueia o resto', () => {
      for (const id of ['biblioteca', 'checkin', 'carga', 'saude', 'planoPreCompeticao', 'lembrete'] as RecursoId[]) expect(podeUsar(id, SEM_ASSINATURA, AGORA), id).toBe(false)
    })
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

  it('sem assinatura, nenhum plano de treino fica liberado (todos são de plano pago)', () => {
    expect(planoDeTreinoLiberado('fundamentos', SEM_ASSINATURA, AGORA)).toBe(false)
  })
})
