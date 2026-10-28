import { E2E_PORTA } from './constantes'
import { expect, test } from './fixtures'

// As rotas da etapa 4, sem Stripe nem Supabase (o servidor de teste sobe sem as duas chaves): sugestões do treinador
// (/api/cornerman/alunos/<id>/sugestoes), o selo da aba (/api/cornerman/alunos/selo) e as do aluno (/api/sugestao-do-treinador).
// Sem a chave do Stripe o pagamento está desligado e o app todo fica liberado, então o plano passa; o que falta é o banco.
// O que se prova aqui: quem pode chamar, o que é recusado antes de tocar em qualquer dado e que nenhuma resposta repete o que
// foi enviado. A regra de plano (403), o isolamento e as respostas de verdade têm testes de unidade (tests/cornerman-sugestao*.test.ts)
// e a fumaça contra o Postgres real (npm run supabase:fumaca).

const SITE = `http://localhost:${E2E_PORTA}`
const mesmoSite = { origin: SITE }
const alheio = { origin: 'https://site-malicioso.com' }
const UUID = '3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0c'
const SUGESTAO = '9d1c2b3a-4e5f-4a6b-8c7d-0e1f2a3b4c5d'

test.describe('sem estar logado', () => {
  test('todas as rotas respondem 401', async ({ request }) => {
    expect((await request.get(`/api/cornerman/alunos/${UUID}/sugestoes`)).status()).toBe(401)
    expect((await request.post(`/api/cornerman/alunos/${UUID}/sugestoes`, { headers: mesmoSite, data: { planoId: 'fundamentos' } })).status()).toBe(401)
    expect((await request.get('/api/cornerman/alunos/selo')).status()).toBe(401)
    expect((await request.get('/api/sugestao-do-treinador')).status()).toBe(401)
    expect((await request.post(`/api/sugestao-do-treinador/${SUGESTAO}/aceitar`, { headers: mesmoSite })).status()).toBe(401)
    expect((await request.post(`/api/sugestao-do-treinador/${SUGESTAO}/recusar`, { headers: mesmoSite })).status()).toBe(401)
  })

  test('a resposta é JSON, em português, sem cache', async ({ request }) => {
    for (const caminho of ['/api/cornerman/alunos/selo', '/api/sugestao-do-treinador']) {
      const r = await request.get(caminho)
      expect(r.headers()['cache-control']).toBe('no-store')
      expect(await r.json()).toEqual({ erro: 'Entre na sua conta para continuar.', codigo: 'nao_autenticado' })
    }
  })
})

