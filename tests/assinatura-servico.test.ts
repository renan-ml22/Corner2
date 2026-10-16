import { describe, expect, it } from 'vitest'
import { TESTE_GRATIS_DIAS } from '@/lib/assinatura/catalogo'
import {
  ErroAssinatura, acharCliente, criarCheckout, criarPortal, estadoDoUsuario, type StripeLike,
} from '@/lib/assinatura/servico'

const USUARIO = { id: 'u_test', email: 'atleta@exemplo.com', name: 'Atleta' }
const ORIGEM = 'https://corner2.vercel.app'
const unix = (iso: string) => Math.floor(new Date(iso).getTime() / 1000)

type Chamada = { metodo: string; args: unknown }

/** Stripe falso: guarda o que foi pedido e devolve o que o teste preparou. */
function falso(opcoes: {
  clientes?: { id: string; email: string; metadata: Record<string, string> }[]
  assinaturas?: unknown[]
  precos?: Record<string, string>
  semUrl?: boolean
} = {}) {
  const chamadas: Chamada[] = []
  const reg = <T,>(metodo: string, args: unknown, retorno: T): T => { chamadas.push({ metodo, args }); return retorno }
  const clientes = [...(opcoes.clientes ?? [])]
  const precos = opcoes.precos ?? { amador_mensal: 'price_amador_mensal', profissional_anual: 'price_profissional_anual', iniciante_mensal: 'price_iniciante_mensal' }
  const stripe = {
    customers: {
      list: async (p: { email: string }) => reg('customers.list', p, { data: clientes.filter(c => c.email === p.email) }),
      create: async (p: { email: string; metadata: Record<string, string> }) => {
        const c = { id: `cus_${clientes.length + 1}`, email: p.email, metadata: p.metadata }
        clientes.push(c)
        return reg('customers.create', p, c)
      },
    },
    prices: {
      list: async (p: { lookup_keys: string[] }) => reg('prices.list', p, { data: precos[p.lookup_keys[0]] ? [{ id: precos[p.lookup_keys[0]] }] : [] }),
    },
    subscriptions: {
      list: async (p: { customer: string }) => reg('subscriptions.list', p, { data: opcoes.assinaturas ?? [] }),
    },
    checkout: {
      sessions: { create: async (p: unknown) => reg('checkout.create', p, { id: 'cs_1', url: opcoes.semUrl ? null : 'https://checkout.stripe.com/c/pay/cs_1' }) },
    },
    billingPortal: {
      sessions: { create: async (p: unknown) => reg('portal.create', p, { url: 'https://billing.stripe.com/p/session/x' }) },
    },
  } as unknown as StripeLike
  const pedidos = (metodo: string) => chamadas.filter(c => c.metodo === metodo).map(c => c.args as Record<string, unknown>)
  return { stripe, chamadas, pedidos }
}

const assinatura = (parcial: Record<string, unknown> = {}) => ({
  id: 'sub_1', status: 'active', cancel_at_period_end: false, trial_end: null,
  items: { data: [{ id: 'si_1', price: { lookup_key: 'amador_mensal' }, current_period_end: unix('2026-11-20T12:00:00.000Z') }] }, ...parcial,
})
const doUsuario = { id: 'cus_existente', email: USUARIO.email, metadata: { corner_user_id: USUARIO.id } }

describe('acharCliente', () => {
  it('sem cliente no Stripe: null (e não cria nada)', async () => {
    const f = falso()
    expect(await acharCliente(f.stripe, USUARIO)).toBeNull()
    expect(f.pedidos('customers.create')).toHaveLength(0)
  })

  it('acha o cliente pelo e-mail quando a marca do usuário confere', async () => {
    const f = falso({ clientes: [doUsuario] })
    expect(await acharCliente(f.stripe, USUARIO)).toBe('cus_existente')
  })

  it('ignora cliente com o mesmo e-mail mas de outro usuário (ou sem marca)', async () => {
    const f = falso({ clientes: [{ id: 'cus_outro', email: USUARIO.email, metadata: { corner_user_id: 'u_outro' } }, { id: 'cus_sem', email: USUARIO.email, metadata: {} }] })
    expect(await acharCliente(f.stripe, USUARIO)).toBeNull()
  })
})

