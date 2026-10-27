import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  aceitarConviteNoServidor, apagarAlunoNoServidor, atualizarAlunoNoServidor, cancelarConviteNoServidor, consultarConviteNoServidor,
  criarAlunoNoServidor, dadosDoAlunoNoServidor, desvincularNoServidor, esquecerConviteNoServidor, gerarConviteNoServidor, guardarConviteNoServidor,
  lerAlunoNoServidor, listarAlunosNoServidor, meuTreinadorNoServidor,
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

describe('convite (etapa 3a)', () => {
  const ID = fichaDeExemplo.id

  it('gerar: POST em /alunos/<id>/convite, sem corpo; devolve o link e a validade', async () => {
    const f = responder(201, { link: 'https://corner2.vercel.app/convite/abc', expiraEm: '2026-11-10T12:00:00.000Z' })
    const r = await gerarConviteNoServidor(ID)
    expect(r).toEqual({ ok: true, valor: { link: 'https://corner2.vercel.app/convite/abc', expiraEm: '2026-11-10T12:00:00.000Z' } })
    const [url, opcoes] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`/api/cornerman/alunos/${ID}/convite`)
    expect(opcoes).toMatchObject({ method: 'POST', credentials: 'same-origin' })
    expect(opcoes).not.toHaveProperty('body')
  })

  it('gerar: resposta sem link ou sem validade vira "resposta_invalida"', async () => {
    responder(201, { link: 42, expiraEm: 'x' })
    expect(await gerarConviteNoServidor(ID)).toMatchObject({ ok: false, codigo: 'resposta_invalida' })
    responder(201, { qualquer: 'coisa' })
    expect(await gerarConviteNoServidor(ID)).toMatchObject({ ok: false, codigo: 'resposta_invalida' })
  })

  it('gerar: o erro do servidor (limite, ficha com conta) chega com o texto e o código', async () => {
    responder(409, { erro: 'Esta ficha já está vinculada a uma conta.', codigo: 'nao_convidavel' })
    expect(await gerarConviteNoServidor(ID)).toEqual({ ok: false, status: 409, codigo: 'nao_convidavel', erro: 'Esta ficha já está vinculada a uma conta.' })
  })

  it('cancelar: DELETE em /alunos/<id>/convite', async () => {
    const f = responder(200, { ok: true })
    expect((await cancelarConviteNoServidor(ID)).ok).toBe(true)
    const [url, opcoes] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`/api/cornerman/alunos/${ID}/convite`)
    expect(opcoes.method).toBe('DELETE')
  })

  it('ler a ficha devolve também o convite pendente (ou null quando não há)', async () => {
    responder(200, { aluno: fichaDeExemplo, convite: { expiraEm: '2026-11-10T12:00:00.000Z' } })
    expect(await lerAlunoNoServidor(ID)).toEqual({ ok: true, valor: { aluno: fichaDeExemplo, convite: { expiraEm: '2026-11-10T12:00:00.000Z' } } })
    responder(200, { aluno: fichaDeExemplo, convite: null })
    expect(await lerAlunoNoServidor(ID)).toEqual({ ok: true, valor: { aluno: fichaDeExemplo, convite: null } })
    responder(200, { aluno: fichaDeExemplo }) // servidor antigo, sem o campo
    expect(await lerAlunoNoServidor(ID)).toEqual({ ok: true, valor: { aluno: fichaDeExemplo, convite: null } })
    responder(200, { aluno: fichaDeExemplo, convite: { expiraEm: 42 } })
    expect(await lerAlunoNoServidor(ID)).toEqual({ ok: true, valor: { aluno: fichaDeExemplo, convite: null } })
  })
})

