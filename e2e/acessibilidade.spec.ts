import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { DADOS_DE_EXEMPLO, semear } from './dados-exemplo'
import { expect, test } from './fixtures'
import { E2E_EMAIL, E2E_SENHA } from './constantes'

// Auditoria automática de acessibilidade (axe-core, regras WCAG 2.0/2.1 A e AA) em cada tela e painel.
// O axe acha o que é mecânico (contraste, nomes de botões, rótulos, papéis). Não substitui testar com
// leitor de tela e teclado de verdade, mas barra regressões.

const HOJE = new Date('2026-10-14T12:00:00-03:00')

async function auditar(pagina: Page) {
  const resultado = await new AxeBuilder({ page: pagina }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return resultado.violations.map(v => `${v.id} (${v.impact}): ${v.help}\n${v.nodes.slice(0, 4).map(n => `   - ${n.target.join(' ')}  ${(n.failureSummary ?? '').split('\n')[1] ?? ''}`).join('\n')}`)
}

test.describe('acessibilidade: telas', () => {
  test.beforeEach(async ({ pagina }) => {
    await pagina.clock.setFixedTime(HOJE)
    await semear(pagina)
  })

  for (const [nome, rota] of [
    ['Hoje', '/hoje'], ['Plano', '/plano'], ['Progresso', '/progresso'], ['Perfil', '/perfil'], ['Saúde', '/saude'],
    ['Biblioteca técnica', '/tecnicas'], ['Cronômetro (antes de começar)', '/treino?tipo=spa&rounds=3&min=2&descanso=45&nivel=intermediario'],
  ] as const) {
    test(`${nome}: sem violações do axe`, async ({ pagina }) => {
      await pagina.goto(rota)
      await pagina.waitForLoadState('networkidle')
      expect(await auditar(pagina), `violações em ${rota}`).toEqual([])
    })
  }

  test('Biblioteca técnica: todas as abas', async ({ pagina }) => {
    await pagina.goto('/tecnicas')
    const abas = pagina.getByRole('tablist').getByRole('tab')
    const n = await abas.count()
    for (let i = 0; i < n; i++) {
      await abas.nth(i).click()
      expect(await auditar(pagina), `aba ${i}`).toEqual([])
    }
  })

  test('Cronômetro: preparo, round, pausa e descanso', async ({ pagina }) => {
    await pagina.goto('/treino?tipo=spa&rounds=3&min=2&descanso=45&nivel=intermediario')
    await pagina.getByRole('button', { name: /Começar/ }).click()
    expect(await auditar(pagina), 'preparo').toEqual([])
    await pagina.getByRole('button', { name: 'Pular para a próxima fase' }).click()
    expect(await auditar(pagina), 'round').toEqual([])
    await pagina.getByRole('button', { name: 'Pausar' }).click()
    expect(await auditar(pagina), 'pausado').toEqual([])
    await pagina.getByRole('button', { name: 'Retomar' }).click()
    await pagina.getByRole('button', { name: 'Pular para a próxima fase' }).click()
    expect(await auditar(pagina), 'descanso').toEqual([])
  })
})

test.describe('acessibilidade: estados vazios', () => {
  for (const [nome, rota] of [['Hoje', '/hoje'], ['Plano', '/plano'], ['Progresso', '/progresso'], ['Saúde', '/saude']] as const) {
    test(`${nome} sem dados: sem violações do axe`, async ({ pagina }) => {
      await pagina.goto(rota)
      await pagina.waitForLoadState('networkidle')
      expect(await auditar(pagina), `violações em ${rota}`).toEqual([])
    })
  }
})

test.describe('acessibilidade: painéis', () => {
  test.beforeEach(async ({ pagina }) => {
    await pagina.clock.setFixedTime(HOJE)
    await semear(pagina)
  })

  test('registrar treino: tipo, detalhes (técnica e sparring) e concluído', async ({ pagina }) => {
    await pagina.goto('/hoje')
    await pagina.getByRole('button', { name: 'Registrar treino', exact: true }).click()
    expect(await auditar(pagina), 'escolha do tipo').toEqual([])
    await pagina.getByRole('dialog').getByRole('button', { name: /Técnica/ }).click()
    expect(await auditar(pagina), 'detalhes da técnica').toEqual([])
    await pagina.getByRole('dialog').getByRole('button', { name: 'Voltar' }).click()
    await pagina.getByRole('dialog').getByRole('button', { name: /Sparring/ }).click()
    await pagina.getByRole('radiogroup', { name: 'Pancadas na cabeça' }).getByRole('radio', { name: 'Fortes' }).click()
    expect(await auditar(pagina), 'detalhes do sparring').toEqual([])
    await pagina.getByRole('button', { name: 'Salvar treino' }).click()
    expect(await auditar(pagina), 'concluído com aviso de cabeça').toEqual([])
  })

  test('alertas e escolha de plano', async ({ pagina }) => {
    await pagina.goto('/hoje')
    await pagina.getByRole('button', { name: /^Alertas/ }).click()
    expect(await auditar(pagina), 'alertas').toEqual([])
    await pagina.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click()
    await pagina.goto('/plano')
    await pagina.getByRole('button', { name: 'Trocar' }).click()
    expect(await auditar(pagina), 'escolher plano').toEqual([])
  })

  test('perfil de atleta: os cinco passos', async ({ pagina }) => {
    await pagina.goto('/perfil')
    await pagina.getByRole('button', { name: /perfil de atleta/ }).click()
    const d = pagina.getByRole('dialog', { name: 'Perfil de atleta' })
    expect(await auditar(pagina), 'passo 1').toEqual([])
    await d.getByRole('button', { name: /Canhoto/ }).click()
    expect(await auditar(pagina), 'passo 2').toEqual([])
    await d.getByRole('button', { name: 'Mais de 3 anos ou já compito' }).click()
    expect(await auditar(pagina), 'passo 3').toEqual([])
    await d.getByRole('button', { name: /Competir/ }).click()
    expect(await auditar(pagina), 'passo 4').toEqual([])
    await d.getByRole('button', { name: 'Ver plano recomendado' }).click()
    expect(await auditar(pagina), 'passo 5').toEqual([])
  })
})

test.describe('acessibilidade: login', () => {
  test('login e login com erro: sem violações do axe', async ({ page }) => {
    await page.route(url => url.hostname !== 'localhost', rota => rota.fulfill({ status: 200, body: '' }))
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    expect(await auditar(page), 'login').toEqual([])
    await page.fill('input[name=email]', E2E_EMAIL)
    await page.fill('input[name=password]', E2E_SENHA + 'x')
    await page.click('button[type=submit]')
    await page.getByText(/incorret/i).first().waitFor()
    expect(await auditar(page), 'login com erro').toEqual([])
  })
})

// Garante que os dados de exemplo cobrem o que a auditoria precisa ver.
test('os dados de exemplo têm plano, lesão ativa e pesos', () => {
  expect(DADOS_DE_EXEMPLO.plano).toBeTruthy()
  expect(Object.keys(DADOS_DE_EXEMPLO)).toEqual(expect.arrayContaining(['historico', 'lesoes', 'pesos', 'checkins']))
})
