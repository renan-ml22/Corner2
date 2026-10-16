import { SignJWT } from 'jose'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SEM_ASSINATURA, type EstadoAssinatura } from '@/lib/assinatura/regras'
import { NOME_DO_COOKIE_ESTADO, assinarEstado, lerEstado, VALIDADE_SEGUNDOS } from '@/lib/assinatura/cookie-estado'

const SEGREDO = 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres'
const ativa: EstadoAssinatura = { situacao: 'ativa', nivel: 'amador', periodo: 'mensal', fimDoPeriodo: '2026-11-20T12:00:00.000Z', fimDoTeste: null, cancelaNoFim: false }

afterEach(() => vi.useRealTimers())

describe('cookie do estado da assinatura (guarda o que o Stripe disse por poucos minutos)', () => {
  it('o cookie se chama corner_assinatura e vale 5 minutos', () => {
    expect(NOME_DO_COOKIE_ESTADO).toBe('corner_assinatura')
    expect(VALIDADE_SEGUNDOS).toBe(300)
  })

  it('ida e volta: o estado gravado é o estado lido', async () => {
    const token = await assinarEstado(ativa, 'u1', SEGREDO)
    expect(await lerEstado(token, 'u1', SEGREDO)).toEqual(ativa)
  })

  it('serve também para "sem assinatura" (para não perguntar ao Stripe toda hora)', async () => {
    expect(await lerEstado(await assinarEstado(SEM_ASSINATURA, 'u1', SEGREDO), 'u1', SEGREDO)).toEqual(SEM_ASSINATURA)
  })

  it('de outro usuário: não vale', async () => {
    const token = await assinarEstado(ativa, 'u1', SEGREDO)
    expect(await lerEstado(token, 'u2', SEGREDO)).toBeNull()
  })

  it('com outro segredo: não vale', async () => {
    const token = await assinarEstado(ativa, 'u1', SEGREDO)
    expect(await lerEstado(token, 'u1', SEGREDO + 'x')).toBeNull()
  })

  it('adulterado: não vale', async () => {
    const token = await assinarEstado(ativa, 'u1', SEGREDO)
    const [a, b, c] = token.split('.')
    const forjado = Buffer.from(JSON.stringify({ u: 'u1', e: { ...ativa, nivel: 'profissional' }, aud: 'corner-assinatura' })).toString('base64url')
    expect(await lerEstado(`${a}.${forjado}.${c}`, 'u1', SEGREDO)).toBeNull()
    expect(await lerEstado(`${a}.${b}.${c.slice(0, -2)}xx`, 'u1', SEGREDO)).toBeNull()
  })

  it.each([undefined, '', 'lixo', 'a.b.c'])('token ausente ou inválido (%s): null', async token => {
    expect(await lerEstado(token, 'u1', SEGREDO)).toBeNull()
  })

  it('expira em 5 minutos', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-20T12:00:00Z'))
    const token = await assinarEstado(ativa, 'u1', SEGREDO)
    vi.setSystemTime(new Date('2026-10-20T12:04:50Z'))
    expect(await lerEstado(token, 'u1', SEGREDO)).toEqual(ativa)
    vi.setSystemTime(new Date('2026-10-20T12:05:10Z'))
    expect(await lerEstado(token, 'u1', SEGREDO)).toBeNull()
  })

  it('o token de sessão de login não serve como cookie de assinatura (e vice-versa)', async () => {
    const chave = new TextEncoder().encode(SEGREDO)
    const sessao = await new SignJWT({ userId: 'u1', expiresAt: 'x' }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('7d').sign(chave)
    expect(await lerEstado(sessao, 'u1', SEGREDO)).toBeNull()
  })

  it('assinado com a chave da sessão mas sem o público certo: não vale', async () => {
    const chave = new TextEncoder().encode(SEGREDO)
    const forjado = await new SignJWT({ u: 'u1', e: ativa }).setProtectedHeader({ alg: 'HS256' }).setAudience('corner-assinatura').setExpirationTime('5m').sign(chave)
    expect(await lerEstado(forjado, 'u1', SEGREDO)).toBeNull() // a chave de assinatura é derivada, não a da sessão
  })

  it.each([
    ['situação inventada', { ...ativa, situacao: 'vip' }],
    ['nível inventado', { ...ativa, nivel: 'ouro' }],
    ['sem campos', {}],
    ['texto no lugar do objeto', 'ativa'],
  ])('estado com formato inválido (%s): não vale, mesmo com assinatura certa', async (_nome, estado) => {
    const token = await assinarEstado(estado as EstadoAssinatura, 'u1', SEGREDO)
    expect(await lerEstado(token, 'u1', SEGREDO)).toBeNull()
  })

  it('sem segredo configurado: assinar falha e ler devolve null (nunca lança nem libera)', async () => {
    await expect(assinarEstado(ativa, 'u1', undefined)).rejects.toThrow()
    expect(await lerEstado('qualquer', 'u1', undefined)).toBeNull()
  })
})
