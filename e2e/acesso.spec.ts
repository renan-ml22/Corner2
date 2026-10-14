import { E2E_EMAIL } from './constantes'
import { entrar, expect, test } from './fixtures'

test.describe('acesso', () => {
  test('rotas protegidas mandam para o login quando não há sessão', async ({ page }) => {
    for (const rota of ['/hoje', '/plano', '/progresso', '/perfil', '/treino', '/tecnicas', '/saude']) {
      await page.goto(rota)
      expect(new URL(page.url()).pathname, rota).toBe('/login')
    }
  })

  test('arquivos do modo offline abrem sem login', async ({ request }) => {
    for (const arquivo of ['/sw.js', '/offline.html', '/manifest.json', '/icon-192.png']) {
      expect((await request.get(arquivo)).status(), arquivo).toBe(200)
    }
  })

  test('senha errada não entra e mostra o erro', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[name=email]', E2E_EMAIL)
    await page.fill('input[name=password]', 'senha-errada')
    await page.click('button[type=submit]')
    await expect(page.getByText(/incorret/i).first()).toBeVisible()
    expect(new URL(page.url()).pathname).toBe('/login')
  })

  test('login com a senha certa entra no app e as telas abrem', async ({ page }) => {
    await entrar(page)
    for (const rota of ['/hoje', '/plano', '/progresso', '/perfil', '/tecnicas', '/saude']) {
      await page.goto(rota)
      expect(new URL(page.url()).pathname, rota).toBe(rota)
    }
  })

  test('sair da conta volta ao login e fecha as rotas', async ({ page }) => {
    await entrar(page)
    await page.goto('/perfil')
    await page.getByRole('button', { name: /Sair da conta/ }).click()
    await page.waitForURL(/\/login/)
    await page.goto('/hoje')
    expect(new URL(page.url()).pathname).toBe('/login')
  })
})
