import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  apagarAlunoNoServidor, atualizarAlunoNoServidor, criarAlunoNoServidor, lerAlunoNoServidor, listarAlunosNoServidor,
} from '@/lib/cornerman/cliente'

// As chamadas que as telas do treinador fazem à API: o que enviam e como tratam cada tipo de resposta.

const fichaDeExemplo = { id: '3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0c', nome: 'Beto' }

function responder(status: number, corpo: unknown, comoTexto = false) {
  const fetchFalso = vi.fn(async () => new Response(comoTexto ? String(corpo) : JSON.stringify(corpo), { status, headers: { 'content-type': comoTexto ? 'text/html' : 'application/json' } }))
  vi.stubGlobal('fetch', fetchFalso)
  return fetchFalso
}

afterEach(() => vi.unstubAllGlobals())

describe('o que é enviado', () => {
  it('listar: GET em /api/cornerman/alunos, mesmo site, sem cache e sem corpo', async () => {
    const f = responder(200, { alunos: [], ativos: 0, limite: 20 })
    await listarAlunosNoServidor()
    expect(f).toHaveBeenCalledWith('/api/cornerman/alunos', expect.objectContaining({ method: 'GET', credentials: 'same-origin', cache: 'no-store' }))
    expect((f.mock.calls[0] as unknown[])[1]).not.toHaveProperty('body')
  })

  it('criar: POST com o corpo em JSON', async () => {
    const f = responder(201, { aluno: fichaDeExemplo })
    await criarAlunoNoServidor({ nome: 'Beto', notas: 'ok' })
    const [url, opcoes] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/cornerman/alunos')
    expect(opcoes).toMatchObject({ method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } })
    expect(JSON.parse(opcoes.body as string)).toEqual({ nome: 'Beto', notas: 'ok' })
  })

  it('ler, atualizar e apagar: caminho com o id (codificado), método certo', async () => {
    const f = responder(200, { aluno: fichaDeExemplo })
    await lerAlunoNoServidor('a/b c')
    await atualizarAlunoNoServidor(fichaDeExemplo.id, { notas: 'x' })
    await apagarAlunoNoServidor(fichaDeExemplo.id)
    expect(f.mock.calls.map(c => [(c as unknown[])[0], ((c as unknown[])[1] as RequestInit).method])).toEqual([
      ['/api/cornerman/alunos/a%2Fb%20c', 'GET'],
      [`/api/cornerman/alunos/${fichaDeExemplo.id}`, 'PATCH'],
      [`/api/cornerman/alunos/${fichaDeExemplo.id}`, 'DELETE'],
    ])
  })
})

describe('o que volta', () => {
  it('sucesso: o valor da resposta (a ficha, ou a lista inteira)', async () => {
    responder(201, { aluno: fichaDeExemplo })
    expect(await criarAlunoNoServidor({ nome: 'Beto' })).toEqual({ ok: true, valor: fichaDeExemplo })
    responder(200, { alunos: [fichaDeExemplo], ativos: 1, limite: 20 })
    expect(await listarAlunosNoServidor()).toEqual({ ok: true, valor: { alunos: [fichaDeExemplo], ativos: 1, limite: 20 } })
  })

  it('apagar: sucesso sem valor útil', async () => {
    responder(200, { ok: true })
    expect((await apagarAlunoNoServidor(fichaDeExemplo.id)).ok).toBe(true)
  })

  it('erro da API: o texto e o código do servidor, com o status', async () => {
    responder(409, { erro: 'Você já tem 20 alunos.', codigo: 'limite_de_alunos' })
    expect(await criarAlunoNoServidor({ nome: 'Beto' })).toEqual({ ok: false, status: 409, codigo: 'limite_de_alunos', erro: 'Você já tem 20 alunos.' })
  })

  it('erro sem JSON (página de erro do servidor): mensagem genérica, sem repassar o HTML', async () => {
    responder(500, '<html>Internal Server Error segredo</html>', true)
    const r = await listarAlunosNoServidor()
    expect(r).toMatchObject({ ok: false, status: 500, codigo: 'erro' })
    expect(JSON.stringify(r)).not.toContain('segredo')
  })

  it('resposta de sucesso que não tem o formato esperado vira erro, não quebra a tela', async () => {
    responder(200, { qualquer: 'coisa' })
    expect(await lerAlunoNoServidor(fichaDeExemplo.id)).toMatchObject({ ok: false, codigo: 'resposta_invalida' })
    responder(200, { alunos: 'não é lista' })
    expect(await listarAlunosNoServidor()).toMatchObject({ ok: false, codigo: 'resposta_invalida' })
  })

  it('sem conexão: status 0 e a mensagem de rede, sem lançar erro', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    expect(await listarAlunosNoServidor()).toEqual({ ok: false, status: 0, codigo: 'sem_conexao', erro: 'Sem conexão. Verifique a internet e tente de novo.' })
  })
})
