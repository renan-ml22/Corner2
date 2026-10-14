import { randomBytes, scryptSync } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { getUserById, verifyCredentials } from '@/lib/users'

// Mesmo formato do módulo: "salt:hash", ambos em base64url, scrypt com keylen 64.
function gerarHash(senha: string) {
  const salt = randomBytes(16)
  const hash = scryptSync(senha, salt, 64)
  return `${salt.toString('base64url')}:${hash.toString('base64url')}`
}

const EMAIL = 'atleta@exemplo.com'
const SENHA = 'senha-de-teste-123'

function configurarEnv(opcoes: { email?: string; nome?: string; hash?: string } = {}) {
  vi.stubEnv('AUTH_TEST_EMAIL', opcoes.email ?? EMAIL)
  vi.stubEnv('AUTH_TEST_PASSWORD_HASH', opcoes.hash ?? gerarHash(SENHA))
  if (opcoes.nome !== undefined) vi.stubEnv('AUTH_TEST_NAME', opcoes.nome)
  else vi.stubEnv('AUTH_TEST_NAME', 'Maria Teste')
}

let erroSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  erroSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('verifyCredentials', () => {
  it('retorna o usuário quando e-mail e senha estão corretos', async () => {
    configurarEnv()
    const user = await verifyCredentials(EMAIL, SENHA)
    expect(user).toEqual({ id: 'u_test', email: EMAIL, name: 'Maria Teste' })
    expect(erroSpy).not.toHaveBeenCalled()
  })

  it('aceita e-mail digitado com maiúsculas e espaços nas pontas', async () => {
    configurarEnv()
    const user = await verifyCredentials('  Atleta@EXEMPLO.com  ', SENHA)
    expect(user?.email).toBe(EMAIL)
  })

  it('normaliza o e-mail configurado no ambiente (maiúsculas e espaços)', async () => {
    configurarEnv({ email: '  ATLETA@Exemplo.COM ' })
    const user = await verifyCredentials(EMAIL, SENHA)
    expect(user?.email).toBe(EMAIL)
  })

  it('retorna null com senha errada', async () => {
    configurarEnv()
    expect(await verifyCredentials(EMAIL, 'senha-errada')).toBeNull()
  })

  it('distingue senhas que só diferem em maiúsculas/minúsculas', async () => {
    configurarEnv()
    expect(await verifyCredentials(EMAIL, SENHA.toUpperCase())).toBeNull()
  })

  it('retorna null com senha vazia', async () => {
    configurarEnv()
    expect(await verifyCredentials(EMAIL, '')).toBeNull()
  })

  it('retorna null com e-mail inexistente', async () => {
    configurarEnv()
    expect(await verifyCredentials('outro@exemplo.com', SENHA)).toBeNull()
  })

  it('retorna null com e-mail vazio', async () => {
    configurarEnv()
    expect(await verifyCredentials('', SENHA)).toBeNull()
  })

  it('retorna null e registra console.error quando as variáveis de ambiente estão ausentes', async () => {
    vi.stubEnv('AUTH_TEST_EMAIL', '')
    vi.stubEnv('AUTH_TEST_PASSWORD_HASH', '')
    expect(await verifyCredentials(EMAIL, SENHA)).toBeNull()
    expect(erroSpy).toHaveBeenCalledTimes(1)
    expect(String(erroSpy.mock.calls[0][0])).toContain('[auth]')
  })

  it('retorna null e registra erro quando só o hash está ausente', async () => {
    vi.stubEnv('AUTH_TEST_EMAIL', EMAIL)
    vi.stubEnv('AUTH_TEST_PASSWORD_HASH', '')
    expect(await verifyCredentials(EMAIL, SENHA)).toBeNull()
    expect(erroSpy).toHaveBeenCalled()
  })

  it('retorna null e registra erro quando só o e-mail está ausente', async () => {
    vi.stubEnv('AUTH_TEST_EMAIL', '')
    vi.stubEnv('AUTH_TEST_PASSWORD_HASH', gerarHash(SENHA))
    expect(await verifyCredentials(EMAIL, SENHA)).toBeNull()
    expect(erroSpy).toHaveBeenCalled()
  })

  it('lê o ambiente a cada chamada (sem cache entre chamadas)', async () => {
    configurarEnv()
    expect(await verifyCredentials(EMAIL, SENHA)).not.toBeNull()
    vi.stubEnv('AUTH_TEST_PASSWORD_HASH', gerarHash('nova-senha'))
    expect(await verifyCredentials(EMAIL, SENHA)).toBeNull()
    expect(await verifyCredentials(EMAIL, 'nova-senha')).not.toBeNull()
  })

  describe('hash malformado', () => {
    it.each([
      ['sem dois-pontos', 'semdoispontos'],
      ['salt vazio', ':abcdef'],
      ['hash vazio', 'abcdef:'],
      ['só dois-pontos', ':'],
      ['caracteres fora do base64url', '!!!:@@@'],
    ])('retorna null sem lançar quando o hash é %s', async (_rotulo, hash) => {
      configurarEnv({ hash })
      await expect(verifyCredentials(EMAIL, SENHA)).resolves.toBeNull()
    })

    it('retorna null sem lançar quando o hash é vazio (tratado como env ausente)', async () => {
      vi.stubEnv('AUTH_TEST_EMAIL', EMAIL)
      vi.stubEnv('AUTH_TEST_PASSWORD_HASH', '')
      await expect(verifyCredentials(EMAIL, SENHA)).resolves.toBeNull()
      expect(erroSpy).toHaveBeenCalled()
    })

    it('aceita hashes com keylen diferente de 64 (keylen acompanha o hash armazenado)', async () => {
      const salt = randomBytes(16)
      const hash32 = scryptSync(SENHA, salt, 32)
      configurarEnv({ hash: `${salt.toString('base64url')}:${hash32.toString('base64url')}` })
      expect(await verifyCredentials(EMAIL, SENHA)).not.toBeNull()
      expect(await verifyCredentials(EMAIL, 'errada')).toBeNull()
    })

    it('rejeita senha cujo hash usa outro salt (hash válido de outro salt)', async () => {
      const hash = scryptSync(SENHA, randomBytes(16), 64).toString('base64url')
      const saltDiferente = randomBytes(16).toString('base64url')
      configurarEnv({ hash: `${saltDiferente}:${hash}` })
      expect(await verifyCredentials(EMAIL, SENHA)).toBeNull()
    })
  })

  it('nunca expõe passwordHash no resultado', async () => {
    const hash = gerarHash(SENHA)
    configurarEnv({ hash })
    const user = await verifyCredentials(EMAIL, SENHA)
    expect(user).not.toBeNull()
    expect(Object.keys(user!).sort()).toEqual(['email', 'id', 'name'])
    expect(user).not.toHaveProperty('passwordHash')
    expect(JSON.stringify(user)).not.toContain(hash)
  })
})

