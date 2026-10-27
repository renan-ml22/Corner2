import { SEM_ASSINATURA_TESTE, ativa, cancelada, emTeste, simularEstado, simularPagamento } from './assinatura-simulada'
import { expect, test } from './fixtures'

const plano = (pagina: import('@playwright/test').Page, nome: string) => pagina.getByRole('article', { name: `Plano ${nome}` })

test.describe('tela de assinatura: sem o pagamento ligado (sem chave do Stripe)', () => {
  test('avisa que o pagamento não está disponível e que tudo está liberado; os botões ficam desligados', async ({ pagina }) => {
    await simularEstado(pagina, 'indisponivel')
    await pagina.goto('/assinatura')
    await expect(pagina.getByText('Pagamento ainda não disponível')).toBeVisible()
    await expect(pagina.getByText(/todos os recursos do Corner estão liberados/)).toBeVisible()
    for (const nome of ['Iniciante', 'Amador', 'Cornerman', 'Profissional']) {
      await expect(plano(pagina, nome).getByRole('button')).toBeDisabled()
    }
  })

  test('mesmo assim mostra os preços (para saber como será a cobrança)', async ({ pagina }) => {
    await simularEstado(pagina, 'indisponivel')
    await pagina.goto('/assinatura')
    await expect(plano(pagina, 'Amador')).toContainText('R$ 52,90')
  })
})

test.describe('tela de assinatura: quem não assina (plano gratuito)', () => {
  test.beforeEach(async ({ pagina }) => {
    await simularEstado(pagina, SEM_ASSINATURA_TESTE)
  })

  test('mostra o plano gratuito, os 4 planos e os preços mensais corretos', async ({ pagina }) => {
    await pagina.goto('/assinatura')
    await expect(pagina.getByRole('heading', { name: 'Assinatura', level: 1 })).toBeVisible()
    await expect(pagina.getByRole('region', { name: 'Sua assinatura' })).toContainText('Plano gratuito')
    await expect(plano(pagina, 'Iniciante')).toContainText('R$ 39,90')
    await expect(plano(pagina, 'Amador')).toContainText('R$ 52,90')
    await expect(plano(pagina, 'Cornerman')).toContainText('R$ 63,90')
    await expect(plano(pagina, 'Profissional')).toContainText('R$ 69,90')
    await expect(pagina.getByRole('region', { name: 'Plano gratuito' })).toContainText('Cronômetro de rounds')
    await expect(plano(pagina, 'Iniciante').getByRole('button')).toHaveText('Começar 7 dias grátis')
  })

  test('a alternância para anual mostra os preços anuais, o equivalente por mês e a economia', async ({ pagina }) => {
    await pagina.goto('/assinatura')
    await pagina.getByRole('radio', { name: 'Anual' }).click()
    await expect(plano(pagina, 'Iniciante')).toContainText('R$ 399,00')
    await expect(plano(pagina, 'Amador')).toContainText('R$ 529,00')
    await expect(plano(pagina, 'Cornerman')).toContainText('R$ 639,00')
    await expect(plano(pagina, 'Cornerman')).toContainText('equivale a R$ 53,25 por mês')
    await expect(plano(pagina, 'Profissional')).toContainText('R$ 699,00')
    await expect(plano(pagina, 'Iniciante')).toContainText('equivale a R$ 33,25 por mês')
    await expect(plano(pagina, 'Amador')).toContainText('17% de economia')
    await pagina.getByRole('radio', { name: 'Mensal' }).click()
    await expect(plano(pagina, 'Amador')).toContainText('R$ 52,90')
  })

  test('cada plano lista o que acrescenta e cita o anterior', async ({ pagina }) => {
    await pagina.goto('/assinatura')
    await expect(plano(pagina, 'Iniciante')).toContainText('Tudo do plano gratuito')
    await expect(plano(pagina, 'Iniciante')).toContainText('Biblioteca técnica')
    await expect(plano(pagina, 'Amador')).toContainText('Tudo do Iniciante')
    await expect(plano(pagina, 'Amador')).toContainText('Check-in diário')
    await expect(plano(pagina, 'Cornerman')).toContainText('Tudo do Amador')
    await expect(plano(pagina, 'Cornerman')).toContainText('Gestão de alunos')
    await expect(plano(pagina, 'Profissional')).toContainText('Tudo do Cornerman')
    await expect(plano(pagina, 'Profissional')).toContainText('Pré-competição')
  })

  test('as setas trocam entre mensal e anual', async ({ pagina }) => {
    await pagina.goto('/assinatura')
    await pagina.getByRole('radio', { name: 'Mensal' }).focus()
    await pagina.keyboard.press('ArrowRight')
    await expect(pagina.getByRole('radio', { name: 'Anual' })).toHaveAttribute('aria-checked', 'true')
  })

  test('"Começar 7 dias grátis" pede o checkout do plano e período escolhidos e leva para o endereço devolvido', async ({ pagina }) => {
    const { checkout } = await simularPagamento(pagina)
    await pagina.goto('/assinatura')
    await plano(pagina, 'Amador').getByRole('button').click()
    await expect(pagina.getByText('Você saiu do pagamento sem concluir. Nada foi cobrado.')).toBeVisible()
    expect(checkout).toHaveLength(1)
    expect(checkout[0].corpo).toEqual({ nivel: 'amador', periodo: 'mensal' })
  })

  test('com o período anual escolhido, o pedido leva "anual"', async ({ pagina }) => {
    const { checkout } = await simularPagamento(pagina)
    await pagina.goto('/assinatura')
    await pagina.getByRole('radio', { name: 'Anual' }).click()
    await plano(pagina, 'Profissional').getByRole('button').click()
    await expect(pagina.getByText(/saiu do pagamento/)).toBeVisible()
    expect(checkout[0].corpo).toEqual({ nivel: 'profissional', periodo: 'anual' })
  })

  test.describe('quando o servidor recusa', () => {
  test.use({ toleraRespostaDeErro: true })
  test('erro do servidor aparece para a pessoa, e o botão volta a funcionar', async ({ pagina }) => {
    await simularPagamento(pagina, { checkout: { status: 503, json: { erro: 'Os planos ainda não estão disponíveis para contratação. Tente novamente mais tarde.', codigo: 'preco_inexistente' } } })
    await pagina.goto('/assinatura')
    await plano(pagina, 'Iniciante').getByRole('button').click()
    await expect(pagina.getByRole('alert').filter({ hasText: 'Os planos ainda não estão disponíveis' })).toBeVisible()
    await expect(plano(pagina, 'Iniciante').getByRole('button')).toBeEnabled()
  })
  })

  test('não mostra "Gerenciar assinatura" para quem nunca assinou', async ({ pagina }) => {
    await pagina.goto('/assinatura')
    await expect(pagina.getByRole('button', { name: 'Gerenciar assinatura' })).toHaveCount(0)
  })
})