test.describe('logado: treinador', () => {
  test('pedido que muda algo, de outro site ou sem Origin, é recusado com 403', async ({ pagina }) => {
    for (const r of [
      await pagina.request.post(`/api/cornerman/alunos/${UUID}/sugestoes`, { headers: alheio, data: { planoId: 'fundamentos' } }),
      await pagina.request.post(`/api/cornerman/alunos/${UUID}/sugestoes`, { data: { planoId: 'fundamentos' } }),
    ]) {
      expect(r.status()).toBe(403)
      expect((await r.json()).codigo).toBe('origem_invalida')
    }
  })

  test('id que não é um uuid: 404 "Aluno não encontrado." antes de tocar no banco', async ({ pagina }) => {
    for (const id of ['abc', '1', 'x.y', encodeURIComponent("x'; drop table coach_suggestions;--")]) {
      for (const r of [
        await pagina.request.get(`/api/cornerman/alunos/${id}/sugestoes`),
        await pagina.request.post(`/api/cornerman/alunos/${id}/sugestoes`, { headers: mesmoSite, data: { planoId: 'fundamentos' } }),
      ]) {
        expect(r.status(), id).toBe(404)
        expect(await r.json()).toEqual({ erro: 'Aluno não encontrado.', codigo: 'nao_encontrado' })
      }
    }
  })

  test('corpo que não é JSON: 400; corpo grande demais (mais de 10 000 bytes): 413', async ({ pagina }) => {
    const json = { ...mesmoSite, 'content-type': 'application/json' }
    const ruim = await pagina.request.post(`/api/cornerman/alunos/${UUID}/sugestoes`, { headers: json, data: Buffer.from('isto { não é json') })
    expect(ruim.status(), await ruim.text()).toBe(400)
    const grande = await pagina.request.post(`/api/cornerman/alunos/${UUID}/sugestoes`, { headers: json, data: Buffer.from(JSON.stringify({ planoId: 'fundamentos', mensagem: 'x'.repeat(20_000) })) })
    expect(grande.status(), await grande.text()).toBe(413)
    expect((await grande.json()).codigo).toBe('muito_grande')
  })

  test('sem o banco configurado: 503 claro na leitura e na escrita, sem cache e sem vazar nada', async ({ pagina }) => {
    for (const r of [
      await pagina.request.get(`/api/cornerman/alunos/${UUID}/sugestoes`),
      await pagina.request.post(`/api/cornerman/alunos/${UUID}/sugestoes`, { headers: mesmoSite, data: { planoId: 'fundamentos', mensagem: 'mensagem secreta' } }),
    ]) {
      expect(r.status()).toBe(503)
      expect(r.headers()['cache-control']).toBe('no-store')
      expect((await r.json()).codigo).toBe('nao_configurado')
    }
  })

  test('o selo da aba, sem banco, responde 200 com "vermelhos: null" (é consultado em toda tela: um 5xx viraria erro de console)', async ({ pagina }) => {
    const r = await pagina.request.get('/api/cornerman/alunos/selo')
    expect(r.status()).toBe(200)
    expect(r.headers()['cache-control']).toBe('no-store')
    expect(await r.json()).toEqual({ vermelhos: null })
  })

  test('nenhuma resposta de erro repete o que foi enviado', async ({ pagina }) => {
    const textos: string[] = []
    for (const data of [{ planoId: 'plano-identificavel', mensagem: 'mensagem secreta' }, { planoId: 'fundamentos', mensagem: 'mensagem secreta', coach_id: 'u_invasor' }]) {
      textos.push(await (await pagina.request.post(`/api/cornerman/alunos/${UUID}/sugestoes`, { headers: mesmoSite, data })).text())
    }
    for (const t of textos) expect(t).not.toMatch(/identificavel|secreta|u_invasor/)
  })
})

test.describe('logado: aluno', () => {
  test('"Plano sugerido pelo meu treinador", sem banco, responde 200 com os dois null (é consultada em toda abertura da tela Hoje)', async ({ pagina }) => {
    const r = await pagina.request.get('/api/sugestao-do-treinador')
    expect(r.status()).toBe(200)
    expect(r.headers()['cache-control']).toBe('no-store')
    expect(await r.json()).toEqual({ pendente: null, aceita: null })
  })

  test('aceitar e recusar: pedido de outro site ou sem Origin é recusado com 403', async ({ pagina }) => {
    for (const acao of ['aceitar', 'recusar']) {
      for (const r of [
        await pagina.request.post(`/api/sugestao-do-treinador/${SUGESTAO}/${acao}`, { headers: alheio }),
        await pagina.request.post(`/api/sugestao-do-treinador/${SUGESTAO}/${acao}`),
      ]) {
        expect(r.status(), acao).toBe(403)
        expect((await r.json()).codigo).toBe('origem_invalida')
      }
    }
  })

  test('aceitar e recusar, sem o banco configurado: 503 claro e sem cache', async ({ pagina }) => {
    for (const acao of ['aceitar', 'recusar']) {
      const r = await pagina.request.post(`/api/sugestao-do-treinador/${SUGESTAO}/${acao}`, { headers: mesmoSite })
      expect(r.status(), acao).toBe(503)
      expect(r.headers()['cache-control']).toBe('no-store')
      expect((await r.json()).codigo).toBe('nao_configurado')
    }
  })
})
