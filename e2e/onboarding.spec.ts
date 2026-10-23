import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { SEM_ASSINATURA_TESTE, simularEstado } from './assinatura-simulada'
import { expect, lerJson, test } from './fixtures'

// A jornada de onboarding: cadastro (passo 1, público) e nível, dias e plano (passos 2 a 4, logados).
// O servidor de teste sobe SEM o Supabase, então criar conta de verdade não é testado aqui: o cadastro responde
// "indisponível" e o resto do fluxo usa o usuário de teste já logado. Criar conta no Supabase real é conferido por
// `npm run supabase:fumaca`.

const continuar = (p: Page) => p.getByRole('button', { name: /Continuar/ })
const opcao = (p: Page, nome: string | RegExp) => p.getByRole('radio', { name: nome })

async function esperarAnimacoes(p: Page) {
  await p.evaluate(() => Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime ?? Infinity)).map(a => a.finished.catch(() => undefined))))
}
async function violacoes(p: Page) {
  await esperarAnimacoes(p)
  const r = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return r.violations.map(v => `${v.id} (${v.impact}): ${v.help}\n${v.nodes.slice(0, 3).map(n => `   - ${n.target.join(' ')}`).join('\n')}`)
}

/** Percorre os passos 2 e 3 e chega ao plano recomendado. */
async function ate_o_plano(p: Page, nivel: string | RegExp, dias: number) {
  await p.goto('/onboarding/nivel')
  await opcao(p, nivel).click()
  await continuar(p).click()
  await p.waitForURL('**/onboarding/frequencia')
  await opcao(p, `${dias} dias por semana`).click()
  await continuar(p).click()
  await p.waitForURL('**/onboarding/plano')
}

test.describe('onboarding sem estar logado', () => {
  test('a tela de cadastro é pública, com nome, e-mail, senha e o link para entrar', async ({ page }) => {
    await page.goto('/onboarding')
    await expect(page).toHaveTitle('Criar conta · Corner')
    await expect(page.getByRole('heading', { name: 'Crie a sua conta' })).toBeVisible()
    await expect(page.getByLabel('Nome completo')).toBeVisible()
    await expect(page.getByLabel('E-mail')).toBeVisible()
    await expect(page.getByLabel('Senha', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /Continuar/ })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login')
  })

  test('dados inválidos mostram o erro de cada campo, sem sair da tela', async ({ page }) => {
    await page.goto('/onboarding')
    await continuar(page).click()
    await expect(page.getByText('Digite o seu nome completo.')).toBeVisible()
    await expect(page.getByText('Digite um e-mail válido.')).toBeVisible()
    await expect(page.getByText('A senha precisa ter pelo menos 8 caracteres.')).toBeVisible()
    await expect(page.getByLabel('Nome completo')).toHaveAttribute('aria-invalid', 'true')
    await expect(page).toHaveURL(/\/onboarding$/)
  })

  test('com o cadastro desligado: mensagem clara, o que foi digitado fica e a senha NÃO volta ao campo', async ({ page }) => {
    await page.goto('/onboarding')
    await page.getByLabel('Nome completo').fill('Ana Souza')
    await page.getByLabel('E-mail').fill('ana@exemplo.com')
    await page.getByLabel('Senha', { exact: true }).fill('senha-forte-123')
    await continuar(page).click()
    await expect(page.getByText('O cadastro ainda não está disponível neste ambiente.')).toBeVisible()
    await expect(page.getByLabel('Nome completo')).toHaveValue('Ana Souza')
    await expect(page.getByLabel('E-mail')).toHaveValue('ana@exemplo.com')
    await expect(page.getByLabel('Senha', { exact: true })).toHaveValue('')
  })

  test('mostrar e ocultar a senha', async ({ page }) => {
    await page.goto('/onboarding')
    const senha = page.getByLabel('Senha', { exact: true })
    await expect(senha).toHaveAttribute('type', 'password')
    await page.getByRole('button', { name: 'Mostrar senha' }).click()
    await expect(senha).toHaveAttribute('type', 'text')
    await page.getByRole('button', { name: 'Ocultar senha' }).click()
    await expect(senha).toHaveAttribute('type', 'password')
  })

  test('os passos seguintes exigem login', async ({ page }) => {
    for (const rota of ['/onboarding/nivel', '/onboarding/frequencia', '/onboarding/plano']) {
      await page.goto(rota)
      await expect(page, rota).toHaveURL(/\/login$/)
    }
  })

  test('sem Supabase, a tela de login não oferece "Criar conta"', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Entrar', level: 2 })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Criar conta' })).toHaveCount(0)
  })

  test('a tela de cadastro passa na auditoria de acessibilidade', async ({ page }) => {
    await page.goto('/onboarding')
    expect(await violacoes(page)).toEqual([])
  })
})