test.describe('tela de assinatura: quem já assina', () => {
  test('em teste grátis: título, dias que faltam, plano atual desligado e troca pelo portal', async ({ pagina }) => {
    await simularEstado(pagina, emTeste('amador', 5))
    await pagina.goto('/assinatura')
    const resumo = pagina.getByRole('region', { name: 'Sua assinatura' })
    await expect(resumo).toContainText('Teste grátis do Amador')
    await expect(resumo).toContainText('Faltam 5 dias')
    await expect(resumo.getByRole('button', { name: 'Gerenciar assinatura' })).toBeVisible()
    await expect(plano(pagina, 'Amador').getByRole('button')).toHaveText('Plano atual')
    await expect(plano(pagina, 'Amador').getByRole('button')).toBeDisabled()
    await expect(plano(pagina, 'Profissional').getByRole('button')).toHaveText('Mudar para este plano')
  })

  test('ativa: mostra o plano, o período e a renovação', async ({ pagina }) => {
    await simularEstado(pagina, ativa('profissional', { periodo: 'anual' }))
    await pagina.goto('/assinatura')
    const resumo = pagina.getByRole('region', { name: 'Sua assinatura' })
    await expect(resumo).toContainText('Plano Profissional anual')
    await expect(resumo).toContainText('Renova em')
  })

  test('marcada para cancelar: avisa até quando vale', async ({ pagina }) => {
    await simularEstado(pagina, ativa('amador', { cancelaNoFim: true }))
    await pagina.goto('/assinatura')
    await expect(pagina.getByRole('region', { name: 'Sua assinatura' })).toContainText('Cancelada: vale até')
  })

  test('pagamento atrasado: pede para resolver pelo portal', async ({ pagina }) => {
    await simularEstado(pagina, { ...ativa('amador'), situacao: 'atrasada', fimDoPeriodo: '2026-10-13T12:00:00.000Z' })
    await pagina.goto('/assinatura')
    await expect(pagina.getByRole('region', { name: 'Sua assinatura' })).toContainText('Pagamento atrasado')
    await expect(plano(pagina, 'Amador').getByRole('button')).toHaveText('Resolver pagamento')
  })

  test('cancelada: volta ao gratuito e o botão é "Assinar" (sem teste grátis de novo)', async ({ pagina }) => {
    await simularEstado(pagina, cancelada())
    await pagina.goto('/assinatura')
    await expect(pagina.getByRole('region', { name: 'Sua assinatura' })).toContainText('Assinatura encerrada')
    await expect(plano(pagina, 'Amador').getByRole('button')).toHaveText('Assinar')
  })

  test('"Gerenciar assinatura" abre o portal e leva para o endereço devolvido', async ({ pagina }) => {
    await simularEstado(pagina, ativa('amador'))
    const { portal } = await simularPagamento(pagina)
    await pagina.goto('/assinatura')
    await pagina.getByRole('button', { name: 'Gerenciar assinatura' }).click()
    await pagina.waitForURL('**/assinatura?portal=voltou')
    expect(portal).toHaveLength(1)
    expect(portal[0].corpo).toBeNull() // portal comum: sem plano de destino
  })

  test('trocar de plano passa pelo portal, já com o plano de destino, e nunca por um segundo checkout', async ({ pagina }) => {
    await simularEstado(pagina, ativa('amador'))
    const { checkout, portal } = await simularPagamento(pagina)
    await pagina.goto('/assinatura')
    await plano(pagina, 'Profissional').getByRole('button').click()
    await pagina.waitForURL('**/assinatura?portal=voltou')
    expect(portal).toHaveLength(1)
    expect(portal[0].corpo).toEqual({ nivel: 'profissional', periodo: 'mensal' })
    expect(checkout).toHaveLength(0)
  })

  test('durante o teste grátis, trocar de plano também abre a confirmação da troca', async ({ pagina }) => {
    await simularEstado(pagina, emTeste('amador', 4))
    const { portal } = await simularPagamento(pagina)
    await pagina.goto('/assinatura')
    await plano(pagina, 'Iniciante').getByRole('button').click()
    await pagina.waitForURL('**/assinatura?portal=voltou')
    expect(portal[0].corpo).toEqual({ nivel: 'iniciante', periodo: 'mensal' })
  })

  test('no mesmo plano, escolher o outro período oferece trocar só o período', async ({ pagina }) => {
    await simularEstado(pagina, ativa('amador', { periodo: 'mensal' }))
    const { portal } = await simularPagamento(pagina)
    await pagina.goto('/assinatura')
    await expect(plano(pagina, 'Amador').getByRole('button')).toHaveText('Plano atual')
    await pagina.getByRole('radio', { name: 'Anual' }).click()
    await expect(plano(pagina, 'Amador').getByRole('button')).toHaveText('Mudar para o anual')
    await plano(pagina, 'Amador').getByRole('button').click()
    await pagina.waitForURL('**/assinatura?portal=voltou')
    expect(portal[0].corpo).toEqual({ nivel: 'amador', periodo: 'anual' })
  })

  test('pagamento atrasado: "Resolver pagamento" abre o portal comum, sem plano de destino', async ({ pagina }) => {
    await simularEstado(pagina, { ...ativa('amador'), situacao: 'atrasada', fimDoPeriodo: '2026-10-13T12:00:00.000Z' })
    const { portal } = await simularPagamento(pagina)
    await pagina.goto('/assinatura')
    await plano(pagina, 'Profissional').getByRole('button', { name: /Resolver pagamento/ }).click()
    await pagina.waitForURL('**/assinatura?portal=voltou')
    expect(portal[0].corpo).toBeNull()
  })
})

