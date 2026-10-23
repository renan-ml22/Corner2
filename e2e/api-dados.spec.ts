import { E2E_PORTA } from './constantes'
import { expect, test } from './fixtures'

// A rota /api/dados, sem o Supabase de verdade (o servidor de teste sobe SEM as variáveis do Supabase).
// O que se prova aqui: quem pode chamar, o que é recusado antes de tocar em qualquer banco, e que a falta de
// configuração vira uma resposta clara (nunca um erro 500 nem um vazamento).

const SITE = `http://localhost:${E2E_PORTA}`
const mesmoSite = { origin: SITE }

test.describe('/api/dados sem estar logado', () => {
  test('GET e PUT respondem 401 (o proxy não cobre /api, então a própria rota confere)', async ({ request }) => {
    expect((await request.get('/api/dados')).status()).toBe(401)
    expect((await request.put('/api/dados', { headers: mesmoSite, data: { pesos: [] } })).status()).toBe(401)
  })

  test('a resposta é JSON em português, sem cache e sem detalhes internos', async ({ request }) => {
    const r = await request.get('/api/dados')
    expect(r.headers()['cache-control']).toBe('no-store')
    expect(await r.json()).toEqual({ erro: 'Entre na sua conta para continuar.', codigo: 'nao_autenticado' })
  })
})

test.describe('/api/dados logado, sem o Supabase configurado', () => {
  test('GET: 200 com ativo:false (a conta na nuvem está desligada, e isso não é um erro)', async ({ pagina }) => {
    const r = await pagina.request.get('/api/dados')
    expect(r.status()).toBe(200)
    expect(await r.json()).toEqual({ ativo: false })
  })

  test('PUT de outro site é recusado com 403, mesmo logado', async ({ pagina }) => {
    const r = await pagina.request.put('/api/dados', { headers: { origin: 'https://site-malicioso.com' }, data: { pesos: [] } })
    expect(r.status()).toBe(403)
    expect((await r.json()).codigo).toBe('origem_invalida')
  })

  test('PUT sem Origin é recusado com 403', async ({ pagina }) => {
    expect((await pagina.request.put('/api/dados', { data: { pesos: [] } })).status()).toBe(403)
  })

  test('PUT do próprio site: 503 nao_configurado, sem gravar nada', async ({ pagina }) => {
    const r = await pagina.request.put('/api/dados', { headers: mesmoSite, data: { pesos: [] } })
    expect(r.status()).toBe(503)
    expect((await r.json()).codigo).toBe('nao_configurado')
  })

  test('as outras rotas de escrita não existem para dados (POST e DELETE: 405)', async ({ pagina }) => {
    expect((await pagina.request.post('/api/dados', { headers: mesmoSite, data: {} })).status()).toBe(405)
    expect((await pagina.request.delete('/api/dados', { headers: mesmoSite })).status()).toBe(405)
  })
})

test.describe('o app com a conta na nuvem desligada', () => {
  test('continua funcionando só com o aparelho: a tela abre e a rota é consultada sem erro de console', async ({ pagina }) => {
    const resposta = pagina.waitForResponse(r => r.url().endsWith('/api/dados') && r.request().method() === 'GET')
    await pagina.goto('/hoje')
    expect((await resposta).status()).toBe(200)
    await expect(pagina.getByRole('heading', { level: 1 }).first()).toBeVisible()
  })
})