describe('nome padrão', () => {
  it("usa 'Atleta' quando AUTH_TEST_NAME está ausente", async () => {
    vi.stubEnv('AUTH_TEST_EMAIL', EMAIL)
    vi.stubEnv('AUTH_TEST_PASSWORD_HASH', gerarHash(SENHA))
    vi.stubEnv('AUTH_TEST_NAME', '')
    const user = await verifyCredentials(EMAIL, SENHA)
    expect(user?.name).toBe('Atleta')
    expect(getUserById('u_test')?.name).toBe('Atleta')
  })

  it('usa AUTH_TEST_NAME quando definido', async () => {
    configurarEnv({ nome: 'Zé do Soco' })
    expect(getUserById('u_test')?.name).toBe('Zé do Soco')
  })
})

describe('getUserById', () => {
  it('retorna o usuário para um id existente', () => {
    configurarEnv()
    expect(getUserById('u_test')).toEqual({ id: 'u_test', email: EMAIL, name: 'Maria Teste' })
  })

  it('retorna null para um id inexistente', () => {
    configurarEnv()
    expect(getUserById('u_outro')).toBeNull()
    expect(getUserById('')).toBeNull()
  })

  it('retorna null e registra erro quando o ambiente não está configurado', () => {
    vi.stubEnv('AUTH_TEST_EMAIL', '')
    vi.stubEnv('AUTH_TEST_PASSWORD_HASH', '')
    expect(getUserById('u_test')).toBeNull()
    expect(erroSpy).toHaveBeenCalledTimes(1)
  })

  it('nunca expõe passwordHash no resultado', () => {
    const hash = gerarHash(SENHA)
    configurarEnv({ hash })
    const user = getUserById('u_test')
    expect(Object.keys(user!).sort()).toEqual(['email', 'id', 'name'])
    expect(JSON.stringify(user)).not.toContain(hash)
  })
})
