import { E2E_EMAIL, E2E_PORTA, E2E_SENHA } from './constantes'
import { expect, test } from './fixtures'

// As rotas de assinatura, sem o Stripe de verdade (o servidor de teste sobe SEM chave do Stripe).
// O que se prova aqui: quem pode chamar, o que é recusado antes de qualquer cobrança e que a falta
// de configuração vira uma resposta clara, nunca um erro 500 nem um vazamento.

const SITE = `http://localhost:${E2E_PORTA}`
const mesmoSite = { origin: SITE }

test.describe('rotas de assinatura sem estar logado', () => {
  test('todas respondem 401 (o proxy não cobre /api, então a própria rota confere)', async ({ request }) => {
    const get = await request.get('/api/assinatura/estado')
    expect(get.status()).toBe(401)
    for (const rota of ['/api/assinatura/checkout', '/api/assinatura/portal']) {
      const r = await request.post(rota, { headers: mesmoSite, data: { nivel: 'amador', periodo: 'mensal' } })
      expect(r.status(), rota).toBe(401)
    }
  })

  test('a resposta de erro é JSON, em português, sem cache e sem detalhes internos', async ({ request }) => {
    const r = await request.get('/api/assinatura/estado')
    expect(r.headers()['cache-control']).toBe('no-store')
    const corpo = await r.json()
    expect(corpo).toEqual({ erro: 'Entre na sua conta para continuar.', codigo: 'nao_autenticado' })
  })
})

test.describe('rotas de assinatura logado, sem o Stripe configurado', () => {
  test('pedido de outro site é recusado com 403, mesmo logado', async ({ pagina }) => {
    const r = await pagina.request.post('/api/assinatura/checkout', {
      headers: { origin: 'https://site-malicioso.com' }, data: { nivel: 'amador', periodo: 'mensal' },
    })
    expect(r.status()).toBe(403)
    expect((await r.json()).codigo).toBe('origem_invalida')
  })

  test('pedido sem Origin é recusado com 403', async ({ pagina }) => {
    expect((await pagina.request.post('/api/assinatura/portal')).status()).toBe(403)
  })

  test.describe('corpo do checkout inválido: 400, antes de qualquer cobrança', () => {
    const invalidos: [string, unknown][] = [
      ['plano inexistente', { nivel: 'ouro', periodo: 'mensal' }],
      ['período inexistente', { nivel: 'amador', periodo: 'semanal' }],
      ['id de preço escolhido pelo navegador', { nivel: 'amador', periodo: 'mensal', price: 'price_x' }],
      ['faltando o período', { nivel: 'amador' }],
      ['vazio', {}],
    ]
    for (const [nome, corpo] of invalidos) {
      test(nome, async ({ pagina }) => {
        const r = await pagina.request.post('/api/assinatura/checkout', { headers: mesmoSite, data: corpo })
        expect(r.status()).toBe(400)
        expect((await r.json()).codigo).toBe('pedido_invalido')
      })
    }

    test('texto que não é JSON', async ({ pagina }) => {
      const r = await pagina.request.post('/api/assinatura/checkout', { headers: { ...mesmoSite, 'content-type': 'application/json' }, data: 'isto { não é json' })
      expect(r.status()).toBe(400)
    })
  })

  test('pedido válido sem chave do Stripe: 503 claro, sem vazar nada', async ({ pagina }) => {
    const r = await pagina.request.post('/api/assinatura/checkout', { headers: mesmoSite, data: { nivel: 'profissional', periodo: 'anual' } })
    expect(r.status()).toBe(503)
    const texto = await r.text()
    expect(JSON.parse(texto)).toEqual({ erro: 'O pagamento ainda não está disponível neste ambiente.', codigo: 'nao_configurado' })
    expect(texto).not.toMatch(/sk_|stripe|price_|cus_/i)
  })

  test('portal e estado sem chave do Stripe: também 503', async ({ pagina }) => {
    expect((await pagina.request.post('/api/assinatura/portal', { headers: mesmoSite })).status()).toBe(503)
    expect((await pagina.request.get('/api/assinatura/estado')).status()).toBe(503)
  })

  test('os métodos errados são recusados (405)', async ({ pagina }) => {
    expect((await pagina.request.get('/api/assinatura/checkout')).status()).toBe(405)
    expect((await pagina.request.post('/api/assinatura/estado', { headers: mesmoSite })).status()).toBe(405)
  })
})

test('login e senha de teste continuam funcionando (a fixture usa os mesmos)', () => {
  expect(E2E_EMAIL).toContain('@')
  expect(E2E_SENHA.length).toBeGreaterThan(8)
})