test.describe('onboarding logado', () => {
  test('quem já tem conta e está logado vai direto para /hoje', async ({ pagina }) => {
    await pagina.goto('/onboarding')
    await expect(pagina).toHaveURL(/\/hoje$/)
  })

  test('intermediário, 4 dias: Base Aeróbica; salva nível, meta e plano e abre o app', async ({ pagina }) => {
    await ate_o_plano(pagina, /Intermediário/, 4)
    await expect(pagina).toHaveTitle('Seu plano · Corner')
    await expect(pagina.getByRole('heading', { name: 'Base Aeróbica' })).toBeVisible()
    await expect(pagina.getByText('6 semanas')).toBeVisible()
    await expect(pagina.getByText('4× por semana')).toBeVisible()
    await expect(pagina.getByText('faz parte da assinatura')).toHaveCount(0)

    await pagina.getByRole('button', { name: /Começar agora/ }).click()
    await pagina.waitForURL('**/hoje')
    expect(await lerJson(pagina, 'config')).toMatchObject({ experiencia: '1a3', metaSemanal: 4, onboardingFeito: true })
    expect(await lerJson(pagina, 'plano')).toMatchObject({ planoId: 'base-aerobica' })
  })

  test('iniciante com 5 dias: Fundamentos, e a meta fica em 3 (o que o plano pede), com aviso', async ({ pagina }) => {
    await ate_o_plano(pagina, /Iniciante/, 5)
    await expect(pagina.getByRole('heading', { name: 'Fundamentos' })).toBeVisible()
    await expect(pagina.getByText('4 semanas')).toBeVisible()
    await expect(pagina.getByText(/a sua meta semanal ficará em 3×/)).toBeVisible()
    await pagina.getByRole('button', { name: /Começar agora/ }).click()
    await pagina.waitForURL('**/hoje')
    expect(await lerJson(pagina, 'config')).toMatchObject({ experiencia: 'ate1', metaSemanal: 3, onboardingFeito: true })
    expect(await lerJson(pagina, 'plano')).toMatchObject({ planoId: 'fundamentos' })
  })

  test('iniciante com 2 dias (menos do que o plano pede): aviso diferente e meta de 2', async ({ pagina }) => {
    await ate_o_plano(pagina, /Iniciante/, 2)
    await expect(pagina.getByText(/Este plano pede 3× por semana e você marcou 2×/)).toBeVisible()
    await expect(pagina.getByText(/a sua meta semanal ficará em 2×/)).toBeVisible()
    await pagina.getByRole('button', { name: /Começar agora/ }).click()
    await pagina.waitForURL('**/hoje')
    expect(await lerJson(pagina, 'config')).toMatchObject({ metaSemanal: 2 })
  })

  test('quando o plano combina com os dias escolhidos, não há aviso nenhum', async ({ pagina }) => {
    await ate_o_plano(pagina, /Iniciante/, 3)
    await expect(pagina.getByRole('heading', { name: 'Fundamentos' })).toBeVisible()
    await expect(pagina.getByText(/meta semanal ficará/)).toHaveCount(0)
  })

  test('avançado: 5 dias vai para Pré-competição; 4 dias, para Técnica Avançada', async ({ pagina }) => {
    await ate_o_plano(pagina, /Avançado/, 5)
    await expect(pagina.getByRole('heading', { name: 'Pré-competição' })).toBeVisible()

    await pagina.goto('/onboarding/frequencia')
    await opcao(pagina, '4 dias por semana').click()
    await continuar(pagina).click()
    await pagina.waitForURL('**/onboarding/plano')
    await expect(pagina.getByRole('heading', { name: 'Técnica Avançada' })).toBeVisible()
  })

  test('quem está no plano gratuito vê um aviso de que o plano faz parte da assinatura, e ainda assim começa', async ({ pagina }) => {
    await simularEstado(pagina, SEM_ASSINATURA_TESTE)
    await ate_o_plano(pagina, /Intermediário/, 4)
    await expect(pagina.getByText(/faz parte da assinatura Amador/)).toBeVisible()
    await expect(pagina.getByText(/teste grátis de 7 dias, sem cartão/)).toBeVisible()
    await pagina.getByRole('button', { name: /Começar agora/ }).click()
    await pagina.waitForURL('**/hoje')
    expect(await lerJson(pagina, 'plano')).toMatchObject({ planoId: 'base-aerobica' }) // guardado; a tela só o libera na assinatura
  })

  test('o botão Continuar só vale depois de escolher, e a dica explica', async ({ pagina }) => {
    await pagina.goto('/onboarding/nivel')
    await expect(continuar(pagina)).toBeDisabled()
    await expect(pagina.getByText('Escolha uma opção para continuar.')).toBeVisible()
    await opcao(pagina, /Iniciante/).click()
    await expect(continuar(pagina)).toBeEnabled()
    await expect(opcao(pagina, /Iniciante/)).toHaveAttribute('aria-checked', 'true')
  })

  test('as três opções de nível trazem título, descrição e ícone', async ({ pagina }) => {
    await pagina.goto('/onboarding/nivel')
    await expect(pagina.getByRole('heading', { name: 'Qual é o seu nível no boxe?' })).toBeVisible()
    await expect(pagina.getByRole('radio')).toHaveCount(3)
    for (const [nome, descricao] of [['Iniciante', /menos de 1 ano/], ['Intermediário', /1 a 3 anos/], ['Avançado', /mais de 3 anos/]] as const) {
      const cartao = opcao(pagina, new RegExp(nome))
      await expect(cartao).toContainText(descricao)
      await expect(cartao.locator('i[class*="ph-"]').first()).toBeAttached()
    }
  })

  test('os dias por semana são 2, 3, 4 e 5', async ({ pagina }) => {
    await pagina.goto('/onboarding/nivel')
    await opcao(pagina, /Iniciante/).click()
    await continuar(pagina).click()
    await pagina.waitForURL('**/onboarding/frequencia')
    await expect(pagina.getByRole('heading', { name: 'Quantos dias por semana você pode treinar?' })).toBeVisible()
    await expect(pagina.getByRole('radio')).toHaveText([/2/, /3/, /4/, /5/])
  })

  test('voltar mantém a escolha anterior', async ({ pagina }) => {
    await ate_o_plano(pagina, /Intermediário/, 4)
    await pagina.getByRole('link', { name: 'Voltar' }).click()
    await pagina.waitForURL('**/onboarding/frequencia')
    await expect(opcao(pagina, '4 dias por semana')).toHaveAttribute('aria-checked', 'true')
    await pagina.getByRole('link', { name: 'Voltar' }).click()
    await pagina.waitForURL('**/onboarding/nivel')
    await expect(opcao(pagina, /Intermediário/)).toHaveAttribute('aria-checked', 'true')
  })

  test('sem escolher o nível, os passos de frequência e de plano levam de volta ao nível', async ({ pagina }) => {
    await pagina.goto('/onboarding/frequencia')
    await pagina.waitForURL('**/onboarding/nivel')
    await pagina.goto('/onboarding/plano')
    await pagina.waitForURL('**/onboarding/nivel')
  })

  test('as setas do teclado trocam a opção, como num grupo de rádio', async ({ pagina }) => {
    await pagina.goto('/onboarding/nivel')
    await opcao(pagina, /Iniciante/).focus()
    await pagina.keyboard.press('ArrowDown')
    await expect(opcao(pagina, /Intermediário/)).toHaveAttribute('aria-checked', 'true')
    await pagina.keyboard.press('ArrowDown')
    await expect(opcao(pagina, /Avançado/)).toHaveAttribute('aria-checked', 'true')
    await pagina.keyboard.press('ArrowUp')
    await expect(opcao(pagina, /Intermediário/)).toHaveAttribute('aria-checked', 'true')
  })

  test('o indicador de passos acompanha: Passo 2, 3 e 4 de 4', async ({ pagina }) => {
    await pagina.goto('/onboarding/nivel')
    await expect(pagina.getByText('Passo 2 de 4')).toBeVisible()
    await opcao(pagina, /Iniciante/).click()
    await continuar(pagina).click()
    await expect(pagina.getByText('Passo 3 de 4')).toBeVisible()
    await opcao(pagina, '3 dias por semana').click()
    await continuar(pagina).click()
    await expect(pagina.getByText('Passo 4 de 4')).toBeVisible()
  })

  test('cada passo passa na auditoria de acessibilidade', async ({ pagina }) => {
    await pagina.goto('/onboarding/nivel')
    expect(await violacoes(pagina), 'nível sem escolha').toEqual([])
    await opcao(pagina, /Intermediário/).click()
    expect(await violacoes(pagina), 'nível escolhido').toEqual([])
    await continuar(pagina).click()
    await pagina.waitForURL('**/onboarding/frequencia')
    expect(await violacoes(pagina), 'frequência sem escolha').toEqual([])
    await opcao(pagina, '4 dias por semana').click()
    expect(await violacoes(pagina), 'frequência escolhida').toEqual([])
    await continuar(pagina).click()
    await pagina.waitForURL('**/onboarding/plano')
    await expect(pagina.getByRole('heading', { name: 'Base Aeróbica' })).toBeVisible()
    expect(await violacoes(pagina), 'plano recomendado').toEqual([])
  })

  test('em tela estreita não há rolagem horizontal em nenhum passo', async ({ pagina }) => {
    await pagina.setViewportSize({ width: 320, height: 640 })
    for (const rota of ['/onboarding/nivel', '/onboarding/frequencia']) {
      await pagina.goto(rota)
      await pagina.waitForLoadState('networkidle')
      const largura = await pagina.evaluate(() => ({ doc: document.documentElement.scrollWidth, janela: window.innerWidth }))
      expect(largura.doc, rota).toBeLessThanOrEqual(largura.janela)
    }
  })
})
