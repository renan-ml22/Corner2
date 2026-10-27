import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  COOKIE_DO_CONVITE, VALIDADE_DO_CONVITE_DIAS, VALIDADE_DO_COOKIE_SEGUNDOS, diaMes, ehTokenDeConvite, expiraEm, linkDoConvite,
} from '@/lib/cornerman/convite'
import { hashDoToken, novoToken } from '@/lib/cornerman/convite-token'

// O token do convite: formato, validade, link e o par token/hash. Só o hash vai para o banco.

const TOKEN = 'A'.repeat(43)

describe('constantes', () => {
  it('14 dias de validade; cookie "corner_convite" de 1 hora', () => {
    expect(VALIDADE_DO_CONVITE_DIAS).toBe(14)
    expect(COOKIE_DO_CONVITE).toBe('corner_convite')
    expect(VALIDADE_DO_COOKIE_SEGUNDOS).toBe(3600)
  })
})

describe('ehTokenDeConvite', () => {
  it('aceita 43 caracteres base64url (32 bytes)', () => {
    expect(ehTokenDeConvite(TOKEN)).toBe(true)
    expect(ehTokenDeConvite('aB3-_xYz'.repeat(5) + 'abc')).toBe(true)
  })

  it.each([
    ['42 caracteres', 'A'.repeat(42)],
    ['44 caracteres', 'A'.repeat(44)],
    ['com barra', `${'A'.repeat(42)}/`],
    ['com mais', `${'A'.repeat(42)}+`],
    ['com igual', `${'A'.repeat(42)}=`],
    ['com espaço', `${'A'.repeat(42)} `],
    ['com quebra de linha no fim', `${TOKEN}\n`],
    ['caminho relativo', '../x'],
    ['endereço', 'https://mau.com'],
    ['dupla barra', '//mau.com'],
    ['vazio', ''],
    ['null', null],
    ['número', 42],
    ['lista', [TOKEN]],
  ])('recusa %s', (_nome, v) => {
    expect(ehTokenDeConvite(v)).toBe(false)
  })
})

describe('expiraEm e linkDoConvite', () => {
  it('14 dias depois, em ISO', () => {
    expect(expiraEm(new Date('2026-10-27T12:00:00.000Z'))).toBe('2026-11-10T12:00:00.000Z')
  })

  it('o link é o endereço do site, /convite/ e o token', () => {
    expect(linkDoConvite('https://corner2.vercel.app', TOKEN)).toBe(`https://corner2.vercel.app/convite/${TOKEN}`)
  })
})

describe('diaMes', () => {
  it('dia e mês com dois dígitos', () => {
    expect(diaMes('2026-10-28T12:00:00.000Z')).toBe('28/10')
    expect(diaMes('2026-01-05T12:00:00.000Z')).toBe('05/01')
  })
  it('data inválida: texto vazio, sem lançar erro', () => {
    expect(diaMes('não é data')).toBe('')
    expect(diaMes('')).toBe('')
  })
})

describe('novoToken e hashDoToken', () => {
  it('o token passa no formato e o hash é o SHA-256 em hex minúsculo (64 caracteres)', () => {
    const { token, hash } = novoToken()
    expect(ehTokenDeConvite(token)).toBe(true)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hash).toBe(createHash('sha256').update(token).digest('hex'))
  })

  it('100 tokens, 100 diferentes (e 100 hashes diferentes)', () => {
    const lote = Array.from({ length: 100 }, () => novoToken())
    expect(new Set(lote.map(t => t.token)).size).toBe(100)
    expect(new Set(lote.map(t => t.hash)).size).toBe(100)
  })

  it('hashDoToken é determinístico, e o hash nunca contém o token', () => {
    const { token, hash } = novoToken()
    expect(hashDoToken(token)).toBe(hash)
    expect(hashDoToken(token)).toBe(hashDoToken(token))
    expect(hash).not.toContain(token)
    expect(hashDoToken(`${token}x`)).not.toBe(hash)
  })
})
