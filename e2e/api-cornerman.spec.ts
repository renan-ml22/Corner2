import { E2E_PORTA } from './constantes'
import { expect, test } from './fixtures'

// As rotas /api/cornerman/alunos, sem Stripe nem Supabase (o servidor de teste sobe sem as duas chaves).
// Sem a chave do Stripe o pagamento está desligado e o app todo fica liberado, então o plano passa; o que falta é o banco.
// O que se prova aqui: quem pode chamar, o que é recusado antes de tocar em qualquer dado e que nenhuma resposta repete
// o que foi enviado. A regra de plano (403) e o isolamento entre treinadores têm testes de unidade (tests/cornerman-*.test.ts).

const SITE = `http://localhost:${E2E_PORTA}`
const mesmoSite = { origin: SITE }
const UUID = '3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0c'

test.describe('sem estar logado', () => {
  test('todas as rotas respondem 401 (o proxy não cobre /api, então a própria rota confere)', async ({ request }) => {
    expect((await request.get('/api/cornerman/alunos')).status()).toBe(401)
    expect((await request.post('/api/cornerman/alunos', { headers: mesmoSite, data: { nome: 'A' } })).status()).toBe(401)
    expect((await request.get(`/api/cornerman/alunos/${UUID}`)).status()).toBe(401)
    expect((await request.patch(`/api/cornerman/alunos/${UUID}`, { headers: mesmoSite, data: { notas: 'x' } })).status()).toBe(401)
    expect((await request.delete(`/api/cornerman/alunos/${UUID}`, { headers: mesmoSite })).status()).toBe(401)
    expect((await request.get(`/api/cornerman/alunos/${UUID}/dados`)).status()).toBe(401)
  })

  test('a resposta é JSON, em português, sem cache', async ({ request }) => {
    const r = await request.get('/api/cornerman/alunos')
    expect(r.headers()['cache-control']).toBe('no-store')
    expect(await r.json()).toEqual({ erro: 'Entre na sua conta para continuar.', codigo: 'nao_autenticado' })
  })
})

test.describe('logado', () => {
  test('pedido que muda algo, de outro site ou sem Origin, é recusado com 403', async ({ pagina }) => {
    const alheio = { origin: 'https://site-malicioso.com' }
    for (const r of [
      await pagina.request.post('/api/cornerman/alunos', { headers: alheio, data: { nome: 'A' } }),
      await pagina.request.patch(`/api/cornerman/alunos/${UUID}`, { headers: alheio, data: { notas: 'x' } }),
      await pagina.request.delete(`/api/cornerman/alunos/${UUID}`, { headers: alheio }),
      await pagina.request.post('/api/cornerman/alunos', { data: { nome: 'A' } }),
    ]) {
      expect(r.status()).toBe(403)
      expect((await r.json()).codigo).toBe('origem_invalida')
    }
  })

  test('id que não é um uuid: 404 "Aluno não encontrado." em todas as rotas, antes de tocar no banco', async ({ pagina }) => {
    for (const id of ['abc', '1', 'x.y', encodeURIComponent("x'; drop table coach_alunos;--")]) {
      for (const r of [
        await pagina.request.get(`/api/cornerman/alunos/${id}`),
        await pagina.request.get(`/api/cornerman/alunos/${id}/dados`),
        await pagina.request.patch(`/api/cornerman/alunos/${id}`, { headers: mesmoSite, data: { notas: 'x' } }),
        await pagina.request.delete(`/api/cornerman/alunos/${id}`, { headers: mesmoSite }),
      ]) {
        expect(r.status(), id).toBe(404)
        expect(await r.json()).toEqual({ erro: 'Aluno não encontrado.', codigo: 'nao_encontrado' })
      }
    }
  })

  test('sem o banco configurado: 503 claro (leitura e escrita), sem vazar nada', async ({ pagina }) => {
    const respostas = [
      await pagina.request.get('/api/cornerman/alunos'),
      await pagina.request.post('/api/cornerman/alunos', { headers: mesmoSite, data: { nome: 'Nome Identificável' } }),
      await pagina.request.get(`/api/cornerman/alunos/${UUID}`),
      await pagina.request.get(`/api/cornerman/alunos/${UUID}/dados`),
      await pagina.request.patch(`/api/cornerman/alunos/${UUID}`, { headers: mesmoSite, data: { notas: 'nota secreta' } }),
      await pagina.request.delete(`/api/cornerman/alunos/${UUID}`, { headers: mesmoSite }),
    ]
    for (const r of respostas) {
      expect(r.status()).toBe(503)
      expect(r.headers()['cache-control']).toBe('no-store')
      expect((await r.json()).codigo).toBe('nao_configurado')
    }
  })

  test('corpo que não é JSON: 400; corpo grande demais (mais de 100 000 bytes): 413', async ({ pagina }) => {
    const json = { ...mesmoSite, 'content-type': 'application/json' }
    const ruim = await pagina.request.post('/api/cornerman/alunos', { headers: json, data: Buffer.from('isto { não é json') })
    expect(ruim.status(), await ruim.text()).toBe(400)
    const grande = await pagina.request.post('/api/cornerman/alunos', { headers: json, data: Buffer.from(JSON.stringify({ nome: 'A', notas: 'x'.repeat(200_000) })) })
    expect(grande.status(), await grande.text()).toBe(413)
    expect((await grande.json()).codigo).toBe('muito_grande')
  })

  test('nenhuma resposta de erro repete o que foi enviado', async ({ pagina }) => {
    const corpos = [
      { nome: 'Nome Identificável', email: 'beto-identificavel@exemplo.com', telefone: '11 99999-0000', notas: 'nota secreta' },
      { nome: 'Nome Identificável', coach_id: 'u_invasor', email: 'beto-identificavel@exemplo.com' },
    ]
    const textos: string[] = []
    for (const data of corpos) {
      textos.push(await (await pagina.request.post('/api/cornerman/alunos', { headers: mesmoSite, data })).text())
      textos.push(await (await pagina.request.patch(`/api/cornerman/alunos/${UUID}`, { headers: mesmoSite, data })).text())
    }
    for (const t of textos) expect(t).not.toMatch(/Identificável|identificavel|99999|secreta|u_invasor/)
  })

  test('o estado da assinatura continua respondendo igual (a rota foi refatorada)', async ({ pagina }) => {
    const r = await pagina.request.get('/api/assinatura/estado')
    expect(r.status()).toBe(200)
    expect(await r.json()).toEqual({ pagamentoAtivo: false })
  })
})


