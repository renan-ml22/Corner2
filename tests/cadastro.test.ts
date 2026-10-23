import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { cadastrar } from '@/lib/cadastro'

/** Cliente do Supabase de mentira com só o que o cadastro usa. */
function banco(resposta: { user?: { id: string; email: string; user_metadata: { name: string } } | null; error?: { message: string; code?: string; status?: number } | null } = {}) {
  const createUser = vi.fn(async () => ({
    data: { user: resposta.user === undefined ? { id: '3f2b8c1e-9d4a-4e6b-8a57-1c2d3e4f5a6b', email: 'ana@exemplo.com', user_metadata: { name: 'Ana Souza' } } : resposta.user },
    error: resposta.error ?? null,
  }))
  return { db: { auth: { admin: { createUser }, signInWithPassword: vi.fn() } }, createUser }
}

const bruto = { nome: 'Ana Souza', email: 'ana@exemplo.com', senha: 'senha-forte-123' }

afterEach(() => vi.restoreAllMocks())

describe('cadastrar', () => {
  it('dados válidos: cria a conta e devolve o usuário', async () => {
    const { db, createUser } = banco()
    const r = await cadastrar(bruto, db as never, [])
    expect(r).toEqual({ tipo: 'criado', usuario: { id: '3f2b8c1e-9d4a-4e6b-8a57-1c2d3e4f5a6b', email: 'ana@exemplo.com', name: 'Ana Souza' } })
    expect(createUser).toHaveBeenCalledOnce()
  })

  it('dados inválidos: devolve os erros por campo e NÃO fala com o Supabase', async () => {
    const { db, createUser } = banco()
    const r = await cadastrar({ nome: '', email: 'x', senha: '123' }, db as never, [])
    expect(r.tipo).toBe('erros')
    if (r.tipo === 'erros') expect(Object.keys(r.erros).sort()).toEqual(['email', 'nome', 'senha'])
    expect(createUser).not.toHaveBeenCalled()
  })

  it('limpa os dados antes de criar (e-mail em minúsculas, nome sem espaços sobrando)', async () => {
    const { db, createUser } = banco()
    await cadastrar({ nome: '  Ana   Souza ', email: ' ANA@Exemplo.com', senha: 'senha-forte-123' }, db as never, [])
    expect(createUser).toHaveBeenCalledWith(expect.objectContaining({ email: 'ana@exemplo.com', user_metadata: { name: 'Ana Souza' } }))
  })

  it('cadastro desligado (sem Supabase neste ambiente): mensagem clara, sem erro e sem conta', async () => {
    const r = await cadastrar(bruto, null, [])
    expect(r).toEqual({ tipo: 'indisponivel', mensagem: 'O cadastro ainda não está disponível neste ambiente.' })
  })

  it('os dados inválidos são apontados mesmo com o cadastro desligado (a tela mostra o que corrigir)', async () => {
    expect((await cadastrar({ ...bruto, email: 'x' }, null, [])).tipo).toBe('erros')
  })

  it('e-mail que já tem conta: mensagem de erro, sem criar outra', async () => {
    const { db } = banco({ user: null, error: { message: 'A user with this email address has already been registered', code: 'email_exists', status: 422 } })
    const r = await cadastrar(bruto, db as never, [])
    expect(r).toMatchObject({ tipo: 'erro', mensagem: expect.stringMatching(/já tem uma conta/) })
  })

  it('o e-mail do usuário de teste é reservado: tratado como já cadastrado, sem falar com o Supabase', async () => {
    const { db, createUser } = banco()
    const r = await cadastrar({ ...bruto, email: 'Teste@Corner.com' }, db as never, ['teste@corner.com'])
    expect(r).toMatchObject({ tipo: 'erro', mensagem: expect.stringMatching(/já tem uma conta/) })
    expect(createUser).not.toHaveBeenCalled()
  })

  it('falha do serviço: mensagem genérica, sem detalhes e sem a senha', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { db } = banco({ user: null, error: { message: 'pool exhausted para ana@exemplo.com', status: 500 } })
    const r = await cadastrar(bruto, db as never, [])
    expect(r.tipo).toBe('erro')
    expect(JSON.stringify(r)).not.toMatch(/pool|ana@|senha-forte/)
  })

  it('exceção do cliente (ex.: sem rede) vira erro controlado para a tela, e nunca "criado"', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { db, createUser } = banco()
    createUser.mockRejectedValue(new TypeError('fetch failed'))
    const r = await cadastrar(bruto, db as never, [])
    expect(r.tipo).toBe('erro')
    expect(JSON.stringify(r)).not.toMatch(/fetch failed|senha-forte/)
  })
})
