import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const ctx = vi.hoisted(() => ({
  cookies: new Map<string, string>(),
  gravados: [] as { nome: string; valor: string; opcoes: Record<string, unknown> }[],
  proto: null as string | null,
  stripe: null as unknown,
  perguntasAoStripe: 0,
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (nome: string) => (ctx.cookies.has(nome) ? { value: ctx.cookies.get(nome) } : undefined),
    set: (nome: string, valor: string, opcoes: Record<string, unknown>) => { ctx.gravados.push({ nome, valor, opcoes }); ctx.cookies.set(nome, valor) },
  }),
  headers: async () => ({ get: (n: string) => (n === 'x-forwarded-proto' ? ctx.proto : null) }),
}))
vi.mock('@/lib/assinatura/stripe', () => ({ getStripe: () => ctx.stripe }))

import { NOME_DO_COOKIE_ESTADO, VALIDADE_SEGUNDOS, assinarEstado, lerEstado } from '@/lib/assinatura/cookie-estado'
import type { EstadoAssinatura } from '@/lib/assinatura/regras'
import { estadoNoServidor } from '@/lib/assinatura/estado-servidor'

const SEGREDO = 'segredo-de-teste-0123456789-0123456789'
const USUARIO = { id: 'u_ana', email: 'ana@exemplo.com', name: 'Ana' }
const unix = (iso: string) => Math.floor(new Date(iso).getTime() / 1000)
const DO_CACHE: EstadoAssinatura = { situacao: 'ativa', nivel: 'amador', periodo: 'mensal', fimDoPeriodo: '2026-11-20T12:00:00.000Z', fimDoTeste: null, cancelaNoFim: false }

/** Stripe falso com uma assinatura ativa do Cornerman; conta quantas vezes foi consultado. */
function stripeFalso(falhar = false) {
  const cliente = { id: 'cus_1', email: USUARIO.email, metadata: { corner_user_id: USUARIO.id } }
  return {
    customers: { list: async () => { ctx.perguntasAoStripe++; if (falhar) throw new Error('Stripe fora do ar'); return { data: [cliente] } } },
    subscriptions: {
      list: async () => ({
        data: [{ id: 'sub_1', status: 'active', cancel_at_period_end: false, trial_end: null, items: { data: [{ id: 'si_1', price: { lookup_key: 'cornerman_mensal' }, current_period_end: unix('2026-11-27T12:00:00.000Z') }] } }],
      }),
    },
  }
}

beforeEach(() => {
  ctx.cookies.clear()
  ctx.gravados = []
  ctx.proto = null
  ctx.stripe = stripeFalso()
  ctx.perguntasAoStripe = 0
  vi.stubEnv('SESSION_SECRET', SEGREDO)
})

describe('estadoNoServidor', () => {
  it('cookie válido do mesmo usuário: usa o cookie e NÃO pergunta ao Stripe', async () => {
    ctx.cookies.set(NOME_DO_COOKIE_ESTADO, await assinarEstado(DO_CACHE, USUARIO.id, SEGREDO))
    const r = await estadoNoServidor(USUARIO, { forcar: false })
    expect(r).toEqual({ pagamentoAtivo: true, estado: DO_CACHE, origem: 'cache' })
    expect(ctx.perguntasAoStripe).toBe(0)
    expect(ctx.gravados).toHaveLength(0)
  })

  it('cookie de OUTRO usuário não vale: pergunta ao Stripe e grava um cookie novo', async () => {
    ctx.cookies.set(NOME_DO_COOKIE_ESTADO, await assinarEstado({ ...DO_CACHE, nivel: 'profissional' }, 'u_outro', SEGREDO))
    const r = await estadoNoServidor(USUARIO, { forcar: false })
    expect(r).toMatchObject({ pagamentoAtivo: true, origem: 'stripe', estado: { situacao: 'ativa', nivel: 'cornerman', periodo: 'mensal' } })
    expect(ctx.perguntasAoStripe).toBeGreaterThan(0)
    expect(ctx.gravados).toHaveLength(1)
    expect(await lerEstado(ctx.gravados[0].valor, USUARIO.id, SEGREDO)).toMatchObject({ nivel: 'cornerman' })
  })

  it('cookie adulterado não vale', async () => {
    const bom = await assinarEstado({ ...DO_CACHE, nivel: 'profissional' }, USUARIO.id, SEGREDO)
    ctx.cookies.set(NOME_DO_COOKIE_ESTADO, `${bom.slice(0, -3)}AAA`)
    const r = await estadoNoServidor(USUARIO, { forcar: false })
    expect(r).toMatchObject({ origem: 'stripe', estado: { nivel: 'cornerman' } })
  })

  it('cookie assinado com outro segredo não vale', async () => {
    ctx.cookies.set(NOME_DO_COOKIE_ESTADO, await assinarEstado({ ...DO_CACHE, nivel: 'profissional' }, USUARIO.id, 'outro-segredo-qualquer-0123456789'))
    expect(await estadoNoServidor(USUARIO, { forcar: false })).toMatchObject({ origem: 'stripe', estado: { nivel: 'cornerman' } })
  })

  it('forcar: ignora o cookie e consulta o Stripe', async () => {
    ctx.cookies.set(NOME_DO_COOKIE_ESTADO, await assinarEstado(DO_CACHE, USUARIO.id, SEGREDO))
    const r = await estadoNoServidor(USUARIO, { forcar: true })
    expect(r).toMatchObject({ origem: 'stripe', estado: { nivel: 'cornerman' } })
    expect(ctx.perguntasAoStripe).toBeGreaterThan(0)
  })

  it('o cookie novo vale por 5 minutos, é httpOnly, sameSite lax e vale no site todo', async () => {
    await estadoNoServidor(USUARIO, { forcar: false })
    expect(ctx.gravados[0]).toMatchObject({ nome: NOME_DO_COOKIE_ESTADO, opcoes: { httpOnly: true, sameSite: 'lax', path: '/', maxAge: VALIDADE_SEGUNDOS, secure: false } })
    expect(VALIDADE_SEGUNDOS).toBe(300)
  })

  it('atrás do proxy HTTPS (x-forwarded-proto) o cookie é "secure"', async () => {
    ctx.proto = 'https, http'
    await estadoNoServidor(USUARIO, { forcar: false })
    expect(ctx.gravados[0].opcoes.secure).toBe(true)
  })

  it('sem a chave do Stripe e sem cookie: pagamento desligado, sem gravar cookie', async () => {
    ctx.stripe = null
    expect(await estadoNoServidor(USUARIO, { forcar: false })).toEqual({ pagamentoAtivo: false })
    expect(ctx.gravados).toHaveLength(0)
  })

  it('sem a chave do Stripe mas com cookie válido: continua usando o cookie (como a rota sempre fez)', async () => {
    ctx.stripe = null
    ctx.cookies.set(NOME_DO_COOKIE_ESTADO, await assinarEstado(DO_CACHE, USUARIO.id, SEGREDO))
    expect(await estadoNoServidor(USUARIO, { forcar: false })).toMatchObject({ origem: 'cache' })
  })

  it('falha do Stripe: lança o erro (quem chama decide) e não grava cookie', async () => {
    ctx.stripe = stripeFalso(true)
    await expect(estadoNoServidor(USUARIO, { forcar: false })).rejects.toThrow('Stripe fora do ar')
    expect(ctx.gravados).toHaveLength(0)
  })
})