// ── Convite (etapa 3a) ───────────────────────────────────────

test.describe('convite: sem estar logado', () => {
  test('gerar e cancelar respondem 401', async ({ request }) => {
    expect((await request.post(`/api/cornerman/alunos/${UUID}/convite`, { headers: mesmoSite })).status()).toBe(401)
    expect((await request.delete(`/api/cornerman/alunos/${UUID}/convite`, { headers: mesmoSite })).status()).toBe(401)
  })
})

test.describe('convite: logado', () => {
  test('pedido de outro site ou sem Origin é recusado com 403', async ({ pagina }) => {
    const alheio = { origin: 'https://site-malicioso.com' }
    for (const r of [
      await pagina.request.post(`/api/cornerman/alunos/${UUID}/convite`, { headers: alheio }),
      await pagina.request.delete(`/api/cornerman/alunos/${UUID}/convite`, { headers: alheio }),
      await pagina.request.post(`/api/cornerman/alunos/${UUID}/convite`),
    ]) {
      expect(r.status()).toBe(403)
      expect((await r.json()).codigo).toBe('origem_invalida')
    }
  })

  test('id que não é um uuid: 404 "Aluno não encontrado." antes de tocar no banco', async ({ pagina }) => {
    for (const id of ['abc', '1', 'x.y']) {
      for (const r of [
        await pagina.request.post(`/api/cornerman/alunos/${id}/convite`, { headers: mesmoSite }),
        await pagina.request.delete(`/api/cornerman/alunos/${id}/convite`, { headers: mesmoSite }),
      ]) {
        expect(r.status(), id).toBe(404)
        expect(await r.json()).toEqual({ erro: 'Aluno não encontrado.', codigo: 'nao_encontrado' })
      }
    }
  })

  test('sem o banco configurado: 503 claro, sem token e sem cache', async ({ pagina }) => {
    for (const r of [
      await pagina.request.post(`/api/cornerman/alunos/${UUID}/convite`, { headers: mesmoSite }),
      await pagina.request.delete(`/api/cornerman/alunos/${UUID}/convite`, { headers: mesmoSite }),
    ]) {
      expect(r.status()).toBe(503)
      expect(r.headers()['cache-control']).toBe('no-store')
      const texto = await r.text()
      expect(JSON.parse(texto).codigo).toBe('nao_configurado')
      expect(texto).not.toMatch(/[A-Za-z0-9_-]{43}/)
    }
  })
})