describe('estadoDoUsuario', () => {
  it('sem cliente: sem assinatura, sem nem consultar assinaturas', async () => {
    const f = falso()
    expect((await estadoDoUsuario(f.stripe, USUARIO)).situacao).toBe('nenhuma')
    expect(f.pedidos('subscriptions.list')).toHaveLength(0)
  })

  it('com assinatura ativa: devolve nível, período e fim', async () => {
    const f = falso({ clientes: [doUsuario], assinaturas: [assinatura()] })
    expect(await estadoDoUsuario(f.stripe, USUARIO)).toMatchObject({ situacao: 'ativa', nivel: 'amador', periodo: 'mensal', fimDoPeriodo: '2026-11-20T12:00:00.000Z' })
  })

  it('consulta todas as assinaturas do cliente, inclusive as canceladas', async () => {
    const f = falso({ clientes: [doUsuario], assinaturas: [] })
    await estadoDoUsuario(f.stripe, USUARIO)
    expect(f.pedidos('subscriptions.list')[0]).toMatchObject({ customer: 'cus_existente', status: 'all' })
  })
})

describe('criarCheckout', () => {
  const pedido = (parcial = {}) => ({ usuario: USUARIO, nivel: 'amador' as const, periodo: 'mensal' as const, origem: ORIGEM, ...parcial })

  it('primeira assinatura: cria o cliente, e a sessão de assinatura com 7 dias grátis sem cartão', async () => {
    const f = falso()
    const r = await criarCheckout(f.stripe, pedido())
    expect(r.url).toBe('https://checkout.stripe.com/c/pay/cs_1')
    expect(f.pedidos('customers.create')[0]).toMatchObject({ email: USUARIO.email, metadata: { corner_user_id: USUARIO.id } })
    const s = f.pedidos('checkout.create')[0]
    expect(s).toMatchObject({
      mode: 'subscription', customer: 'cus_1', locale: 'pt-BR', client_reference_id: USUARIO.id,
      line_items: [{ price: 'price_amador_mensal', quantity: 1 }],
      payment_method_collection: 'if_required',
      subscription_data: { trial_period_days: TESTE_GRATIS_DIAS, metadata: { corner_user_id: USUARIO.id }, trial_settings: { end_behavior: { missing_payment_method: 'cancel' } } },
    })
  })

  it('o teste grátis é de 7 dias', () => {
    expect(TESTE_GRATIS_DIAS).toBe(7)
  })

  it('reaproveita o cliente que já existe (não cria outro)', async () => {
    const f = falso({ clientes: [doUsuario] })
    await criarCheckout(f.stripe, pedido())
    expect(f.pedidos('customers.create')).toHaveLength(0)
    expect(f.pedidos('checkout.create')[0]).toMatchObject({ customer: 'cus_existente' })
  })

  it('busca o preço pela chave (plano + período), e nunca aceita um id de preço de fora', async () => {
    const f = falso()
    await criarCheckout(f.stripe, pedido({ nivel: 'profissional', periodo: 'anual' }))
    expect(f.pedidos('prices.list')[0]).toMatchObject({ lookup_keys: ['profissional_anual'], active: true })
    expect(f.pedidos('checkout.create')[0]).toMatchObject({ line_items: [{ price: 'price_profissional_anual', quantity: 1 }] })
  })

  it('volta para a tela de assinatura, com o id da sessão no sucesso', async () => {
    const f = falso()
    await criarCheckout(f.stripe, pedido())
    const s = f.pedidos('checkout.create')[0] as { success_url: string; cancel_url: string }
    expect(s.success_url).toBe(`${ORIGEM}/assinatura?checkout=ok&session_id={CHECKOUT_SESSION_ID}`)
    expect(s.cancel_url).toBe(`${ORIGEM}/assinatura?checkout=cancelado`)
  })

  it('quem já teve assinatura (mesmo cancelada) não ganha outro teste grátis e paga desde o início', async () => {
    const f = falso({ clientes: [doUsuario], assinaturas: [assinatura({ status: 'canceled' })] })
    await criarCheckout(f.stripe, pedido())
    const s = f.pedidos('checkout.create')[0] as { payment_method_collection: string; subscription_data: Record<string, unknown> }
    expect(s.payment_method_collection).toBe('always')
    expect(s.subscription_data).not.toHaveProperty('trial_period_days')
    expect(s.subscription_data).not.toHaveProperty('trial_settings')
    expect(s.subscription_data).toMatchObject({ metadata: { corner_user_id: USUARIO.id } })
  })

  it.each(['active', 'trialing', 'past_due'])('quem já tem assinatura %s não cria outra: orienta a usar o portal', async status => {
    const f = falso({ clientes: [doUsuario], assinaturas: [assinatura({ status })] })
    await expect(criarCheckout(f.stripe, pedido())).rejects.toMatchObject({ codigo: 'ja_assinante', status: 409 })
    expect(f.pedidos('checkout.create')).toHaveLength(0)
  })

  it('preço que não existe no Stripe (script de sincronização não rodou): erro claro, sem criar sessão', async () => {
    const f = falso({ precos: {} })
    await expect(criarCheckout(f.stripe, pedido())).rejects.toMatchObject({ codigo: 'preco_inexistente', status: 503 })
    expect(f.pedidos('checkout.create')).toHaveLength(0)
  })

  it('o Stripe não devolveu o endereço de pagamento: erro, nunca "undefined"', async () => {
    const f = falso({ semUrl: true })
    await expect(criarCheckout(f.stripe, pedido())).rejects.toMatchObject({ codigo: 'sem_url', status: 502 })
  })

  it('a mensagem de erro é em português e não repete nada do Stripe', async () => {
    const f = falso({ precos: {} })
    const erro = await criarCheckout(f.stripe, pedido()).catch(e => e)
    expect(erro).toBeInstanceOf(ErroAssinatura)
    expect(erro.message).toMatch(/[a-zç]/i)
    expect(erro.message).not.toMatch(/price_|cus_|sk_/)
  })
})

