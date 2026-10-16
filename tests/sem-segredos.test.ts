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
