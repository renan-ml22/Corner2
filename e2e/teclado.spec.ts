import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

// Navegação só pelo teclado: painéis (diálogos) e controles com papel de rádio/aba.

async function abrirRegistro(pagina: Page) {
  await pagina.goto('/hoje')
  const botao = pagina.getByRole('button', { name: 'Registrar treino', exact: true })
  await botao.focus()
  await pagina.keyboard.press('Enter')
  await expect(pagina.getByRole('dialog', { name: 'Registrar treino' })).toBeVisible()
  return botao
}

const focoDentroDoDialogo = (pagina: Page) =>
  pagina.evaluate(() => !!document.activeElement && !!document.activeElement.closest('[role="dialog"]'))

test.describe('teclado: painéis', () => {
  test('ao abrir, o foco vai para dentro do painel', async ({ pagina }) => {
    await abrirRegistro(pagina)
    expect(await focoDentroDoDialogo(pagina)).toBe(true)
  })

  test('Esc fecha o painel e devolve o foco ao botão que o abriu', async ({ pagina }) => {
    const botao = await abrirRegistro(pagina)
    await pagina.keyboard.press('Escape')
    await expect(pagina.getByRole('dialog')).toHaveCount(0)
    await expect(botao).toBeFocused()
  })

  test('Tab e Shift+Tab não saem do painel (o foco circula dentro dele)', async ({ pagina }) => {
    await abrirRegistro(pagina)
    for (let i = 0; i < 14; i++) {
      await pagina.keyboard.press('Tab')
      expect(await focoDentroDoDialogo(pagina), `Tab ${i + 1}`).toBe(true)
    }
    for (let i = 0; i < 14; i++) {
      await pagina.keyboard.press('Shift+Tab')
      expect(await focoDentroDoDialogo(pagina), `Shift+Tab ${i + 1}`).toBe(true)
    }
  })

  test('o conteúdo por trás do painel fica inerte (não recebe foco nem leitor de tela)', async ({ pagina }) => {
    await abrirRegistro(pagina)
    const inerte = await pagina.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Navegação principal"]')
      return !!nav && !!nav.closest('[inert]')
    })
    expect(inerte).toBe(true)
  })

  test('é possível escolher o tipo e salvar só com o teclado', async ({ pagina }) => {
    await abrirRegistro(pagina)
    await pagina.getByRole('dialog').getByRole('button', { name: /Condicionamento/ }).focus()
    await pagina.keyboard.press('Enter')
    await expect(pagina.getByRole('dialog', { name: 'Condicionamento' })).toBeVisible()
    expect(await focoDentroDoDialogo(pagina)).toBe(true)
    await pagina.getByRole('button', { name: 'Salvar treino' }).focus()
    await pagina.keyboard.press('Enter')
    await expect(pagina.getByRole('dialog', { name: 'Concluído' })).toBeVisible()
    await pagina.getByRole('button', { name: 'Concluir' }).focus()
    await pagina.keyboard.press('Enter')
    await expect(pagina.getByRole('dialog')).toHaveCount(0)
  })

  test('Esc também fecha os painéis de alertas e de planos', async ({ pagina }) => {
    await pagina.goto('/hoje')
    await pagina.getByRole('button', { name: /^Alertas/ }).click()
    await expect(pagina.getByRole('dialog', { name: 'Alertas' })).toBeVisible()
    await pagina.keyboard.press('Escape')
    await expect(pagina.getByRole('dialog')).toHaveCount(0)
  })
})

test.describe('teclado: controles com papel próprio', () => {
  test('o foco é visível: o elemento focado tem contorno ou sombra', async ({ pagina }) => {
    await pagina.goto('/hoje')
    await pagina.keyboard.press('Tab')
    const visivel = await pagina.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el || el === document.body) return false
      const e = getComputedStyle(el)
      return (e.outlineStyle !== 'none' && parseFloat(e.outlineWidth) > 0) || e.boxShadow !== 'none'
    })
    expect(visivel).toBe(true)
  })

  test('abas da biblioteca: setas trocam de aba', async ({ pagina }) => {
    await pagina.goto('/tecnicas')
    const abas = pagina.getByRole('tablist').getByRole('tab')
    await abas.first().focus()
    await pagina.keyboard.press('ArrowRight')
    await expect(abas.nth(1)).toHaveAttribute('aria-selected', 'true')
    await pagina.keyboard.press('ArrowLeft')
    await expect(abas.first()).toHaveAttribute('aria-selected', 'true')
  })

  test('grupos de rádio do check-in: setas mudam a nota', async ({ pagina }) => {
    await pagina.goto('/hoje')
    const grupo = pagina.getByRole('radiogroup', { name: 'Como foi o sono?' })
    await grupo.getByRole('radio', { name: '3' }).focus()
    await pagina.keyboard.press('Enter')
    await expect(grupo.getByRole('radio', { name: '3' })).toHaveAttribute('aria-checked', 'true')
    await pagina.keyboard.press('ArrowRight')
    await expect(grupo.getByRole('radio', { name: '4' })).toHaveAttribute('aria-checked', 'true')
  })
})
