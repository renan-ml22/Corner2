import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

// Métricas de produto (PostHog). O servidor de teste é construído SEM chave do PostHog (veja playwright.config.ts),
// e o app tem que funcionar igual: nada é carregado, nada é enviado, nada é guardado no aparelho.
// Que cada evento sai com as propriedades certas é conferido em tests/analytics*.test.ts e, com uma chave de mentira
// e a rede interceptada, no roteiro descrito em docs/plano-posthog.md.

function vigiarRede(pagina: Page) {
  const enderecos: string[] = []
  pagina.on('request', r => enderecos.push(r.url()))
  return { doPostHog: () => enderecos.filter(u => /posthog/i.test(u)) }
}

const chavesDoPostHog = (pagina: Page) => pagina.evaluate(() => Object.keys(localStorage).filter(k => /posthog|^ph_/i.test(k)))

test.describe('sem a chave do PostHog, nada é rastreado', () => {
  test('visitar as telas, trocar de aba e abrir painéis não gera nenhum pedido ao PostHog', async ({ pagina }) => {
    const rede = vigiarRede(pagina)
    await pagina.goto('/hoje')
    await pagina.getByRole('link', { name: 'Progresso' }).click()
    await pagina.waitForURL('**/progresso')
    await pagina.getByRole('link', { name: 'Perfil' }).click()
    await pagina.waitForURL('**/perfil')
    await pagina.getByRole('button', { name: 'Registrar treino' }).click()
    await expect(pagina.getByRole('dialog')).toBeVisible()
    await pagina.waitForTimeout(3500) // o PostHog junta eventos e envia em lotes: se existisse, já teria enviado
    expect(rede.doPostHog()).toEqual([])
  })

  test('o cliente do PostHog não existe na página e nada dele é guardado no aparelho', async ({ pagina }) => {
    await pagina.goto('/hoje')
    expect(await pagina.evaluate(() => 'posthog' in window)).toBe(false)
    expect(await chavesDoPostHog(pagina)).toEqual([])
  })

  test('a tela de cadastro e os passos do onboarding também não enviam nada', async ({ page }) => {
    const rede = vigiarRede(page)
    await page.goto('/onboarding')
    await expect(page.getByRole('heading', { name: 'Crie a sua conta' })).toBeVisible()
    await page.waitForTimeout(3500)
    expect(rede.doPostHog()).toEqual([])
    expect(await chavesDoPostHog(page)).toEqual([])
  })
})
