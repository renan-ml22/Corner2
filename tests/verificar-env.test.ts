import { describe, it, expect } from 'vitest'
import { randomBytes, scryptSync } from 'node:crypto'
import { verificarEnv, lerArquivoEnv } from '../scripts/verificar-env.mjs'

function hashValido(): string {
  const sal = randomBytes(16)
  return `${sal.toString('base64url')}:${scryptSync('qualquer', sal, 64).toString('base64url')}`
}

const OK = () => ({
  SESSION_SECRET: randomBytes(48).toString('base64url'),
  AUTH_TEST_EMAIL: 'atleta@exemplo.com',
  AUTH_TEST_NAME: 'Atleta',
  AUTH_TEST_PASSWORD_HASH: hashValido(),
})

describe('verificarEnv', () => {
  it('aceita a configuração completa e válida', () => {
    const r = verificarEnv(OK())
    expect(r.ok).toBe(true)
    expect(r.erros).toEqual([])
  })

  it.each(['SESSION_SECRET', 'AUTH_TEST_EMAIL', 'AUTH_TEST_PASSWORD_HASH'])('falha quando %s está ausente', nome => {
    const env: Record<string, string> = OK()
    delete env[nome]
    const r = verificarEnv(env)
    expect(r.ok).toBe(false)
    expect(r.erros.join(' ')).toContain(nome)
  })

  it('trata variável vazia ou só com espaços como ausente', () => {
    expect(verificarEnv({ ...OK(), SESSION_SECRET: '   ' }).ok).toBe(false)
    expect(verificarEnv({ ...OK(), AUTH_TEST_EMAIL: '' }).ok).toBe(false)
  })

  it('exige SESSION_SECRET com pelo menos 32 caracteres', () => {
    expect(verificarEnv({ ...OK(), SESSION_SECRET: 'curta' }).ok).toBe(false)
    expect(verificarEnv({ ...OK(), SESSION_SECRET: 'x'.repeat(32) }).ok).toBe(true)
  })

  it('exige e-mail com arroba', () => {
    expect(verificarEnv({ ...OK(), AUTH_TEST_EMAIL: 'sem-arroba' }).ok).toBe(false)
  })

  it.each([
    ['sem dois pontos', 'abcdef'],
    ['partes vazias', ':'],
    ['caracteres inválidos', 'abc def:ghi jkl'],
  ])('rejeita hash malformado (%s)', (_nome, hash) => {
    expect(verificarEnv({ ...OK(), AUTH_TEST_PASSWORD_HASH: hash }).ok).toBe(false)
  })

  it('rejeita hash curto, que enfraqueceria a verificação da senha', () => {
    const sal = randomBytes(16)
    const curto = `${sal.toString('base64url')}:${scryptSync('x', sal, 16).toString('base64url')}`
    const r = verificarEnv({ ...OK(), AUTH_TEST_PASSWORD_HASH: curto })
    expect(r.ok).toBe(false)
    expect(r.erros.join(' ')).toMatch(/curto|32 bytes/)
  })

  it('AUTH_TEST_NAME ausente é só um aviso: o app usa "Atleta"', () => {
    const env: Record<string, string> = OK()
    delete env.AUTH_TEST_NAME
    const r = verificarEnv(env)
    expect(r.ok).toBe(true)
    expect(r.avisos.join(' ')).toContain('AUTH_TEST_NAME')
  })

  it('nunca inclui o valor das variáveis nas mensagens', () => {
    const env = { ...OK(), SESSION_SECRET: 'segredo-curto-demais', AUTH_TEST_PASSWORD_HASH: 'valor-secreto:xyz' }
    const r = verificarEnv(env)
    const texto = [...r.erros, ...r.avisos].join('\n')
    expect(texto).not.toContain('segredo-curto-demais')
    expect(texto).not.toContain('valor-secreto')
  })
})

describe('verificarEnv: pagamento (Stripe)', () => {
  it('sem chave do Stripe é só um aviso: o app funciona, o pagamento fica desativado', () => {
    const r = verificarEnv(OK())
    expect(r.ok).toBe(true)
    expect(r.avisos.join(' ')).toContain('STRIPE_SECRET_KEY')
  })

  it.each(['sk_test_' + 'a'.repeat(30), 'sk_live_' + 'B1'.repeat(15), 'rk_test_' + 'c'.repeat(30)])('aceita uma chave bem formada', chave => {
    const r = verificarEnv({ ...OK(), STRIPE_SECRET_KEY: chave })
    expect(r.ok).toBe(true)
    expect(r.avisos.join(' ')).not.toContain('STRIPE_SECRET_KEY')
  })

  it.each([
    ['chave publicável no lugar da secreta', 'pk_test_' + 'a'.repeat(30)],
    ['sem prefixo', 'a'.repeat(40)],
    ['curta demais', 'sk_test_abc'],
    ['com aspas coladas junto', '"sk_test_' + 'a'.repeat(30) + '"'],
  ])('recusa %s', (_nome, chave) => {
    const r = verificarEnv({ ...OK(), STRIPE_SECRET_KEY: chave })
    expect(r.ok).toBe(false)
    expect(r.erros.join(' ')).toContain('STRIPE_SECRET_KEY')
  })

  it('chave publicável com formato errado: erro', () => {
    expect(verificarEnv({ ...OK(), STRIPE_PUBLISHABLE_KEY: 'sk_test_' + 'a'.repeat(30) }).ok).toBe(false)
    expect(verificarEnv({ ...OK(), STRIPE_PUBLISHABLE_KEY: 'pk_test_' + 'a'.repeat(30) }).ok).toBe(true)
  })

  it('nunca mostra o valor das chaves do Stripe nas mensagens', () => {
    const r = verificarEnv({ ...OK(), STRIPE_SECRET_KEY: 'pk_test_SEGREDINHO' + 'x'.repeat(20) })
    expect([...r.erros, ...r.avisos].join(' | ')).not.toContain('SEGREDINHO')
  })
})

describe('lerArquivoEnv', () => {
  it('lê CHAVE=valor, ignora comentários e linhas em branco, aceita CRLF', () => {
    const r = lerArquivoEnv('# comentário\r\nA=1\r\n\r\nB=dois=com=igual\r\n  # outro\r\nC=\r\n')
    expect(r).toEqual({ A: '1', B: 'dois=com=igual', C: '' })
  })

  it('remove aspas simples ou duplas ao redor do valor', () => {
    expect(lerArquivoEnv('A="x y"\nB=\'z\'')).toEqual({ A: 'x y', B: 'z' })
  })
})
