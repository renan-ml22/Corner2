import { afterEach, describe, expect, it, vi } from 'vitest'
import { novoId } from '@/lib/id'

afterEach(() => vi.unstubAllGlobals())

describe('novoId', () => {
  it('gera ids de texto, não vazios e diferentes a cada chamada', () => {
    const ids = new Set(Array.from({ length: 200 }, () => novoId()))
    expect(ids.size).toBe(200)
    for (const id of ids) expect(id.length).toBeGreaterThan(5)
  })

  it('usa crypto.randomUUID quando existe (contexto seguro)', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-fixo' })
    expect(novoId()).toBe('uuid-fixo')
  })

  it('sem crypto.randomUUID (http na rede local), cai num id próprio, ainda único', () => {
    vi.stubGlobal('crypto', {})
    const ids = new Set(Array.from({ length: 200 }, () => novoId()))
    expect(ids.size).toBe(200)
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]+$/)
  })

  it('sem o objeto crypto, também funciona', () => {
    vi.stubGlobal('crypto', undefined)
    expect(novoId()).toMatch(/^[a-z0-9]+-[a-z0-9]+$/)
  })
})
