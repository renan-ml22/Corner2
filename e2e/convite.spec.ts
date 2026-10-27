import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { E2E_EMAIL, E2E_PORTA, E2E_SENHA } from './constantes'
import { TOKEN_DO_CONVITE as TOKEN, simularConvite } from './convite-simulado'
import { expect, test } from './fixtures'

// O lado do aluno: a página pública do convite (/convite/<token>) e o cartão "Meu treinador" no Perfil.
// A API é simulada (e2e/convite-simulado.ts); as regras do servidor têm testes próprios.

const SITE = `http://localhost:${E2E_PORTA}`

async function auditar(pagina: Page) {
  await pagina.waitForLoadState('networkidle')
  const r = await new AxeBuilder({ page: pagina }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return r.violations.map(v => `${v.id} (${v.impact}): ${v.help}`)
}

const alerta = (pagina: Page) => pagina.locator('[role="alert"]:not(#__next-route-announcer__)')

/** Uma página SEM sessão (o aluno que ainda não entrou), com a API do convite simulada. */
async function paginaSemSessao(browser: import('@playwright/test').Browser, opcoes: Parameters<typeof simularConvite>[1] = {}) {
  const contexto = await browser.newContext({ baseURL: SITE, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', viewport: { width: 420, height: 880 }, serviceWorkers: 'block' })
  await contexto.route(url => url.hostname !== 'localhost', rota => rota.fulfill({ status: 200, body: '', contentType: 'text/css', headers: { 'access-control-allow-origin': '*' } }))
  const pagina = await contexto.newPage()
  const api = await simularConvite(pagina, { logado: false, ...opcoes })
  return { pagina, api, fechar: () => contexto.close() }
}

test.describe('convite: quem ainda não entrou', () => {
  test('convite válido: apresenta o treinador, o que ele poderá ver e o que nunca verá, com "Entrar" e "Criar conta"', async ({ browser }) => {
    const { pagina, fechar } = await paginaSemSessao(browser)
    await pagina.goto(`/convite/${TOKEN}`)
    await expect(pagina.getByRole('heading', { name: 'Marcos convidou você para treinar junto no Corner', level: 1 })).toBeVisible()
    const podeVer = pagina.getByRole('region', { name: 'O que o treinador poderá ver' })
    for (const item of ['Seu nome, foto, nível e estilo', 'O resultado do quiz de estilo', 'Seu plano de treino ativo', 'Seus treinos dos últimos 30 dias: data, tipo, rounds, esforço e duração']) {
      await expect(podeVer).toContainText(item)
    }
    const nuncaVe = pagina.getByRole('region', { name: 'O que ele nunca verá' })
    for (const item of ['Lesões', 'Peso e categoria', 'Check-ins diários', 'Pancadas na cabeça']) await expect(nuncaVe).toContainText(item)
    await expect(pagina.getByText('Você pode se desvincular quando quiser, em Perfil › Meu treinador.')).toBeVisible()
    await expect(pagina.getByRole('button', { name: 'Entrar' })).toBeVisible()
    await expect(pagina.getByRole('button', { name: 'Criar conta' })).toBeVisible()
    await expect(pagina.getByRole('button', { name: 'Aceitar convite' })).toHaveCount(0)
    await fechar()
  })

  test('nada do aluno nem de outras pessoas aparece: só o primeiro nome do treinador', async ({ browser }) => {
    const { pagina, fechar } = await paginaSemSessao(browser, { treinador: 'Marcos' })
    await pagina.goto(`/convite/${TOKEN}`)
    await expect(pagina.getByRole('heading', { level: 1 })).toBeVisible()
    const texto = await pagina.locator('main').innerText()
    expect(texto).not.toMatch(/@|\bBeto\b|Silva/)
    await fechar()
  })

  test('"Entrar" guarda o convite (um POST) e leva ao login; "Criar conta" leva ao cadastro', async ({ browser }) => {
    const entrar = await paginaSemSessao(browser)
    await entrar.pagina.goto(`/convite/${TOKEN}`)
    await entrar.pagina.getByRole('button', { name: 'Entrar' }).click()
    await expect(entrar.pagina).toHaveURL('/login')
    expect(entrar.api.escritas()).toEqual([{ metodo: 'POST', caminho: `/api/convite/${TOKEN}/guardar` }])
    await entrar.fechar()

    const criar = await paginaSemSessao(browser)
    await criar.pagina.goto(`/convite/${TOKEN}`)
    await criar.pagina.getByRole('button', { name: 'Criar conta' }).click()
    await expect(criar.pagina).toHaveURL('/onboarding')
    expect(criar.api.escritas()).toEqual([{ metodo: 'POST', caminho: `/api/convite/${TOKEN}/guardar` }])
    await criar.fechar()
  })

  test('convite inválido (e token malformado): "Convite inválido ou expirado.", sem botões de aceitar, e o cookie velho é apagado', async ({ browser }) => {
    for (const token of [TOKEN, 'abc', 'A'.repeat(44)]) {
      const { pagina, api, fechar } = await paginaSemSessao(browser, { valido: false })
      await pagina.goto(`/convite/${token}`)
      await expect(pagina.getByRole('heading', { name: 'Convite inválido ou expirado.', level: 1 })).toBeVisible()
      await expect(pagina.getByRole('link', { name: 'Ir para o Corner' })).toHaveAttribute('href', '/hoje')
      await expect(pagina.getByRole('button', { name: /Entrar|Criar conta|Aceitar convite/ })).toHaveCount(0)
      await expect.poll(() => api.escritas().map(p => p.metodo)).toEqual(['DELETE'])
      await fechar()
    }
  })

  test('acessibilidade (axe), 360 px sem rolagem horizontal e teclado: válido e inválido', async ({ browser }) => {
    const valido = await paginaSemSessao(browser)
    await valido.pagina.setViewportSize({ width: 360, height: 800 })
    await valido.pagina.goto(`/convite/${TOKEN}`)
    await expect(valido.pagina.getByRole('button', { name: 'Entrar' })).toBeVisible()
    expect(await auditar(valido.pagina), 'válido').toEqual([])
    expect(await valido.pagina.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
    await valido.pagina.getByRole('button', { name: 'Entrar' }).focus()
    await valido.pagina.keyboard.press('Enter')
    await expect(valido.pagina).toHaveURL('/login')
    await valido.fechar()

    const invalido = await paginaSemSessao(browser, { valido: false })
    await invalido.pagina.goto(`/convite/${TOKEN}`)
    await expect(invalido.pagina.getByRole('heading', { name: 'Convite inválido ou expirado.' })).toBeVisible()
    expect(await auditar(invalido.pagina), 'inválido').toEqual([])
    await invalido.fechar()
  })
})

test.describe('convite: quem já entrou', () => {
  test('aceitar: UM pedido, mensagem de sucesso e o caminho para o Corner; duplo clique não repete', async ({ pagina }) => {
    const api = await simularConvite(pagina, { atrasoMs: 400 })
    await pagina.goto(`/convite/${TOKEN}`)
    await pagina.getByRole('button', { name: 'Aceitar convite' }).dblclick()
    await expect(pagina.getByText('Pronto! Você agora treina com Marcos.')).toBeVisible()
    await expect(pagina.getByRole('link', { name: 'Ir para o Corner' })).toHaveAttribute('href', '/hoje')
    expect(api.escritas()).toEqual([{ metodo: 'POST', caminho: `/api/convite/${TOKEN}/aceitar` }])
  })

  test('"Agora não": apaga o cookie do convite e vai para o Corner', async ({ pagina }) => {
    const api = await simularConvite(pagina)
    await pagina.goto(`/convite/${TOKEN}`)
    await pagina.getByRole('button', { name: 'Agora não' }).click()
    await expect(pagina).toHaveURL('/hoje')
    expect(api.escritas()).toEqual([{ metodo: 'DELETE', caminho: `/api/convite/${TOKEN}/guardar` }])
  })

  test('a volta pelo login: com o cookie do convite, /hoje termina no convite, que oferece "Aceitar convite"', async ({ pagina }) => {
    await simularConvite(pagina)
    await pagina.context().addCookies([{ name: 'corner_convite', value: TOKEN, url: SITE }])
    await pagina.goto('/hoje')
    await expect(pagina).toHaveURL(`/convite/${TOKEN}`)
    await expect(pagina.getByRole('button', { name: 'Aceitar convite' })).toBeVisible()
  })

  test('não pede para entrar de novo: sem os botões "Entrar" e "Criar conta"', async ({ pagina }) => {
    await simularConvite(pagina)
    await pagina.goto(`/convite/${TOKEN}`)
    await expect(pagina.getByRole('button', { name: 'Aceitar convite' })).toBeVisible()
    await expect(pagina.getByRole('button', { name: 'Entrar' })).toHaveCount(0)
    await expect(pagina.getByRole('button', { name: 'Criar conta' })).toHaveCount(0)
  })

  test('acessibilidade (axe): convite válido logado e depois de aceitar', async ({ pagina }) => {
    await simularConvite(pagina)
    await pagina.goto(`/convite/${TOKEN}`)
    await expect(pagina.getByRole('button', { name: 'Aceitar convite' })).toBeVisible()
    expect(await auditar(pagina), 'logado').toEqual([])
    await pagina.getByRole('button', { name: 'Aceitar convite' }).click()
    await expect(pagina.getByText('Pronto! Você agora treina com Marcos.')).toBeVisible()
    expect(await auditar(pagina), 'aceito').toEqual([])
  })
})

test.describe('convite: erros de propósito', () => {
  test.use({ toleraRespostaDeErro: true })

  test('já tem treinador (409): mostra a mensagem do servidor e leva ao Perfil', async ({ pagina }) => {
    await simularConvite(pagina, { aceitar: { status: 409, json: { erro: 'Você já tem um treinador. Desvincule-se dele no Perfil antes de aceitar outro convite.', codigo: 'ja_tem_treinador' } } })
    await pagina.goto(`/convite/${TOKEN}`)
    await pagina.getByRole('button', { name: 'Aceitar convite' }).click()
    await expect(alerta(pagina)).toContainText('Você já tem um treinador.')
    await expect(pagina.getByRole('link', { name: 'Ir para o Perfil' })).toHaveAttribute('href', '/perfil')
  })

  test('o próprio convite (400): mostra a mensagem', async ({ pagina }) => {
    await simularConvite(pagina, { aceitar: { status: 400, json: { erro: 'Você não pode aceitar o seu próprio convite.', codigo: 'proprio_convite' } } })
    await pagina.goto(`/convite/${TOKEN}`)
    await pagina.getByRole('button', { name: 'Aceitar convite' }).click()
    await expect(alerta(pagina)).toContainText('Você não pode aceitar o seu próprio convite.')
  })

  test('convite que deixou de valer (404): "Convite inválido ou expirado."', async ({ pagina }) => {
    await simularConvite(pagina, { aceitar: { status: 404, json: { erro: 'Convite inválido ou expirado.', codigo: 'convite_invalido' } } })
    await pagina.goto(`/convite/${TOKEN}`)
    await pagina.getByRole('button', { name: 'Aceitar convite' }).click()
    await expect(alerta(pagina)).toContainText('Convite inválido ou expirado.')
  })

  test('sem conexão: mensagem de rede e o botão continua disponível', async ({ pagina }) => {
    await simularConvite(pagina, { falhaDeRede: true })
    await pagina.goto(`/convite/${TOKEN}`)
    await pagina.getByRole('button', { name: 'Aceitar convite' }).click()
    await expect(alerta(pagina)).toHaveText('Sem conexão. Verifique a internet e tente de novo.')
    await expect(pagina.getByRole('button', { name: 'Aceitar convite' })).toBeEnabled()
  })
})

test.describe('Meu treinador (Perfil)', () => {
  test('com treinador: cartão com o nome, o que ele vê e "Desvincular"; confirmar faz DELETE, avisa e o cartão some', async ({ pagina }) => {
    const api = await simularConvite(pagina, { meuTreinador: { nome: 'Marcos' } })
    await pagina.goto('/perfil')
    const cartao = pagina.getByRole('region', { name: 'Meu treinador' })
    await expect(cartao).toContainText('Marcos')
    await expect(cartao).toContainText('Ele vê o seu nome, foto, nível, estilo, quiz, plano e os treinos dos últimos 30 dias.')

    const perguntas: string[] = []
    pagina.removeAllListeners('dialog')
    pagina.on('dialog', d => { perguntas.push(d.message()); void d.accept() })
    await cartao.getByRole('button', { name: 'Desvincular' }).click()
    await expect(pagina.getByText('Você se desvinculou do seu treinador')).toBeVisible()
    await expect(cartao).toHaveCount(0)
    expect(perguntas).toEqual(['Desvincular de Marcos? Ele deixa de ver os seus treinos. Você pode aceitar outro convite depois.'])
    expect(api.escritas()).toEqual([{ metodo: 'DELETE', caminho: '/api/meu-treinador' }])
  })

  test('cancelar a confirmação não faz nada', async ({ pagina }) => {
    const api = await simularConvite(pagina, { meuTreinador: { nome: 'Marcos' } })
    await pagina.goto('/perfil')
    pagina.removeAllListeners('dialog')
    pagina.once('dialog', d => void d.dismiss())
    await pagina.getByRole('button', { name: 'Desvincular' }).click()
    await expect(pagina.getByRole('region', { name: 'Meu treinador' })).toBeVisible()
    expect(api.escritas()).toEqual([])
  })

  test('sem treinador: o cartão não existe (nada de "null" na tela)', async ({ pagina }) => {
    await simularConvite(pagina, { meuTreinador: null })
    await pagina.goto('/perfil')
    await expect(pagina.getByRole('heading', { name: 'Perfil', level: 1 })).toBeVisible()
    await expect(pagina.getByRole('region', { name: 'Meu treinador' })).toHaveCount(0)
    await expect(pagina.getByText(/null|undefined/)).toHaveCount(0)
  })

  test('acessibilidade (axe) e 360 px', async ({ pagina }) => {
    await simularConvite(pagina, { meuTreinador: { nome: 'Marcos' } })
    await pagina.setViewportSize({ width: 360, height: 800 })
    await pagina.goto('/perfil')
    await expect(pagina.getByRole('region', { name: 'Meu treinador' })).toBeVisible()
    expect(await auditar(pagina)).toEqual([])
    expect(await pagina.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  })
})

test.describe('Meu treinador: erros de propósito', () => {
  test.use({ toleraRespostaDeErro: true })

  test('sem conexão ao desvincular: mantém o cartão e mostra a mensagem', async ({ pagina }) => {
    await simularConvite(pagina, { meuTreinador: { nome: 'Marcos' } })
    await pagina.goto('/perfil')
    await expect(pagina.getByRole('region', { name: 'Meu treinador' })).toBeVisible()
    await simularConvite(pagina, { meuTreinador: { nome: 'Marcos' }, falhaDeRede: true }) // a rota registrada por último vale primeiro
    await pagina.getByRole('button', { name: 'Desvincular' }).click()
    await expect(alerta(pagina)).toHaveText('Sem conexão. Verifique a internet e tente de novo.')
    await expect(pagina.getByRole('region', { name: 'Meu treinador' })).toBeVisible()
  })
})

test.describe('convite: o login de verdade leva de volta ao convite', () => {
  // A Server Action do login redireciona direto para /convite/<token> quando há o cookie do convite. Redirecionar para /hoje e
  // deixar o proxy desviar faria a tela do convite aparecer sob o endereço /hoje (a Server Action busca o destino por dentro).
  test('com o cookie do convite, entrar pelo formulário termina em /convite/<token> e fica lá', async ({ browser }) => {
    const contexto = await browser.newContext({ baseURL: SITE, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', serviceWorkers: 'block' })
    await contexto.route(url => url.hostname !== 'localhost', rota => rota.fulfill({ status: 200, body: '', contentType: 'text/css', headers: { 'access-control-allow-origin': '*' } }))
    await contexto.addCookies([{ name: 'corner_convite', value: TOKEN, url: SITE }])
    const pagina = await contexto.newPage()
    await pagina.goto('/login')
    await pagina.fill('input[name=email]', E2E_EMAIL)
    await pagina.fill('input[name=password]', E2E_SENHA)
    await pagina.click('button[type=submit]')
    await expect(pagina).toHaveURL(`/convite/${TOKEN}`)
    await expect(pagina.getByRole('heading', { name: 'Convite inválido ou expirado.', level: 1 })).toBeVisible() // a página do convite (a API real, sem banco, diz que não vale)
    await pagina.waitForTimeout(1200)
    expect(new URL(pagina.url()).pathname).toBe(`/convite/${TOKEN}`) // o endereço não "volta" para /hoje
    await contexto.close()
  })

  test('sem o cookie, ou com cookie malformado, entrar leva a /hoje como sempre', async ({ browser }) => {
    for (const cookie of [null, 'https://mau.com', '../x']) {
      const contexto = await browser.newContext({ baseURL: SITE, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', serviceWorkers: 'block' })
      await contexto.route(url => url.hostname !== 'localhost', rota => rota.fulfill({ status: 200, body: '', contentType: 'text/css', headers: { 'access-control-allow-origin': '*' } }))
      if (cookie) await contexto.addCookies([{ name: 'corner_convite', value: cookie, url: SITE }])
      const pagina = await contexto.newPage()
      await pagina.goto('/login')
      await pagina.fill('input[name=email]', E2E_EMAIL)
      await pagina.fill('input[name=password]', E2E_SENHA)
      await pagina.click('button[type=submit]')
      await expect(pagina, String(cookie)).toHaveURL('/hoje')
      await contexto.close()
    }
  })
})
