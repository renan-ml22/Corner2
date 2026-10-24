import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Chave secreta do Stripe no código vai parar no GitHub (que é público). Este teste barra isso.

const RAIZ = path.resolve(__dirname, '..')
const IGNORAR = new Set(['node_modules', '.next', '.git', 'playwright-report', 'test-results', 'coverage'])
const TEXTO = /\.(ts|tsx|js|mjs|cjs|json|md|css|html|yml|yaml|txt|env\.example)$/

function arquivos(dir: string, saida: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (IGNORAR.has(nome)) continue
    const caminho = path.join(dir, nome)
    if (statSync(caminho).isDirectory()) arquivos(caminho, saida)
    else if (TEXTO.test(nome) && !nome.startsWith('.env')) saida.push(caminho)
  }
  return saida
}

// sk_/rk_ (secretas e restritas) e whsec_ (assinatura de webhook), seguidas de texto de verdade.
const SEGREDO = /\b(?:sk|rk)_(?:test|live)_[A-Za-z0-9]{16,}|\bwhsec_[A-Za-z0-9]{16,}/

describe('segredos do Stripe fora do repositório', () => {
  const todos = arquivos(RAIZ)

  it('há arquivos para conferir', () => {
    expect(todos.length).toBeGreaterThan(50)
  })

  it('nenhum arquivo versionado contém chave secreta, restrita ou segredo de webhook', () => {
    const achados = todos.filter(f => SEGREDO.test(readFileSync(f, 'utf8'))).map(f => path.relative(RAIZ, f).replace(/\\/g, '/'))
    expect(achados).toEqual([])
  })

  it('o detector reconhece uma chave de verdade (e ignora o prefixo sozinho)', () => {
    expect(SEGREDO.test('sk_live_' + 'a'.repeat(24))).toBe(true)
    expect(SEGREDO.test('rk_test_' + 'B1'.repeat(12))).toBe(true)
    expect(SEGREDO.test('whsec_' + 'x'.repeat(24))).toBe(true)
    expect(SEGREDO.test('começa com sk_test_ e termina')).toBe(false)
    expect(SEGREDO.test('STRIPE_SECRET_KEY=sk_test_...')).toBe(false)
  })

  it('.env.local está no .gitignore', () => {
    expect(readFileSync(path.join(RAIZ, '.gitignore'), 'utf8')).toMatch(/^\.env\*?$/m)
  })

  it('a chave publicável pode aparecer, a secreta nunca: nenhum arquivo do navegador lê STRIPE_SECRET_KEY', () => {
    const doNavegador = todos.filter(f => /\.(tsx|ts)$/.test(f) && /^['"]use client['"]/.test(readFileSync(f, 'utf8').trimStart()))
    const vazando = doNavegador.filter(f => readFileSync(f, 'utf8').includes('STRIPE_SECRET_KEY')).map(f => path.relative(RAIZ, f))
    expect(vazando).toEqual([])
  })
})

// Supabase: a chave pública (anon / publishable) é feita para ficar visível, a secreta (service_role) ignora todas as
// regras do banco e nunca pode ir para o GitHub nem para o navegador.

const B64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
const JWT = (dados: object) => `${B64({ alg: 'HS256', typ: 'JWT' })}.${B64(dados)}.${'a'.repeat(43)}`

/** Chave secreta do Supabase no formato novo (sb_secret_...) ou no antigo (JWT com o papel service_role). */
function achaSegredoDoSupabase(texto: string): boolean {
  if (/\bsb_secret_[A-Za-z0-9_-]{20,}/.test(texto)) return true
  for (const [jwt] of texto.matchAll(/\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{20,}/g)) {
    try {
      if (JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).role === 'service_role') return true
    } catch { /* não é um JWT de verdade */ }
  }
  return false
}

describe('segredos do Supabase fora do repositório', () => {
  const todos = arquivos(RAIZ)

  it('nenhum arquivo versionado contém a chave secreta do Supabase', () => {
    const achados = todos.filter(f => achaSegredoDoSupabase(readFileSync(f, 'utf8'))).map(f => path.relative(RAIZ, f).replace(/\\/g, '/'))
    expect(achados).toEqual([])
  })

  it('o detector reconhece as duas formas da chave secreta e ignora a pública e o prefixo sozinho', () => {
    expect(achaSegredoDoSupabase('SUPABASE_SERVICE_ROLE_KEY=sb_secret_' + 'A1b2'.repeat(8))).toBe(true)
    expect(achaSegredoDoSupabase(`chave: ${JWT({ iss: 'supabase', ref: 'abcdefghijklmnopqrst', role: 'service_role' })}`)).toBe(true)
    expect(achaSegredoDoSupabase(JWT({ iss: 'supabase', ref: 'abcdefghijklmnopqrst', role: 'anon' }))).toBe(false) // a pública pode aparecer
    expect(achaSegredoDoSupabase('sb_publishable_' + 'a'.repeat(30))).toBe(false)
    expect(achaSegredoDoSupabase('começa com sb_secret_ e termina')).toBe(false)
    expect(achaSegredoDoSupabase('eyJabcdefgh.eyJabcdefgh.' + 'a'.repeat(30))).toBe(false) // parece JWT, mas os dados não são JSON
  })

  it('nenhum arquivo do navegador lê SUPABASE_SERVICE_ROLE_KEY, e o cliente do Supabase só existe no servidor', () => {
    const doNavegador = todos.filter(f => /\.(tsx|ts)$/.test(f) && /^['"]use client['"]/.test(readFileSync(f, 'utf8').trimStart()))
    const vazando = doNavegador.filter(f => readFileSync(f, 'utf8').includes('SUPABASE_SERVICE_ROLE_KEY')).map(f => path.relative(RAIZ, f))
    expect(vazando).toEqual([])
    for (const arquivo of ['lib/supabase.ts', 'lib/dados/servidor/banco-supabase.ts']) {
      expect(readFileSync(path.join(RAIZ, arquivo), 'utf8').trimStart(), arquivo).toMatch(/^import ['"]server-only['"]/)
    }
  })

  it('nenhum arquivo do navegador importa o cliente do Supabase', () => {
    const doNavegador = todos.filter(f => /\.(tsx|ts)$/.test(f) && /^['"]use client['"]/.test(readFileSync(f, 'utf8').trimStart()))
    const importando = doNavegador.filter(f => /@supabase\/supabase-js|@\/lib\/supabase['"]|servidor\/banco-supabase/.test(readFileSync(f, 'utf8'))).map(f => path.relative(RAIZ, f))
    expect(importando).toEqual([])
  })
})

// PostHog: a chave do PROJETO (phc_) é pública e vai no navegador; a pessoal (phx_) e a secreta do projeto (phs_) dão
// acesso à conta e nunca podem ir para o GitHub.

const SEGREDO_POSTHOG = /\bph[xs]_[A-Za-z0-9]{20,}/

describe('segredos do PostHog fora do repositório', () => {
  const todos = arquivos(RAIZ)

  it('nenhum arquivo versionado contém chave pessoal (phx_) nem secreta (phs_) do PostHog', () => {
    const achados = todos.filter(f => SEGREDO_POSTHOG.test(readFileSync(f, 'utf8'))).map(f => path.relative(RAIZ, f).replace(/\\/g, '/'))
    expect(achados).toEqual([])
  })

  it('o detector reconhece as duas e ignora a chave pública e o prefixo sozinho', () => {
    expect(SEGREDO_POSTHOG.test('phx_' + 'a1B2'.repeat(8))).toBe(true)
    expect(SEGREDO_POSTHOG.test('phs_' + 'a1B2'.repeat(8))).toBe(true)
    expect(SEGREDO_POSTHOG.test('phc_' + 'a1B2'.repeat(8))).toBe(false) // a do projeto é pública
    expect(SEGREDO_POSTHOG.test('começa com phx_ e termina')).toBe(false)
  })
})
