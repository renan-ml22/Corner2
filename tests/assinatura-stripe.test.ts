import { describe, expect, it } from 'vitest'
import { SEM_ASSINATURA } from '@/lib/assinatura/regras'
import { estadoDeAssinaturas, type AssinaturaStripe } from '@/lib/assinatura/stripe-para-estado'

const unix = (iso: string) => Math.floor(new Date(iso).getTime() / 1000)
const FIM = '2026-11-20T12:00:00.000Z'

/** Assinatura no formato novo da API do Stripe (o fim do período fica em cada item). */
function nova(parcial: Partial<AssinaturaStripe> & { chave?: string | null; fim?: string } = {}): AssinaturaStripe {
  const { chave = 'amador_mensal', fim = FIM, ...resto } = parcial
  return { status: 'active', cancel_at_period_end: false, trial_end: null, items: { data: [{ price: { lookup_key: chave }, current_period_end: unix(fim) }] }, ...resto }
}

describe('estadoDeAssinaturas: um status do Stripe vira um estado nosso', () => {
  it('sem nenhuma assinatura: nenhuma', () => {
    expect(estadoDeAssinaturas([])).toEqual(SEM_ASSINATURA)
  })

  it('active: ativa, com nível, período e fim do período', () => {
    expect(estadoDeAssinaturas([nova()])).toEqual({
      situacao: 'ativa', nivel: 'amador', periodo: 'mensal', fimDoPeriodo: FIM, fimDoTeste: null, cancelaNoFim: false,
    })
  })

  it('trialing: teste, com a data do fim do teste', () => {
    const e = estadoDeAssinaturas([nova({ status: 'trialing', trial_end: unix('2026-10-27T12:00:00.000Z') })])
    expect(e).toMatchObject({ situacao: 'teste', nivel: 'amador', fimDoTeste: '2026-10-27T12:00:00.000Z' })
  })

  it('past_due: atrasada', () => {
    expect(estadoDeAssinaturas([nova({ status: 'past_due' })]).situacao).toBe('atrasada')
  })

  it.each(['canceled', 'unpaid', 'incomplete_expired', 'paused'])('%s: cancelada (sem acesso)', status => {
    expect(estadoDeAssinaturas([nova({ status })]).situacao).toBe('cancelada')
  })

  it('incomplete (o pagamento ainda não foi feito): nenhuma', () => {
    expect(estadoDeAssinaturas([nova({ status: 'incomplete' })])).toEqual(SEM_ASSINATURA)
  })

  it('status que o Stripe inventar no futuro: nenhuma, nunca libera por engano', () => {
    expect(estadoDeAssinaturas([nova({ status: 'estado_novo' })])).toEqual(SEM_ASSINATURA)
  })

  it('cancelamento marcado para o fim do período: continua ativa, mas avisa', () => {
    expect(estadoDeAssinaturas([nova({ cancel_at_period_end: true })])).toMatchObject({ situacao: 'ativa', cancelaNoFim: true })
  })

  it.each([
    ['iniciante_anual', 'iniciante', 'anual'], ['amador_mensal', 'amador', 'mensal'], ['profissional_anual', 'profissional', 'anual'],
  ])('a chave %s dá nível %s e período %s', (chave, nivel, periodo) => {
    expect(estadoDeAssinaturas([nova({ chave })])).toMatchObject({ nivel, periodo })
  })

  it('preço com chave desconhecida ou sem chave: ignora a assinatura (não é nossa)', () => {
    expect(estadoDeAssinaturas([nova({ chave: 'outro_produto' })])).toEqual(SEM_ASSINATURA)
    expect(estadoDeAssinaturas([nova({ chave: null })])).toEqual(SEM_ASSINATURA)
  })
})

describe('fim do período nas duas versões da API do Stripe', () => {
  it('formato antigo: current_period_end na própria assinatura', () => {
    const antiga: AssinaturaStripe = { status: 'active', current_period_end: unix(FIM), items: { data: [{ price: { lookup_key: 'amador_mensal' } }] } }
    expect(estadoDeAssinaturas([antiga]).fimDoPeriodo).toBe(FIM)
  })

  it('formato novo: current_period_end no item', () => {
    expect(estadoDeAssinaturas([nova()]).fimDoPeriodo).toBe(FIM)
  })

  it('sem nenhuma das duas datas: fim do período nulo, sem lançar erro', () => {
    const sem: AssinaturaStripe = { status: 'active', items: { data: [{ price: { lookup_key: 'amador_mensal' } }] } }
    expect(estadoDeAssinaturas([sem]).fimDoPeriodo).toBeNull()
  })
})

describe('mais de uma assinatura (troca de plano, assinatura antiga, duplicada)', () => {
  it('a que dá acesso ganha da cancelada', () => {
    const e = estadoDeAssinaturas([nova({ status: 'canceled', chave: 'profissional_mensal' }), nova({ status: 'active', chave: 'iniciante_mensal' })])
    expect(e).toMatchObject({ situacao: 'ativa', nivel: 'iniciante' })
  })

  it('entre duas que dão acesso, o nível mais alto ganha', () => {
    const e = estadoDeAssinaturas([nova({ chave: 'iniciante_mensal' }), nova({ chave: 'profissional_anual' }), nova({ chave: 'amador_mensal' })])
    expect(e).toMatchObject({ nivel: 'profissional', periodo: 'anual' })
  })

  it('no mesmo nível, a que vai até mais tarde ganha', () => {
    const e = estadoDeAssinaturas([nova({ fim: '2026-11-01T00:00:00.000Z' }), nova({ fim: '2026-12-01T00:00:00.000Z' })])
    expect(e.fimDoPeriodo).toBe('2026-12-01T00:00:00.000Z')
  })

  it('teste grátis e ativa contam como acesso: vale o nível mais alto', () => {
    const e = estadoDeAssinaturas([nova({ status: 'trialing', chave: 'profissional_mensal', trial_end: unix(FIM) }), nova({ chave: 'iniciante_mensal' })])
    expect(e).toMatchObject({ situacao: 'teste', nivel: 'profissional' })
  })

  it('só canceladas: mostra a mais recente como cancelada', () => {
    const e = estadoDeAssinaturas([nova({ status: 'canceled', fim: '2026-08-01T00:00:00.000Z', chave: 'iniciante_mensal' }), nova({ status: 'canceled', fim: '2026-09-01T00:00:00.000Z', chave: 'amador_mensal' })])
    expect(e).toMatchObject({ situacao: 'cancelada', nivel: 'amador' })
  })

  it('assinaturas de outros produtos no meio são ignoradas', () => {
    const e = estadoDeAssinaturas([nova({ chave: 'camiseta_mensal' }), nova({ chave: 'amador_mensal' })])
    expect(e.nivel).toBe('amador')
  })

  it('não altera a lista recebida', () => {
    const lista = [nova({ chave: 'iniciante_mensal' }), nova({ chave: 'profissional_mensal' })]
    const copia = JSON.parse(JSON.stringify(lista))
    estadoDeAssinaturas(lista)
    expect(lista).toEqual(copia)
  })
})