test.describe('tela de assinatura: retorno do pagamento', () => {
  test('?checkout=ok espera a confirmação, mostra o sucesso e limpa o endereço', async ({ pagina }) => {
    // O Stripe pode levar alguns segundos: as duas primeiras respostas ainda dizem "sem assinatura".
    await simularEstado(pagina, n => (n < 3 ? SEM_ASSINATURA_TESTE : emTeste('amador', 7)))
    await pagina.goto('/assinatura?checkout=ok&session_id=cs_teste')
    await expect(pagina.getByText('Tudo certo! Sua assinatura está confirmada.')).toBeVisible({ timeout: 20_000 })
    await expect(pagina).toHaveURL(/\/assinatura$/)
    await expect(pagina.getByRole('region', { name: 'Sua assinatura' })).toContainText('Teste grátis do Amador')
  })

  test('se a confirmação demorar mais de 12 segundos, avisa em vez de ficar esperando para sempre', async ({ pagina }) => {
    await simularEstado(pagina, SEM_ASSINATURA_TESTE)
    await pagina.goto('/assinatura?checkout=ok&session_id=cs_teste')
    await expect(pagina.getByText(/a confirmação está demorando/)).toBeVisible({ timeout: 30_000 })
    await expect(pagina).toHaveURL(/\/assinatura$/)
  })

  test('?checkout=cancelado explica que nada foi cobrado', async ({ pagina }) => {
    await simularEstado(pagina, SEM_ASSINATURA_TESTE)
    await pagina.goto('/assinatura?checkout=cancelado')
    await expect(pagina.getByText('Você saiu do pagamento sem concluir. Nada foi cobrado.')).toBeVisible()
  })
})

test.describe('atalho no Perfil', () => {
  test('mostra o plano atual e leva para a tela', async ({ pagina }) => {
    await simularEstado(pagina, ativa('amador'))
    await pagina.goto('/perfil')
    const atalho = pagina.getByRole('link', { name: /Assinatura/ })
    await expect(atalho).toContainText('Plano Amador mensal')
    await atalho.click()
    await expect(pagina).toHaveURL(/\/assinatura$/)
  })

  test('sem o pagamento ligado, diz "Planos e pagamento"', async ({ pagina }) => {
    await simularEstado(pagina, 'indisponivel')
    await pagina.goto('/perfil')
    await expect(pagina.getByRole('link', { name: /Assinatura/ })).toContainText('Planos e pagamento')
  })
})