describe('convite do aluno e "Meu treinador" (etapa 3a)', () => {
  const T = 'A'.repeat(43)

  it('consultar: GET público em /api/convite/<token>; devolve valido, treinador e logado', async () => {
    const f = responder(200, { valido: true, treinador: 'Marcos', logado: false })
    expect(await consultarConviteNoServidor(T)).toEqual({ ok: true, valor: { valido: true, treinador: 'Marcos', logado: false } })
    expect((f.mock.calls[0] as unknown[])[0]).toBe(`/api/convite/${T}`)
    responder(200, { valido: false, logado: true })
    expect(await consultarConviteNoServidor(T)).toEqual({ ok: true, valor: { valido: false, logado: true } })
  })

  it('consultar: o token vai codificado no caminho; resposta fora do formato vira "resposta_invalida"', async () => {
    const f = responder(200, { valido: false, logado: false })
    await consultarConviteNoServidor('a/b c?d')
    expect((f.mock.calls[0] as unknown[])[0]).toBe('/api/convite/a%2Fb%20c%3Fd')
    for (const ruim of [{ valido: 'sim', logado: true }, { valido: true, logado: 1, treinador: 'x' }, { valido: true, logado: true }, null, []]) {
      responder(200, ruim)
      expect(await consultarConviteNoServidor(T), JSON.stringify(ruim)).toMatchObject({ ok: false, codigo: 'resposta_invalida' })
    }
  })

  it('guardar: POST em /guardar; esquecer: DELETE em /guardar', async () => {
    const f = responder(200, { ok: true })
    expect((await guardarConviteNoServidor(T)).ok).toBe(true)
    expect((await esquecerConviteNoServidor(T)).ok).toBe(true)
    expect(f.mock.calls.map(c => [(c as unknown[])[0], ((c as unknown[])[1] as RequestInit).method])).toEqual([
      [`/api/convite/${T}/guardar`, 'POST'], [`/api/convite/${T}/guardar`, 'DELETE'],
    ])
  })

  it('guardar: convite que não vale chega como erro com texto e código', async () => {
    responder(404, { erro: 'Convite inválido ou expirado.', codigo: 'convite_invalido' })
    expect(await guardarConviteNoServidor(T)).toEqual({ ok: false, status: 404, codigo: 'convite_invalido', erro: 'Convite inválido ou expirado.' })
  })

  it('aceitar: POST em /aceitar, sem corpo; devolve o primeiro nome do treinador', async () => {
    const f = responder(200, { ok: true, treinador: 'Marcos' })
    expect(await aceitarConviteNoServidor(T)).toEqual({ ok: true, valor: { treinador: 'Marcos' } })
    const [url, opcoes] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`/api/convite/${T}/aceitar`)
    expect(opcoes).toMatchObject({ method: 'POST', credentials: 'same-origin' })
    expect(opcoes).not.toHaveProperty('body')
  })

  it('aceitar: os erros do servidor (já tem treinador, convite inválido) chegam com texto e código; sem treinador na resposta vira "resposta_invalida"', async () => {
    responder(409, { erro: 'Você já tem um treinador.', codigo: 'ja_tem_treinador' })
    expect(await aceitarConviteNoServidor(T)).toMatchObject({ ok: false, status: 409, codigo: 'ja_tem_treinador' })
    responder(200, { ok: true })
    expect(await aceitarConviteNoServidor(T)).toMatchObject({ ok: false, codigo: 'resposta_invalida' })
  })

  it('meu treinador: GET devolve o nome ou null; DELETE desvincula', async () => {
    const f = responder(200, { treinador: { nome: 'Marcos' } })
    expect(await meuTreinadorNoServidor()).toEqual({ ok: true, valor: { treinador: { nome: 'Marcos' } } })
    responder(200, { treinador: null })
    expect(await meuTreinadorNoServidor()).toEqual({ ok: true, valor: { treinador: null } })
    responder(200, { treinador: { nome: 42 } })
    expect(await meuTreinadorNoServidor()).toMatchObject({ ok: false, codigo: 'resposta_invalida' })
    const g = responder(200, { ok: true })
    expect((await desvincularNoServidor()).ok).toBe(true)
    const [url, opcoes] = g.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/meu-treinador')
    expect(opcoes.method).toBe('DELETE')
    expect((f.mock.calls[0] as unknown[])[0]).toBe('/api/meu-treinador')
  })

  it('sem conexão: status 0 e a mensagem de rede, sem lançar erro', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    expect(await aceitarConviteNoServidor(T)).toMatchObject({ ok: false, status: 0, codigo: 'sem_conexao' })
    expect(await meuTreinadorNoServidor()).toMatchObject({ ok: false, status: 0, codigo: 'sem_conexao' })
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

describe('dados do aluno (etapa 3b)', () => {
  const ID = fichaDeExemplo.id
  const dados = {
    nivel: 'avancado', foto: '',
    estilo: { atletaId: 'ali', nome: 'Muhammad Ali', estilo: 'Out-boxer', percentual: 82 },
    plano: { nome: 'Fundamentos', semana: 2, semanas: 4 },
    treinos: [{ data: '2026-10-26T20:00:00.000Z', tipo: 'spa', rounds: 6, minPorRound: 2, rpe: 8, duracaoSegundos: 1500 }],
  }

  it('GET em /alunos/<id>/dados, sem corpo; devolve os dados', async () => {
    const f = responder(200, { dados })
    expect(await dadosDoAlunoNoServidor(ID)).toEqual({ ok: true, valor: dados })
    const [url, opcoes] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`/api/cornerman/alunos/${ID}/dados`)
    expect(opcoes).toMatchObject({ method: 'GET', credentials: 'same-origin', cache: 'no-store' })
    expect(opcoes).not.toHaveProperty('body')
  })

  it('sem quiz, sem plano e sem treinos também é uma resposta válida', async () => {
    responder(200, { dados: { nivel: null, foto: '', estilo: null, plano: null, treinos: [] } })
    expect((await dadosDoAlunoNoServidor(ID)).ok).toBe(true)
  })

  it.each([
    ['sem o campo dados', {}],
    ['treinos que não é lista', { dados: { ...dados, treinos: 'x' } }],
    ['treino com tipo inventado', { dados: { ...dados, treinos: [{ ...dados.treinos[0], tipo: 'xyz' }] } }],
    ['treino com número em texto', { dados: { ...dados, treinos: [{ ...dados.treinos[0], rpe: '8' }] } }],
    ['estilo incompleto', { dados: { ...dados, estilo: { nome: 'Ali' } } }],
    ['foto que não é texto', { dados: { ...dados, foto: 5 } }],
  ])('resposta fora do formato (%s): erro genérico, nunca dado quebrado', async (_nome, corpo) => {
    responder(200, corpo)
    expect(await dadosDoAlunoNoServidor(ID)).toEqual({ ok: false, status: 200, codigo: 'resposta_invalida', erro: 'Não foi possível continuar. Tente novamente.' })
  })

  it('409 sem vínculo e 404 voltam com o código e o texto do servidor', async () => {
    responder(409, { erro: 'Este aluno ainda não tem conta vinculada.', codigo: 'sem_vinculo' })
    expect(await dadosDoAlunoNoServidor(ID)).toEqual({ ok: false, status: 409, codigo: 'sem_vinculo', erro: 'Este aluno ainda não tem conta vinculada.' })
    responder(404, { erro: 'Aluno não encontrado.', codigo: 'nao_encontrado' })
    expect(await dadosDoAlunoNoServidor(ID)).toMatchObject({ ok: false, status: 404 })
  })

  it('sem conexão: texto próprio, sem lançar erro', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('rede') }))
    expect(await dadosDoAlunoNoServidor(ID)).toMatchObject({ ok: false, codigo: 'sem_conexao' })
  })
})
