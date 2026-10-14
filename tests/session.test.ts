import { SignJWT, decodeJwt } from 'jose'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const cookieStore = { set: vi.fn(), delete: vi.fn() }
let cabecalhos: Record<string, string> = {}

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => cookieStore),
  headers: vi.fn(async () => new Headers(cabecalhos)),
}))

import { SESSION_COOKIE, createSession, decrypt, deleteSession, encrypt } from '@/lib/session'

const SEGREDO = 'segredo-falso-apenas-para-testes-0123456789'
const chave = (s: string) => new TextEncoder().encode(s)
const DIA_MS = 24 * 60 * 60 * 1000

beforeEach(() => {
  vi.stubEnv('SESSION_SECRET', SEGREDO)
  cabecalhos = {}
  cookieStore.set.mockClear()
  cookieStore.delete.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('encrypt / decrypt', () => {
  it('cria um token que volta com o mesmo userId e expiresAt', async () => {
    const expiresAt = new Date(Date.now() + 7 * DIA_MS).toISOString()
    const token = await encrypt({ userId: 'u_test', expiresAt })
    const payload = await decrypt(token)
    expect(payload?.userId).toBe('u_test')
    expect(payload?.expiresAt).toBe(expiresAt)
  })

  it('gera um JWT HS256 com iat e exp de 7 dias', async () => {
    const token = await encrypt({ userId: 'u_test', expiresAt: 'x' })
    expect(token.split('.')).toHaveLength(3)
    const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString())
    expect(header.alg).toBe('HS256')
    const { iat, exp } = decodeJwt(token)
    expect(exp! - iat!).toBe(7 * 24 * 60 * 60)
  })

  it('retorna null para token ausente ou vazio', async () => {
    expect(await decrypt(undefined)).toBeNull()
    expect(await decrypt('')).toBeNull()
  })

  it('retorna null para lixo que não é JWT', async () => {
    expect(await decrypt('isso-nao-e-um-jwt')).toBeNull()
    expect(await decrypt('a.b.c')).toBeNull()
  })

  it('retorna null para token com assinatura adulterada', async () => {
    const token = await encrypt({ userId: 'u_test', expiresAt: 'x' })
    const [h, p, s] = token.split('.')
    const sAdulterada = (s[0] === 'A' ? 'B' : 'A') + s.slice(1)
    expect(await decrypt(`${h}.${p}.${sAdulterada}`)).toBeNull()
  })

  it('retorna null para token com payload adulterado (troca de userId mantendo a assinatura)', async () => {
    const token = await encrypt({ userId: 'u_test', expiresAt: 'x' })
    const [h, p, s] = token.split('.')
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString())
    payload.userId = 'u_admin'
    const pAdulterado = Buffer.from(JSON.stringify(payload)).toString('base64url')
    expect(await decrypt(`${h}.${pAdulterado}.${s}`)).toBeNull()
  })

  it('retorna null para token assinado com outro segredo', async () => {
    const token = await new SignJWT({ userId: 'u_test', expiresAt: 'x' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(chave('outro-segredo-completamente-diferente-123456'))
    expect(await decrypt(token)).toBeNull()
  })

  it('retorna null quando o segredo muda depois da emissão do token', async () => {
    const token = await encrypt({ userId: 'u_test', expiresAt: 'x' })
    vi.stubEnv('SESSION_SECRET', 'segredo-rotacionado-0123456789abcdef')
    expect(await decrypt(token)).toBeNull()
  })

  it('rejeita algoritmo diferente de HS256 mesmo com o segredo correto', async () => {
    const token = await new SignJWT({ userId: 'u_test', expiresAt: 'x' })
      .setProtectedHeader({ alg: 'HS512' })
      .setExpirationTime('7d')
      .sign(chave(SEGREDO))
    expect(await decrypt(token)).toBeNull()
  })

  it('rejeita token sem assinatura (alg "none")', async () => {
    const h = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
    const p = Buffer.from(JSON.stringify({ userId: 'u_test', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')
    expect(await decrypt(`${h}.${p}.`)).toBeNull()
  })

  it('retorna null para token expirado (passados mais de 7 dias)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-01-01T12:00:00Z'))
    const token = await encrypt({ userId: 'u_test', expiresAt: 'x' })

    vi.setSystemTime(new Date('2026-01-08T11:59:00Z')) // ainda válido
    expect((await decrypt(token))?.userId).toBe('u_test')

    vi.setSystemTime(new Date('2026-01-08T12:00:01Z')) // expirou
    expect(await decrypt(token)).toBeNull()
  })

  it('retorna null para token expirado emitido por terceiros com o segredo correto', async () => {
    const token = await new SignJWT({ userId: 'u_test', expiresAt: 'x' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(chave(SEGREDO))
    expect(await decrypt(token)).toBeNull()
  })

  it('encrypt rejeita quando SESSION_SECRET está ausente', async () => {
    vi.stubEnv('SESSION_SECRET', '')
    await expect(encrypt({ userId: 'u_test', expiresAt: 'x' })).rejects.toThrow(/SESSION_SECRET/)
  })

  it('decrypt falha fechado (null, sem lançar) quando SESSION_SECRET está ausente', async () => {
    const token = await encrypt({ userId: 'u_test', expiresAt: 'x' })
    vi.stubEnv('SESSION_SECRET', '')
    await expect(decrypt(token)).resolves.toBeNull()
  })
})

describe('createSession', () => {
  it('grava o cookie com token válido e atributos de segurança', async () => {
    const antes = Date.now()
    await createSession('u_test')
    expect(cookieStore.set).toHaveBeenCalledTimes(1)
    const [nome, token, opcoes] = cookieStore.set.mock.calls[0]
    expect(nome).toBe(SESSION_COOKIE)
    expect(SESSION_COOKIE).toBe('corner_session')

    const payload = await decrypt(token)
    expect(payload?.userId).toBe('u_test')

    expect(opcoes.httpOnly).toBe(true)
    expect(opcoes.sameSite).toBe('lax')
    expect(opcoes.path).toBe('/')
    expect(opcoes.expires).toBeInstanceOf(Date)
    const duracao = opcoes.expires.getTime() - antes
    expect(duracao).toBeGreaterThanOrEqual(7 * DIA_MS)
    expect(duracao).toBeLessThan(7 * DIA_MS + 5000)
    // expiresAt do payload coincide com a expiração do cookie
    expect(payload?.expiresAt).toBe(opcoes.expires.toISOString())
  })

  describe('flag Secure conforme x-forwarded-proto', () => {
    it.each([
      ['https', true],
      ['http', false],
      ['https,http', true],
      ['http,https', false],
      [' https ', true],
      ['HTTPS', false], // comportamento atual: comparação sensível a maiúsculas
    ])('x-forwarded-proto=%j => secure=%s', async (proto, esperado) => {
      cabecalhos = { 'x-forwarded-proto': proto }
      await createSession('u_test')
      expect(cookieStore.set.mock.calls[0][2].secure).toBe(esperado)
    })

    it('sem o cabeçalho x-forwarded-proto o cookie não é Secure', async () => {
      await createSession('u_test')
      expect(cookieStore.set.mock.calls[0][2].secure).toBe(false)
    })
  })

  it('propaga erro quando SESSION_SECRET está ausente e não grava cookie', async () => {
    vi.stubEnv('SESSION_SECRET', '')
    await expect(createSession('u_test')).rejects.toThrow(/SESSION_SECRET/)
    expect(cookieStore.set).not.toHaveBeenCalled()
  })
})

describe('deleteSession', () => {
  it('apaga o cookie de sessão', async () => {
    await deleteSession()
    expect(cookieStore.delete).toHaveBeenCalledWith(SESSION_COOKIE)
  })
})
