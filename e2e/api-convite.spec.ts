import { E2E_PORTA } from './constantes'
import { expect, test } from './fixtures'

// As rotas públicas do convite e "Meu treinador", sem Supabase (o servidor de teste sobe sem as variáveis).
// O que se prova aqui: quem pode chamar, o que é recusado antes de tocar em qualquer dado, que o cookie só é gravado
// para convite válido e que nenhuma resposta repete o token. As regras do convite têm testes de unidade
// (tests/cornerman-convite-*.test.ts) e a fumaça do banco real (npm run supabase:fumaca).

const SITE = `http://localhost:${E2E_PORTA}`
const mesmoSite = { origin: SITE }
const TOKEN = 'Zq9-_Kd3'.repeat(5) + 'abc' // 43 caracteres base64url
const MAL_FORMADOS = ['abc', '1', 'x.y', 'A'.repeat(44), 'A'.repeat(42), 'a%20b']

test.describe('GET /api/convite/<token> (público)', () => {
  test('sem sessão: 200 { valido: false, logado: false }, sem cache, para qualquer token', async ({ request }) => {
    for (const t of [TOKEN, ...MAL_FORMADOS]) {
      const r = await request.get(`/api/convite/${t}`)
      expect(r.status(), t).toBe(200)
      expect(r.headers()['cache-control']).toBe('no-store')
      expect(await r.json(), t).toEqual({ valido: false, logado: false })
    }
  })

  test('logado: a mesma resposta, com logado: true', async ({ pagina }) => {
    const r = await pagina.request.get(`/api/convite/${TOKEN}`)
    expect(r.status()).toBe(200)
    expect(await r.json()).toEqual({ valido: false, logado: true })
  })

  test('a resposta nunca repete o token', async ({ request }) => {
    expect(await (await request.get(`/api/convite/${TOKEN}`)).text()).not.toContain(TOKEN)
  })
})

test.describe('POST /api/convite/<token>/guardar (grava o cookie só para convite válido)', () => {
  test('de outro site ou sem Origin: 403 e SEM cookie', async ({ request }) => {
    for (const r of [
      await request.post(`/api/convite/${TOKEN}/guardar`, { headers: { origin: 'https://site-malicioso.com' } }),
      await request.post(`/api/convite/${TOKEN}/guardar`),
    ]) {
      expect(r.status()).toBe(403)
      expect((await r.json()).codigo).toBe('origem_invalida')
      expect(r.headers()['set-cookie']).toBeUndefined()
    }
  })

  test('token malformado: 404 "convite_invalido" e SEM cookie', async ({ request }) => {
    for (const t of MAL_FORMADOS) {
      const r = await request.post(`/api/convite/${t}/guardar`, { headers: mesmoSite })
      expect(r.status(), t).toBe(404)
      expect(await r.json()).toEqual({ erro: 'Convite inválido ou expirado.', codigo: 'convite_invalido' })
      expect(r.headers()['set-cookie'], t).toBeUndefined()
    }
  })

  test('token bem formado, sem o banco configurado: 503 e SEM cookie', async ({ request }) => {
    const r = await request.post(`/api/convite/${TOKEN}/guardar`, { headers: mesmoSite })
    expect(r.status()).toBe(503)
    expect((await r.json()).codigo).toBe('nao_configurado')
    expect(r.headers()['set-cookie']).toBeUndefined()
    expect(await r.text()).not.toContain(TOKEN)
  })

  test('DELETE limpa o cookie (para sair do ciclo de um convite que não vale mais), só do próprio site', async ({ request }) => {
    const alheio = await request.delete(`/api/convite/${TOKEN}/guardar`, { headers: { origin: 'https://site-malicioso.com' } })
    expect(alheio.status()).toBe(403)
    const r = await request.delete(`/api/convite/${TOKEN}/guardar`, { headers: mesmoSite })
    expect(r.status()).toBe(200)
    expect(r.headers()['set-cookie']).toMatch(/corner_convite=;|corner_convite=; /)
  })
})

