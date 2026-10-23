import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { ErroConta, criarConta, entrarNoSupabase, type AuthLike } from '@/lib/contas'

type Resposta = { data: { user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null } | null }; error: { message: string; code?: string; status?: number } | null }

/** Supabase Auth de mentira: guarda os usuários em memória e responde como o de verdade. */
class AuthFalso implements AuthLike {
  usuarios = new Map<string, { id: string; email: string; senha: string; nome: string }>()
  chamadasDeCriar: unknown[] = []
  falhar: { message: string; code?: string; status?: number } | null = null
  sem_usuario = false
  proximoId = 1

  admin = {
    createUser: async (atributos: { email: string; password: string; email_confirm: boolean; user_metadata: { name: string } }): Promise<Resposta> => {
      this.chamadasDeCriar.push(atributos)
      if (this.falhar) return { data: { user: null }, error: this.falhar }
      if (this.sem_usuario) return { data: { user: null }, error: null }
      if (this.usuarios.has(atributos.email)) return { data: { user: null }, error: { message: 'A user with this email address has already been registered', code: 'email_exists', status: 422 } }
      const id = `00000000-0000-4000-8000-${String(this.proximoId++).padStart(12, '0')}`
      this.usuarios.set(atributos.email, { id, email: atributos.email, senha: atributos.password, nome: atributos.user_metadata.name })
      return { data: { user: { id, email: atributos.email, user_metadata: { name: atributos.user_metadata.name } } }, error: null }
    },
  }

  async signInWithPassword({ email, password }: { email: string; password: string }): Promise<Resposta> {
    if (this.falhar) return { data: { user: null }, error: this.falhar }
    const u = this.usuarios.get(email)
    if (!u || u.senha !== password) return { data: { user: null }, error: { message: 'Invalid login credentials', code: 'invalid_credentials', status: 400 } }
    return { data: { user: { id: u.id, email: u.email, user_metadata: { name: u.nome } } }, error: null }
  }
}

const cadastro = { nome: 'Renan Lopes', email: 'renan@exemplo.com', senha: 'senha-forte-123' }

afterEach(() => vi.restoreAllMocks())

describe('criarConta', () => {
  it('cria o usuário no Supabase Auth já confirmado (sem e-mail de confirmação) e devolve o usuário do app', async () => {
    const auth = new AuthFalso()
    const usuario = await criarConta(auth, cadastro)
    expect(usuario).toEqual({ id: expect.stringMatching(/^[0-9a-f-]{36}$/), email: 'renan@exemplo.com', name: 'Renan Lopes' })
    expect(auth.chamadasDeCriar).toEqual([{ email: 'renan@exemplo.com', password: 'senha-forte-123', email_confirm: true, user_metadata: { name: 'Renan Lopes' } }])
  })

  it('o e-mail já cadastrado é recusado com uma mensagem clara (409), sem criar outro usuário', async () => {
    const auth = new AuthFalso()
    await criarConta(auth, cadastro)
    const erro = await criarConta(auth, { ...cadastro, nome: 'Outra Pessoa' }).catch(e => e)
    expect(erro).toBeInstanceOf(ErroConta)
    expect(erro).toMatchObject({ codigo: 'email_ja_cadastrado', status: 409 })
    expect(erro.message).toMatch(/já tem uma conta/)
    expect(auth.usuarios.size).toBe(1)
  })

  it('e-mails reservados (o usuário de teste do app) são recusados sem nem falar com o Supabase', async () => {
    const auth = new AuthFalso()
    const erro = await criarConta(auth, { ...cadastro, email: 'teste@corner.com' }, { emailsReservados: ['teste@corner.com'] }).catch(e => e)
    expect(erro).toMatchObject({ codigo: 'email_ja_cadastrado', status: 409 })
    expect(auth.chamadasDeCriar).toEqual([])
  })

  it('qualquer outro erro do Supabase vira um 502 genérico: sem detalhes do serviço na mensagem e sem a senha no log', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const auth = new AuthFalso()
    auth.falhar = { message: 'DB connection pool exhausted for user renan@exemplo.com', status: 500 }
    const erro = await criarConta(auth, cadastro).catch(e => e)
    expect(erro).toMatchObject({ codigo: 'falha_ao_criar', status: 502 })
    expect(erro.message).not.toMatch(/pool|renan@/)
    expect(JSON.stringify(log.mock.calls)).not.toContain('senha-forte-123')
  })

  it('resposta sem erro e sem usuário também é falha, não um usuário vazio', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const auth = new AuthFalso()
    auth.sem_usuario = true
    await expect(criarConta(auth, cadastro)).rejects.toMatchObject({ codigo: 'falha_ao_criar' })
  })

  it('exceção de rede também vira falha controlada', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const auth = new AuthFalso()
    auth.admin.createUser = async () => { throw new TypeError('fetch failed') }
    await expect(criarConta(auth, cadastro)).rejects.toMatchObject({ codigo: 'falha_ao_criar', status: 502 })
  })

  it('usuário sem nome nos metadados volta com o nome que a pessoa digitou', async () => {
    const auth = new AuthFalso()
    auth.admin.createUser = async () => ({ data: { user: { id: '11111111-1111-4111-8111-111111111111', email: 'renan@exemplo.com', user_metadata: null } }, error: null })
    expect((await criarConta(auth, cadastro)).name).toBe('Renan Lopes')
  })
})

describe('entrarNoSupabase', () => {
  it('e-mail e senha certos: devolve o usuário do app', async () => {
    const auth = new AuthFalso()
    const criado = await criarConta(auth, cadastro)
    expect(await entrarNoSupabase(auth, 'renan@exemplo.com', 'senha-forte-123')).toEqual(criado)
  })

  it('senha errada e e-mail desconhecido: null, e a resposta é a mesma nos dois casos', async () => {
    const auth = new AuthFalso()
    await criarConta(auth, cadastro)
    expect(await entrarNoSupabase(auth, 'renan@exemplo.com', 'errada')).toBeNull()
    expect(await entrarNoSupabase(auth, 'ninguem@exemplo.com', 'qualquer-coisa')).toBeNull()
  })

  it('serviço fora do ar NÃO vira "senha incorreta": sobe como erro de indisponibilidade', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const auth = new AuthFalso()
    auth.falhar = { message: 'upstream down', status: 503 }
    await expect(entrarNoSupabase(auth, 'renan@exemplo.com', 'senha-forte-123')).rejects.toMatchObject({ codigo: 'indisponivel', status: 503 })
  })

  it('exceção de rede também sobe como indisponibilidade', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const auth = new AuthFalso()
    auth.signInWithPassword = async () => { throw new TypeError('fetch failed') }
    await expect(entrarNoSupabase(auth, 'renan@exemplo.com', 'x')).rejects.toMatchObject({ codigo: 'indisponivel' })
  })

  it('sem nome nos metadados, usa a parte do e-mail antes do arroba', async () => {
    const auth = new AuthFalso()
    auth.signInWithPassword = async () => ({ data: { user: { id: '11111111-1111-4111-8111-111111111111', email: 'renan@exemplo.com', user_metadata: {} } }, error: null })
    expect((await entrarNoSupabase(auth, 'renan@exemplo.com', 'x'))?.name).toBe('renan')
  })
})
