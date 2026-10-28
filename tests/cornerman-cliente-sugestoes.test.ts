import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  aceitarSugestaoNoServidor, historicoDeSugestoesNoServidor, recusarSugestaoNoServidor, seloDeAlunosNoServidor,
  sugerirPlanoNoServidor, sugestaoDoTreinadorNoServidor,
} from '@/lib/cornerman/cliente'

// As chamadas das telas de sugestão e do selo da aba "Alunos": o que enviam e como tratam cada resposta.

const FICHA = '3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0c'
const SUGESTAO = '9d1c2b3a-4e5f-4a6b-8c7d-0e1f2a3b4c5d'

const daFicha = (extra: object = {}) => ({
  id: SUGESTAO, planoId: 'fundamentos', planoNome: 'Fundamentos', mensagem: 'oi', status: 'pendente',
  criadaEm: '2026-10-28T12:00:00.000Z', respondidaEm: null, ...extra,
})
const doAluno = (extra: object = {}) => ({
  id: SUGESTAO, planoId: 'fundamentos', planoNome: 'Fundamentos', mensagem: 'oi', treinador: 'Marcos',
  criadaEm: '2026-10-28T12:00:00.000Z', respondidaEm: null, ...extra,
})

function responder(status: number, corpo: unknown) {
  const fetchFalso = vi.fn(async () => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } }))
  vi.stubGlobal('fetch', fetchFalso)
  return fetchFalso
}

afterEach(() => vi.unstubAllGlobals())

describe('o que é enviado', () => {
  it('histórico: GET em /alunos/<id>/sugestoes, sem corpo', async () => {
    const f = responder(200, { sugestoes: [] })
    await historicoDeSugestoesNoServidor(FICHA)
    expect(f).toHaveBeenCalledWith(`/api/cornerman/alunos/${FICHA}/sugestoes`, expect.objectContaining({ method: 'GET', credentials: 'same-origin', cache: 'no-store' }))
    expect((f.mock.calls[0] as unknown[])[1]).not.toHaveProperty('body')
  })

  it('sugerir: POST com o plano e a mensagem em JSON', async () => {
    const f = responder(201, { status: 'pendente', sugestoes: [daFicha()] })
    await sugerirPlanoNoServidor(FICHA, { planoId: 'fundamentos', mensagem: 'Foco na guarda' })
    const [url, opcoes] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`/api/cornerman/alunos/${FICHA}/sugestoes`)
    expect(opcoes).toMatchObject({ method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } })
    expect(JSON.parse(opcoes.body as string)).toEqual({ planoId: 'fundamentos', mensagem: 'Foco na guarda' })
  })

  it('o id vai codificado no caminho', async () => {
    const f = responder(200, { sugestoes: [] })
    await historicoDeSugestoesNoServidor('a/b c')
    expect((f.mock.calls[0] as unknown[])[0]).toBe('/api/cornerman/alunos/a%2Fb%20c/sugestoes')
  })

  it('selo: GET em /alunos/selo', async () => {
    const f = responder(200, { vermelhos: 2 })
    await seloDeAlunosNoServidor()
    expect(f).toHaveBeenCalledWith('/api/cornerman/alunos/selo', expect.objectContaining({ method: 'GET', cache: 'no-store' }))
  })

  it('aluno: consultar (GET), aceitar e recusar (POST sem corpo)', async () => {
    const f = responder(200, { pendente: null, aceita: null })
    await sugestaoDoTreinadorNoServidor()
    responder(200, { ok: true })
    const g = responder(200, { ok: true })
    await aceitarSugestaoNoServidor(SUGESTAO)
    await recusarSugestaoNoServidor(SUGESTAO)
    expect((f.mock.calls[0] as unknown[])[0]).toBe('/api/sugestao-do-treinador')
    expect(g.mock.calls.map(c => [(c as unknown[])[0], ((c as unknown[])[1] as RequestInit).method])).toEqual([
      [`/api/sugestao-do-treinador/${SUGESTAO}/aceitar`, 'POST'],
      [`/api/sugestao-do-treinador/${SUGESTAO}/recusar`, 'POST'],
    ])
    expect((g.mock.calls[0] as unknown[])[1]).not.toHaveProperty('body')
  })
})