describe('criarPortal: trocar de plano', () => {
  const troca = (parcial = {}) => ({ usuario: USUARIO, origem: ORIGEM, trocarPara: { nivel: 'profissional' as const, periodo: 'mensal' as const }, ...parcial })
  const precos = { amador_mensal: 'price_amador_mensal', profissional_mensal: 'price_profissional_mensal', profissional_anual: 'price_profissional_anual', amador_anual: 'price_amador_anual' }

  it('abre o portal direto na confirmação da troca, com a assinatura, o item e o preço de destino', async () => {
    const f = falso({ clientes: [doUsuario], assinaturas: [assinatura()], precos })
    const r = await criarPortal(f.stripe, troca())
    expect(r.url).toBe('https://billing.stripe.com/p/session/x')
    expect(f.pedidos('portal.create')[0]).toEqual({
      customer: 'cus_existente',
      return_url: `${ORIGEM}/assinatura`,
      flow_data: {
        type: 'subscription_update_confirm',
        subscription_update_confirm: { subscription: 'sub_1', items: [{ id: 'si_1', price: 'price_profissional_mensal', quantity: 1 }] },
        after_completion: { type: 'redirect', redirect: { return_url: `${ORIGEM}/assinatura` } },
      },
    })
  })

  it('o preço de destino é buscado pela chave (plano + período), nunca recebido do navegador', async () => {
    const f = falso({ clientes: [doUsuario], assinaturas: [assinatura()], precos })
    await criarPortal(f.stripe, troca({ trocarPara: { nivel: 'profissional', periodo: 'anual' } }))
    expect(f.pedidos('prices.list')[0]).toMatchObject({ lookup_keys: ['profissional_anual'], active: true })
  })

  it('serve também em teste grátis', async () => {
    const f = falso({ clientes: [doUsuario], assinaturas: [assinatura({ status: 'trialing', trial_end: unix('2026-10-27T12:00:00.000Z') })], precos })
    await criarPortal(f.stripe, troca())
    expect(f.pedidos('portal.create')[0]).toHaveProperty('flow_data')
  })

  it('trocar só o período do mesmo plano (mensal para anual) também é uma troca', async () => {
    const f = falso({ clientes: [doUsuario], assinaturas: [assinatura()], precos })
    await criarPortal(f.stripe, troca({ trocarPara: { nivel: 'amador', periodo: 'anual' } }))
    expect((f.pedidos('portal.create')[0] as { flow_data: { subscription_update_confirm: { items: { price: string }[] } } }).flow_data.subscription_update_confirm.items[0].price).toBe('price_amador_anual')
  })

  it('já está nesse plano e período: erro 409, sem abrir portal', async () => {
    const f = falso({ clientes: [doUsuario], assinaturas: [assinatura()], precos })
    await expect(criarPortal(f.stripe, troca({ trocarPara: { nivel: 'amador', periodo: 'mensal' } }))).rejects.toMatchObject({ codigo: 'mesmo_plano', status: 409 })
    expect(f.pedidos('portal.create')).toHaveLength(0)
  })

  it('sem assinatura ativa ou em teste (só cancelada): erro 409 orientando a assinar', async () => {
    const f = falso({ clientes: [doUsuario], assinaturas: [assinatura({ status: 'canceled' })], precos })
    await expect(criarPortal(f.stripe, troca())).rejects.toMatchObject({ codigo: 'sem_assinatura_ativa', status: 409 })
    expect(f.pedidos('portal.create')).toHaveLength(0)
  })

  it('pagamento atrasado não troca de plano: erro 409 (primeiro é preciso resolver o pagamento)', async () => {
    const f = falso({ clientes: [doUsuario], assinaturas: [assinatura({ status: 'past_due' })], precos })
    await expect(criarPortal(f.stripe, troca())).rejects.toMatchObject({ codigo: 'sem_assinatura_ativa', status: 409 })
  })

  it('preço de destino que não existe no Stripe: erro 503', async () => {
    const f = falso({ clientes: [doUsuario], assinaturas: [assinatura()], precos: { amador_mensal: 'price_amador_mensal' } })
    await expect(criarPortal(f.stripe, troca())).rejects.toMatchObject({ codigo: 'preco_inexistente', status: 503 })
  })

  it('sem cliente no Stripe: erro 409, como no portal comum', async () => {
    const f = falso({ precos })
    await expect(criarPortal(f.stripe, troca())).rejects.toMatchObject({ codigo: 'sem_cliente', status: 409 })
  })
})

describe('criarPortal', () => {
  it('abre o portal do cliente, voltando para a tela de assinatura', async () => {
    const f = falso({ clientes: [doUsuario] })
    const r = await criarPortal(f.stripe, { usuario: USUARIO, origem: ORIGEM })
    expect(r.url).toBe('https://billing.stripe.com/p/session/x')
    expect(f.pedidos('portal.create')[0]).toEqual({ customer: 'cus_existente', return_url: `${ORIGEM}/assinatura` })
  })

  it('sem cliente no Stripe: erro 409 (nada a gerenciar) e não cria cliente', async () => {
    const f = falso()
    await expect(criarPortal(f.stripe, { usuario: USUARIO, origem: ORIGEM })).rejects.toMatchObject({ codigo: 'sem_cliente', status: 409 })
    expect(f.pedidos('customers.create')).toHaveLength(0)
  })
})
