import { test as base, expect, type Locator, type Page } from '@playwright/test'
import { E2E_EMAIL, E2E_SENHA, E2E_USUARIO_ID } from './constantes'

export { expect }

/** Quarta-feira, 14/10/2026, meio-dia (fuso de São Paulo). */
export const DATA_PADRAO = new Date('2026-10-14T12:00:00-03:00')

export async function entrar(page: Page) {
  await page.goto('/login')
  await page.fill('input[name=email]', E2E_EMAIL)
  await page.fill('input[name=password]', E2E_SENHA)
  await page.click('button[type=submit]')
  await page.waitForURL(u => !u.pathname.startsWith('/login'))
}

/** Dados no localStorage do usuário de teste. */
export const chave = (entidade: string) => `corner:${E2E_USUARIO_ID}:${entidade}`
export const lerRaw = (page: Page, entidade: string) => page.evaluate(k => localStorage.getItem(k), chave(entidade))
export const lerJson = async (page: Page, entidade: string) => JSON.parse((await lerRaw(page, entidade)) ?? 'null')
export const gravarRaw = (page: Page, entidade: string, valor: string) =>
  page.evaluate(([k, v]) => localStorage.setItem(k, v), [chave(entidade), valor])

export function treino(id: string, extra: Record<string, unknown> = {}) {
  return { id, data: '2026-10-10T12:00:00.000Z', tipo: 'tec', rounds: 5, minPorRound: 3, rpe: 6, duracaoSegundos: 900, ...extra }
}

export const arquivoJson = (nome: string, conteudo: unknown) => ({
  name: nome, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(conteudo)),
})

/** Contagem do histórico mostrada em /progresso ("2 treinos"). */
export const contagemDeTreinos = (page: Page): Locator => page.locator('.section-heading span', { hasText: /treinos?$/ }).first()

/**
 * `pagina`: já logada e com um vigia de erros. No fim de cada teste, qualquer erro de página ou de console
 * (inclui aviso de hidratação do React) em qualquer aba do teste faz o teste falhar.
 */
export const test = base.extend<{ pagina: Page; semRedeExterna: void }>({
  // O app carrega os ícones de unpkg.com: nos testes, qualquer domínio externo responde vazio.
  // Deixa os testes rápidos e independentes de internet (sem gerar erro de console).
  semRedeExterna: [async ({ context }, aplicar) => {
    await context.route(url => url.hostname !== 'localhost', rota => rota.fulfill({ status: 200, body: '', contentType: 'text/css', headers: { 'access-control-allow-origin': '*' } }))
    await aplicar()
  }, { auto: true }],

  pagina: async ({ page, context }, aplicar) => {
    const erros: string[] = []
    const vigiar = (p: Page) => {
      p.on('pageerror', e => erros.push(`pageerror: ${e.message}`))
      p.on('console', m => { if (m.type() === 'error') erros.push(`console: ${m.text()} (${m.location().url})`) })
      p.on('dialog', d => void d.accept()) // window.confirm da importação de backup
    }
    context.on('page', vigiar)
    vigiar(page)
    await entrar(page)
    // Data fixa (quarta-feira): alertas como "a meta está apertada" só aparecem nos últimos dias da semana,
    // e um teste que dependesse do dia real passaria de segunda a quinta e falharia de sexta a domingo.
    await page.clock.setFixedTime(DATA_PADRAO)
    await aplicar(page)
    expect(erros, 'erros de página/console durante o teste').toEqual([])
  },
})