describe('o que volta', () => {
  it('histórico e sugerir devolvem a lista; sugerir também o status', async () => {
    responder(200, { sugestoes: [daFicha(), daFicha({ id: 'outra', status: 'substituida', respondidaEm: '2026-10-28T13:00:00.000Z' })] })
    const h = await historicoDeSugestoesNoServidor(FICHA)
    expect(h.ok && h.valor.map(s => s.status)).toEqual(['pendente', 'substituida'])

    responder(201, { status: 'registrada', sugestoes: [daFicha({ status: 'registrada' })] })
    const s = await sugerirPlanoNoServidor(FICHA, { planoId: 'fundamentos', mensagem: '' })
    expect(s).toMatchObject({ ok: true, valor: { status: 'registrada' } })
  })

  it('formato fora do esperado vira erro genérico, nunca uma tela quebrada', async () => {
    for (const corpo of [{ sugestoes: 'x' }, { sugestoes: [{ id: 1 }] }, { sugestoes: [daFicha({ status: 'inventado' })] }, { sugestoes: [daFicha({ planoNome: 3 })] }, null]) {
      responder(200, corpo)
      const r = await historicoDeSugestoesNoServidor(FICHA)
      expect(r.ok).toBe(false)
    }
    responder(201, { status: 'talvez', sugestoes: [] })
    expect((await sugerirPlanoNoServidor(FICHA, { planoId: 'fundamentos', mensagem: '' })).ok).toBe(false)
  })

  it('erros da API voltam com o texto, o código e o status do servidor', async () => {
    responder(409, { erro: 'Esta ficha está encerrada.', codigo: 'ficha_encerrada' })
    expect(await sugerirPlanoNoServidor(FICHA, { planoId: 'fundamentos', mensagem: '' })).toEqual({ ok: false, status: 409, codigo: 'ficha_encerrada', erro: 'Esta ficha está encerrada.' })
    responder(403, { erro: 'Esta área é do plano Cornerman ou Profissional.', codigo: 'plano_insuficiente' })
    expect(await historicoDeSugestoesNoServidor(FICHA)).toMatchObject({ ok: false, status: 403, codigo: 'plano_insuficiente' })
  })

  it('selo: o número de alunos; null (sem banco) é válido; outra coisa é erro', async () => {
    responder(200, { vermelhos: 3 })
    expect(await seloDeAlunosNoServidor()).toEqual({ ok: true, valor: 3 })
    responder(200, { vermelhos: 0 })
    expect(await seloDeAlunosNoServidor()).toEqual({ ok: true, valor: 0 })
    responder(200, { vermelhos: null })
    expect(await seloDeAlunosNoServidor()).toEqual({ ok: true, valor: null })
    for (const corpo of [{ vermelhos: -1 }, { vermelhos: 1.5 }, { vermelhos: '2' }, { vermelhos: true }, {}, null]) {
      responder(200, corpo)
      expect((await seloDeAlunosNoServidor()).ok).toBe(false)
    }
  })

  it('aluno: pendente e aceita, cada uma com o treinador; vazias também valem', async () => {
    responder(200, { pendente: doAluno(), aceita: doAluno({ id: 'x', respondidaEm: '2026-10-28T14:00:00.000Z' }) })
    const r = await sugestaoDoTreinadorNoServidor()
    expect(r).toMatchObject({ ok: true, valor: { pendente: { treinador: 'Marcos' }, aceita: { respondidaEm: '2026-10-28T14:00:00.000Z' } } })
    responder(200, { pendente: null, aceita: null })
    expect(await sugestaoDoTreinadorNoServidor()).toEqual({ ok: true, valor: { pendente: null, aceita: null } })
  })

  it('aluno: sugestão sem treinador ou com campo do tipo errado é erro', async () => {
    for (const pendente of [{ ...doAluno(), treinador: undefined }, doAluno({ planoId: 3 }), doAluno({ criadaEm: null }), 'x']) {
      responder(200, { pendente, aceita: null })
      expect((await sugestaoDoTreinadorNoServidor()).ok).toBe(false)
    }
  })

  it('aceitar e recusar: 404 volta com o texto do servidor; sucesso não devolve valor útil', async () => {
    responder(404, { erro: 'Sugestão não encontrada ou já respondida.', codigo: 'nao_encontrado' })
    expect(await aceitarSugestaoNoServidor(SUGESTAO)).toMatchObject({ ok: false, status: 404, erro: 'Sugestão não encontrada ou já respondida.' })
    responder(200, { ok: true })
    expect(await recusarSugestaoNoServidor(SUGESTAO)).toEqual({ ok: true, valor: true })
  })

  it('sem conexão: texto próprio, sem lançar erro', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    expect(await seloDeAlunosNoServidor()).toMatchObject({ ok: false, status: 0, codigo: 'sem_conexao' })
    expect(await aceitarSugestaoNoServidor(SUGESTAO)).toMatchObject({ ok: false, status: 0 })
  })
})
