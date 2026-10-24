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

describe('verificarEnv: conta na nuvem (Supabase)', () => {
  const REF = 'abcdefghijklmnopqrst' // referência de projeto: 20 letras e números
  const URL = `https://${REF}.supabase.co`
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  /** Chave no formato antigo do Supabase: três partes (cabeçalho.dados.assinatura). */
  const jwt = (dados: object) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: 'supabase', ...dados })}.${'a'.repeat(43)}`
  const secreta = (ref = REF) => jwt({ ref, role: 'service_role' })
  const publica = (ref = REF) => jwt({ ref, role: 'anon' })
  const com = (url: string | undefined, chave: string | undefined) => ({ ...OK(), NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: chave } as Record<string, string | undefined>)

  it('sem nenhuma das duas é só um aviso: o app funciona só com o aparelho', () => {
    const r = verificarEnv(OK())
    expect(r.ok).toBe(true)
    expect(r.avisos.join(' ')).toContain('SUPABASE_SERVICE_ROLE_KEY')
  })

  it('URL e chave secreta bem formadas e do mesmo projeto: aceita, sem aviso', () => {
    const r = verificarEnv(com(URL, secreta()))
    expect(r.ok).toBe(true)
    expect([...r.erros, ...r.avisos].join(' ')).not.toContain('SUPABASE')
  })

  it('aceita a chave secreta no formato novo (sb_secret_...)', () => {
    expect(verificarEnv(com(URL, 'sb_secret_' + 'A1b2'.repeat(10))).ok).toBe(true)
  })

  it('só a URL, ou só a chave: erro, porque sozinhas não servem para nada', () => {
    expect(verificarEnv(com(URL, undefined)).erros.join(' ')).toContain('SUPABASE_SERVICE_ROLE_KEY')
    expect(verificarEnv(com(undefined, secreta())).erros.join(' ')).toContain('NEXT_PUBLIC_SUPABASE_URL')
  })

  it.each([
    ['uma letra a menos (19 em vez de 20)', 'https://abcdefghijklmnopqrs.supabase.co'],
    ['sem https', `http://${REF}.supabase.co`],
    ['com caminho no fim', `${URL}/rest/v1`],
    ['com maiúsculas', `https://${REF.toUpperCase()}.supabase.co`],
    ['de outro serviço', `https://${REF}.exemplo.com`],
    ['com aspas coladas', `"${URL}"`],
  ])('URL %s: erro', (_nome, url) => {
    const r = verificarEnv(com(url, secreta()))
    expect(r.ok).toBe(false)
    expect(r.erros.join(' ')).toContain('NEXT_PUBLIC_SUPABASE_URL')
  })

  it('a chave pública (anon) no lugar da secreta: erro explicando a troca', () => {
    const r = verificarEnv(com(URL, publica()))
    expect(r.ok).toBe(false)
    expect(r.erros.join(' ')).toMatch(/anon|pública/)
  })

  it('a chave publicável do formato novo no lugar da secreta: erro', () => {
    expect(verificarEnv(com(URL, 'sb_publishable_' + 'a'.repeat(30))).ok).toBe(false)
  })

  it('chave de outro projeto (a referência não bate com a URL): erro', () => {
    const r = verificarEnv(com(URL, secreta('zyxwvutsrqponmlkjihg')))
    expect(r.ok).toBe(false)
    expect(r.erros.join(' ')).toMatch(/outro projeto|não bate/)
  })

  it.each([
    ['cortada (só duas partes)', jwt({ ref: REF, role: 'service_role' }).split('.').slice(0, 2).join('.')],
    ['terminada em reticências', secreta().slice(0, 60) + '...'],
    ['com espaço no meio', secreta().slice(0, 30) + ' ' + secreta().slice(30)],
    ['com aspas coladas', `"${secreta()}"`],
    ['sem o formato de chave', 'x'.repeat(40)],
    ['partes que não são JSON', 'abc.def.ghi'],
  ])('chave %s: erro', (_nome, chave) => {
    const r = verificarEnv(com(URL, chave))
    expect(r.ok).toBe(false)
    expect(r.erros.join(' ')).toContain('SUPABASE_SERVICE_ROLE_KEY')
  })

  it('nunca mostra o valor da chave nem da URL nas mensagens', () => {
    const chave = publica() // formato certo, papel errado: gera erro com a chave em mãos
    const r = verificarEnv(com(URL, chave))
    const texto = [...r.erros, ...r.avisos].join(' | ')
    expect(texto).not.toContain(chave)
    expect(texto).not.toContain(chave.split('.')[1])
    expect(texto).not.toContain(REF)
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

describe('verificarEnv: métricas de produto (PostHog)', () => {
  const CHAVE = 'phc_' + 'A1b2C3d4'.repeat(5)
  const com = (chave: string | undefined, host?: string) => ({ ...OK(), NEXT_PUBLIC_POSTHOG_KEY: chave, NEXT_PUBLIC_POSTHOG_HOST: host } as Record<string, string | undefined>)

  it('sem chave é só um aviso: o app funciona e as métricas ficam desligadas', () => {
    const r = verificarEnv(OK())
    expect(r.ok).toBe(true)
    expect(r.avisos.join(' ')).toContain('NEXT_PUBLIC_POSTHOG_KEY')
  })

  it('chave do projeto (phc_) bem formada: aceita, sem aviso', () => {
    const r = verificarEnv(com(CHAVE))
    expect(r.ok).toBe(true)
    expect(r.avisos.join(' ')).not.toContain('NEXT_PUBLIC_POSTHOG_KEY')
  })

  it('chave com endereço dos Estados Unidos, da Europa ou próprio (https): aceita', () => {
    for (const host of ['https://us.i.posthog.com', 'https://eu.i.posthog.com', 'https://analytics.minhaempresa.com.br']) {
      expect(verificarEnv(com(CHAVE, host)).ok, host).toBe(true)
    }
  })

  it('a chave PESSOAL (phx_) é recusada: ela é secreta e esta variável vai para o navegador de todo mundo', () => {
    const r = verificarEnv(com('phx_' + 'A1b2C3d4'.repeat(5)))
    expect(r.ok).toBe(false)
    expect(r.erros.join(' ')).toMatch(/pessoal|secreta/)
  })

  it('a chave secreta do projeto (phs_) também é recusada', () => {
    expect(verificarEnv(com('phs_' + 'A1b2C3d4'.repeat(5))).ok).toBe(false)
  })

  it.each([
    ['sem prefixo', 'A1b2C3d4'.repeat(6)],
    ['curta demais', 'phc_abc'],
    ['com aspas coladas', `"${CHAVE}"`],
    ['com espaço no meio', CHAVE.slice(0, 20) + ' ' + CHAVE.slice(20)],
    ['com reticências', CHAVE.slice(0, 30) + '...'],
  ])('chave %s: erro', (_nome, chave) => {
    const r = verificarEnv(com(chave))
    expect(r.ok).toBe(false)
    expect(r.erros.join(' ')).toContain('NEXT_PUBLIC_POSTHOG_KEY')
  })

  it.each([
    ['sem https', 'http://us.i.posthog.com'],
    ['com caminho', 'https://us.i.posthog.com/capture'],
    ['com barra no fim', 'https://us.i.posthog.com/'],
    ['sem endereço', 'us.i.posthog.com'],
    ['com aspas', '"https://us.i.posthog.com"'],
  ])('endereço %s: erro', (_nome, host) => {
    const r = verificarEnv(com(CHAVE, host))
    expect(r.ok).toBe(false)
    expect(r.erros.join(' ')).toContain('NEXT_PUBLIC_POSTHOG_HOST')
  })

  it('nunca mostra o valor da chave nas mensagens', () => {
    const r = verificarEnv(com('phx_SEGREDINHO' + 'x'.repeat(20)))
    expect([...r.erros, ...r.avisos].join(' | ')).not.toContain('SEGREDINHO')
  })
})
