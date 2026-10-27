import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, lerJson, lerRaw, test } from './fixtures'
import { arquivoPng } from './imagem-de-teste'

// Foto de perfil: escolher, trocar e remover na tela de Perfil. O recorte e a redução para 200×200 acontecem de verdade
// no Chrome (canvas); o que fica guardado é o texto `data:image/jpeg;base64,…` da entidade `foto`.

const campo = (pagina: Page) => pagina.getByLabel(/^(Adicionar|Trocar) foto$/)
const foto = (pagina: Page) => pagina.getByRole('img', { name: 'Sua foto de perfil' })

async function auditar(pagina: Page) {
  await pagina.waitForLoadState('networkidle')
  const r = await new AxeBuilder({ page: pagina }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return r.violations.map(v => `${v.id} (${v.impact}): ${v.help}`)
}

test.describe('foto de perfil', () => {
  test('sem foto: mostra a inicial do nome e o botão "Adicionar foto"', async ({ pagina }) => {
    await pagina.goto('/perfil')
    await expect(foto(pagina)).toHaveCount(0)
    await expect(pagina.getByText('Adicionar foto')).toBeVisible()
    await expect(pagina.getByRole('button', { name: 'Remover foto' })).toHaveCount(0)
    expect(await lerRaw(pagina, 'foto')).toBeNull()
  })

  test('escolher uma imagem larga: recorta o centro, reduz para 200×200 em JPEG e guarda', async ({ pagina }) => {
    await pagina.goto('/perfil')
    await campo(pagina).setInputFiles(arquivoPng())

    await expect(foto(pagina)).toBeVisible()
    await expect(pagina.getByText('Foto de perfil salva')).toBeVisible()
    const tamanho = await foto(pagina).evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])
    expect(tamanho).toEqual([200, 200])

    const guardada = await lerJson(pagina, 'foto')
    expect(guardada).toMatch(/^data:image\/jpeg;base64,/)
    expect(guardada.length).toBeLessThanOrEqual(60_000)

    // O recorte é central: a imagem de 400×200 tem vermelho à esquerda e azul à direita, então o meio da foto é a divisa.
    const cores = await foto(pagina).evaluate((img: HTMLImageElement) => {
      const c = document.createElement('canvas'); c.width = 200; c.height = 200
      const ctx = c.getContext('2d')!; ctx.drawImage(img, 0, 0)
      return [Array.from(ctx.getImageData(20, 100, 1, 1).data), Array.from(ctx.getImageData(180, 100, 1, 1).data)]
    })
    expect(cores[0][0], 'lado esquerdo vermelho').toBeGreaterThan(cores[0][2])
    expect(cores[1][2], 'lado direito azul').toBeGreaterThan(cores[1][0])

    await expect(pagina.getByText('Trocar foto')).toBeVisible()
    await expect(pagina.getByRole('button', { name: 'Remover foto' })).toBeVisible()
  })

  test('a foto continua depois de recarregar a página', async ({ pagina }) => {
    await pagina.goto('/perfil')
    await campo(pagina).setInputFiles(arquivoPng('retrato.png', 200, 400))
    await expect(foto(pagina)).toBeVisible()
    await pagina.reload()
    await expect(foto(pagina)).toBeVisible()
    expect(await lerJson(pagina, 'foto')).toMatch(/^data:image\/jpeg;base64,/)
  })

  test('remover a foto volta à inicial e guarda texto vazio (para a remoção sincronizar com a conta)', async ({ pagina }) => {
    await pagina.goto('/perfil')
    await campo(pagina).setInputFiles(arquivoPng())
    await expect(foto(pagina)).toBeVisible()
    await pagina.getByRole('button', { name: 'Remover foto' }).click()
    await expect(foto(pagina)).toHaveCount(0)
    await expect(pagina.getByText('Foto removida')).toBeVisible()
    expect(await lerJson(pagina, 'foto')).toBe('')
    await expect(pagina.getByText('Adicionar foto')).toBeVisible()
  })

  test('arquivo que não é imagem: avisa e não guarda nada', async ({ pagina }) => {
    await pagina.goto('/perfil')
    await campo(pagina).setInputFiles({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('oi') })
    await expect(pagina.getByText('Escolha uma imagem.')).toBeVisible()
    expect(await lerRaw(pagina, 'foto')).toBeNull()
    await expect(foto(pagina)).toHaveCount(0)
  })

  test('imagem que o navegador não consegue ler: avisa, não guarda e mantém a foto anterior', async ({ pagina }) => {
    await pagina.goto('/perfil')
    await campo(pagina).setInputFiles(arquivoPng())
    await expect(foto(pagina)).toBeVisible()
    const anterior = await lerRaw(pagina, 'foto')

    await campo(pagina).setInputFiles({ name: 'quebrada.png', mimeType: 'image/png', buffer: Buffer.from('isto não é um png de verdade') })
    await expect(pagina.getByText(/Não foi possível ler essa imagem/)).toBeVisible()
    expect(await lerRaw(pagina, 'foto')).toBe(anterior)
    await expect(foto(pagina)).toBeVisible()
  })

  test('imagem grande demais (mais de 15 MB): avisa e não guarda', async ({ pagina }) => {
    await pagina.goto('/perfil')
    await campo(pagina).setInputFiles({ name: 'enorme.png', mimeType: 'image/png', buffer: Buffer.alloc(15_000_001) })
    await expect(pagina.getByText(/grande demais/)).toBeVisible()
    expect(await lerRaw(pagina, 'foto')).toBeNull()
  })

  test('escolher o mesmo arquivo de novo funciona (o campo é limpo depois de cada escolha)', async ({ pagina }) => {
    await pagina.goto('/perfil')
    const arquivo = arquivoPng()
    await campo(pagina).setInputFiles(arquivo)
    await expect(foto(pagina)).toBeVisible()
    await pagina.getByRole('button', { name: 'Remover foto' }).click()
    await expect(foto(pagina)).toHaveCount(0)
    await campo(pagina).setInputFiles(arquivo)
    await expect(foto(pagina)).toBeVisible()
  })

  test('acessibilidade: o campo tem nome, recebe foco pelo teclado e o axe não acha violações com e sem foto', async ({ pagina }) => {
    await pagina.goto('/perfil')
    await campo(pagina).focus()
    await expect(campo(pagina)).toBeFocused()
    expect(await auditar(pagina), 'sem foto').toEqual([])

    await campo(pagina).setInputFiles(arquivoPng())
    await expect(foto(pagina)).toBeVisible()
    expect(await auditar(pagina), 'com foto').toEqual([])
  })
})