test.describe('POST /api/convite/<token>/aceitar', () => {
  test('sem sessão: 401', async ({ request }) => {
    expect((await request.post(`/api/convite/${TOKEN}/aceitar`, { headers: mesmoSite })).status()).toBe(401)
  })

  test('logado, de outro site ou sem Origin: 403', async ({ pagina }) => {
    expect((await pagina.request.post(`/api/convite/${TOKEN}/aceitar`, { headers: { origin: 'https://site-malicioso.com' } })).status()).toBe(403)
    expect((await pagina.request.post(`/api/convite/${TOKEN}/aceitar`)).status()).toBe(403)
  })

  test('logado, token malformado: 404 "convite_invalido" (e o cookie do convite é apagado)', async ({ pagina }) => {
    for (const t of MAL_FORMADOS) {
      const r = await pagina.request.post(`/api/convite/${t}/aceitar`, { headers: mesmoSite })
      expect(r.status(), t).toBe(404)
      expect((await r.json()).codigo).toBe('convite_invalido')
      expect(r.headers()['set-cookie'], t).toMatch(/corner_convite=;/) // o cookie do convite que não vale é apagado
    }
  })

  test('logado, token bem formado, sem o banco configurado: 503, sem repetir o token', async ({ pagina }) => {
    const r = await pagina.request.post(`/api/convite/${TOKEN}/aceitar`, { headers: mesmoSite })
    expect(r.status()).toBe(503)
    expect((await r.json()).codigo).toBe('nao_configurado')
  })
})

test.describe('/api/meu-treinador', () => {
  test('sem sessão: GET e DELETE respondem 401', async ({ request }) => {
    expect((await request.get('/api/meu-treinador')).status()).toBe(401)
    expect((await request.delete('/api/meu-treinador', { headers: mesmoSite })).status()).toBe(401)
  })

  test('logado, DELETE de outro site ou sem Origin: 403', async ({ pagina }) => {
    expect((await pagina.request.delete('/api/meu-treinador', { headers: { origin: 'https://site-malicioso.com' } })).status()).toBe(403)
    expect((await pagina.request.delete('/api/meu-treinador')).status()).toBe(403)
  })

  test('logado, sem o banco configurado: GET responde 200 "sem treinador" (não é erro: o Perfil o consulta sempre); DELETE responde 503', async ({ pagina }) => {
    const get = await pagina.request.get('/api/meu-treinador')
    expect(get.status()).toBe(200)
    expect(get.headers()['cache-control']).toBe('no-store')
    expect(await get.json()).toEqual({ treinador: null })
    expect((await pagina.request.delete('/api/meu-treinador', { headers: mesmoSite })).status()).toBe(503)
  })
})

test.describe('proxy: a volta ao convite depois do login', () => {
  test.use({ toleraRespostaDeErro: true }) // a página do convite pode não existir ainda neste ponto: 404 é registrado no console

  test('logado, com o cookie do convite, abrir /hoje termina em /convite/<token>', async ({ pagina }) => {
    await pagina.context().addCookies([{ name: 'corner_convite', value: TOKEN, url: SITE }])
    await pagina.goto('/hoje')
    await expect(pagina).toHaveURL(`/convite/${TOKEN}`)
  })

  test('logado, com cookie malformado ou sem cookie, /hoje abre normalmente', async ({ pagina }) => {
    await pagina.context().addCookies([{ name: 'corner_convite', value: 'https://mau.com', url: SITE }])
    await pagina.goto('/hoje')
    await expect(pagina).toHaveURL('/hoje')
    await pagina.context().clearCookies({ name: 'corner_convite' })
    await pagina.goto('/hoje')
    await expect(pagina).toHaveURL('/hoje')
  })

  test('logado, com o cookie, as outras telas abrem normalmente', async ({ pagina }) => {
    await pagina.context().addCookies([{ name: 'corner_convite', value: TOKEN, url: SITE }])
    await pagina.goto('/perfil')
    await expect(pagina).toHaveURL('/perfil')
  })

  test('logado, abrir /convite/<token> NÃO volta para /hoje', async ({ pagina }) => {
    await pagina.goto(`/convite/${TOKEN}`)
    await expect(pagina).toHaveURL(`/convite/${TOKEN}`)
  })

  test('sem sessão, /convite/<token> não manda para o login', async ({ browser }) => {
    const contexto = await browser.newContext({ baseURL: SITE })
    const pagina = await contexto.newPage()
    await pagina.goto(`/convite/${TOKEN}`)
    await expect(pagina).toHaveURL(`/convite/${TOKEN}`)
    await contexto.close()
  })
})
