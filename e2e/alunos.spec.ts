import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { SEM_ASSINATURA_TESTE, ativa, emTeste, simularEstado } from './assinatura-simulada'
import { ficha, fichas, simularAlunos } from './alunos-simulados'
import { expect, test } from './fixtures'
import { arquivoPng } from './imagem-de-teste'

// Área do treinador (plano Cornerman ou Profissional): lista "Meus Alunos" e cadastro de ficha. A API é simulada em memória
// (e2e/alunos-simulados.ts); as regras do servidor têm testes próprios (tests/cornerman-*.test.ts e e2e/api-cornerman.spec.ts).

async function auditar(pagina: Page) {
  await pagina.waitForLoadState('networkidle')
  const r = await new AxeBuilder({ page: pagina }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return r.violations.map(v => `${v.id} (${v.impact}): ${v.help}`)
}

const novoAluno = (pagina: Page) => pagina.getByRole('link', { name: 'Novo aluno' })
const preencher = async (pagina: Page) => {
  await pagina.getByLabel('Nome').fill('Beto Silva')
  await pagina.getByLabel('E-mail').fill('beto@exemplo.com')
  await pagina.getByLabel('Telefone').fill('(11) 91234-5678')
  await pagina.getByRole('radio', { name: 'Avançado' }).click()
  await pagina.getByLabel('Estilo').fill('Out-boxer')
  await pagina.getByLabel('Notas').fill('Treina de manhã')
}
const alerta = (pagina: Page) => pagina.locator('[role="alert"]:not(#__next-route-announcer__)')
const contador = (pagina: Page, texto: string) => pagina.getByText(texto, { exact: true })

test.describe('quem não tem o plano', () => {
  for (const [nome, estado] of [['gratuito', SEM_ASSINATURA_TESTE], ['Iniciante', ativa('iniciante')], ['Amador', ativa('amador')]] as const) {
    test(`${nome}: convite ao plano Cornerman, sem chamar a API`, async ({ pagina }) => {
      await simularEstado(pagina, estado)
      const api = await simularAlunos(pagina, fichas(3))
      await pagina.goto('/alunos')
      await expect(pagina.getByText('Disponível a partir do plano Cornerman')).toBeVisible()
      await expect(pagina.getByRole('link', { name: 'Ver planos' })).toBeVisible()
      await expect(novoAluno(pagina)).toHaveCount(0)
      await pagina.waitForTimeout(500)
      expect(api.pedidos).toEqual([])
    })
  }

  test('o atalho "Meus alunos" no Perfil só aparece para quem tem o plano', async ({ pagina }) => {
    await simularEstado(pagina, ativa('amador'))
    await simularAlunos(pagina)
    await pagina.goto('/perfil')
    await expect(pagina.getByRole('link', { name: /Alunos de boxe|Meus alunos/ })).toHaveCount(0)
  })
})

test.describe('quem tem o plano', () => {
  for (const [nome, estado] of [
    ['Cornerman', ativa('cornerman')], ['Profissional', ativa('profissional')], ['teste grátis do Cornerman', emTeste('cornerman')], ['pagamento desligado', 'indisponivel'],
  ] as const) {
    test(`${nome}: vê a lista`, async ({ pagina }) => {
      await simularEstado(pagina, estado)
      await simularAlunos(pagina, fichas(2))
      await pagina.goto('/alunos')
      await expect(pagina.getByRole('heading', { name: 'Meus Alunos', level: 1 })).toBeVisible()
      await expect(contador(pagina, '2 de 20 alunos')).toBeVisible()
    })
  }
})

test.describe('lista', () => {
  test.beforeEach(async ({ pagina }) => {
    await simularEstado(pagina, ativa('cornerman'))
  })

  test('sem fichas: estado vazio e o contador "0 de 20 alunos"', async ({ pagina }) => {
    await simularAlunos(pagina)
    await pagina.goto('/alunos')
    await expect(pagina.getByRole('heading', { name: 'Você ainda não cadastrou nenhum aluno.' })).toBeVisible()
    await expect(contador(pagina, '0 de 20 alunos')).toBeVisible()
    await expect(novoAluno(pagina)).toBeVisible()
  })

  test('com fichas: contador, ordem alfabética, nível, estilo e o selo "Ficha manual"; encerradas ficam recolhidas', async ({ pagina }) => {
    await simularAlunos(pagina, [
      ficha('Carlos', { nivel: 'avancado', estilo: 'Pressão' }), ficha('Ávila', { nivel: 'iniciante' }), ficha('Beto'), ficha('Zeca', { status: 'encerrado' }),
    ])
    await pagina.goto('/alunos')
    await expect(contador(pagina, '3 de 20 alunos')).toBeVisible()
    const cartoes = pagina.getByRole('list', { name: 'Alunos' }).getByRole('listitem')
    await expect(cartoes).toHaveCount(3)
    await expect(cartoes.nth(0)).toContainText('Ávila')
    await expect(cartoes.nth(0)).toContainText('Iniciante')
    await expect(cartoes.nth(1)).toContainText('Beto')
    await expect(cartoes.nth(2)).toContainText('Carlos')
    await expect(cartoes.nth(2)).toContainText('Avançado · Pressão')
    for (let i = 0; i < 3; i++) await expect(cartoes.nth(i)).toContainText('Ficha manual')

    const encerrados = pagina.getByRole('button', { name: /Encerrados \(1\)/ })
    await expect(encerrados).toHaveAttribute('aria-expanded', 'false')
    await expect(pagina.getByText('Zeca')).toHaveCount(0)
    await encerrados.click()
    await expect(encerrados).toHaveAttribute('aria-expanded', 'true')
    await expect(pagina.getByText('Zeca')).toBeVisible()
  })

  test('cada cartão leva à ficha do aluno', async ({ pagina }) => {
    const beto = ficha('Beto')
    await simularAlunos(pagina, [beto])
    await pagina.goto('/alunos')
    await pagina.getByRole('link', { name: /Beto/ }).click()
    await expect(pagina).toHaveURL(`/alunos/${beto.id}`)
  })

  test('com 20 fichas ativas: o botão fica desligado e explica o limite', async ({ pagina }) => {
    await simularAlunos(pagina, fichas(20))
    await pagina.goto('/alunos')
    await expect(contador(pagina, '20 de 20 alunos')).toBeVisible()
    await expect(pagina.getByRole('button', { name: 'Novo aluno' })).toBeDisabled()
    await expect(pagina.getByText('Você chegou ao limite de 20 alunos.')).toBeVisible()
    await expect(novoAluno(pagina)).toHaveCount(0)
  })

  test('encerradas não contam: 20 fichas, uma encerrada, o botão continua ligado', async ({ pagina }) => {
    const lista = fichas(20)
    lista[0].status = 'encerrado'
    await simularAlunos(pagina, lista)
    await pagina.goto('/alunos')
    await expect(contador(pagina, '19 de 20 alunos')).toBeVisible()
    await expect(novoAluno(pagina)).toBeVisible()
  })


  test('nome muito comprido e com emoji não estoura a tela (360 px)', async ({ pagina }) => {
    await pagina.setViewportSize({ width: 360, height: 760 })
    await simularAlunos(pagina, [ficha(`🥊 ${'Sobrenome'.repeat(8)}`, { estilo: 'e'.repeat(40) })])
    await pagina.goto('/alunos')
    await expect(pagina.locator('strong', { hasText: '🥊' })).toBeVisible()
    const larguraDoConteudo = await pagina.evaluate(() => document.documentElement.scrollWidth)
    expect(larguraDoConteudo).toBeLessThanOrEqual(360)
  })

  test('o atalho "Meus alunos" no Perfil leva à lista e a aba Perfil fica acesa', async ({ pagina }) => {
    await simularAlunos(pagina, fichas(1))
    await pagina.goto('/perfil')
    await pagina.getByRole('link', { name: /Meus alunos/ }).click()
    await expect(pagina).toHaveURL('/alunos')
    const nav = pagina.getByRole('navigation', { name: 'Navegação principal' })
    await expect(nav.getByRole('link', { name: 'Perfil' })).toHaveAttribute('aria-current', 'page')
    await novoAluno(pagina).click()
    await expect(pagina).toHaveURL('/alunos/novo')
    await expect(nav.getByRole('link', { name: 'Perfil' })).toHaveAttribute('aria-current', 'page')
  })

  test('acessibilidade (axe): vazia, com fichas e com o limite', async ({ pagina }) => {
    await simularAlunos(pagina)
    await pagina.goto('/alunos')
    await expect(contador(pagina, '0 de 20 alunos')).toBeVisible()
    expect(await auditar(pagina), 'vazia').toEqual([])
    await pagina.unroute(/\/api\/cornerman\/alunos/)
    await simularAlunos(pagina, [...fichas(3), ficha('Zeca', { status: 'encerrado', foto: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' })])
    await pagina.reload()
    await expect(contador(pagina, '3 de 20 alunos')).toBeVisible()
    expect(await auditar(pagina), 'com fichas').toEqual([])
    await pagina.unroute(/\/api\/cornerman\/alunos/)
    await simularAlunos(pagina, fichas(20))
    await pagina.reload()
    await expect(contador(pagina, '20 de 20 alunos')).toBeVisible()
    expect(await auditar(pagina), 'no limite').toEqual([])
  })

  test('o convite ao plano também passa no axe', async ({ pagina }) => {
    await simularEstado(pagina, ativa('amador'))
    await simularAlunos(pagina)
    await pagina.goto('/alunos')
    await expect(pagina.getByText('Disponível a partir do plano Cornerman')).toBeVisible()
    expect(await auditar(pagina)).toEqual([])
  })
})

test.describe('cadastro', () => {
  test.beforeEach(async ({ pagina }) => {
    await simularEstado(pagina, ativa('cornerman'))
  })

  test('cadastrar faz um POST só com o corpo exato, volta à lista e avisa', async ({ pagina }) => {
    const api = await simularAlunos(pagina)
    await pagina.goto('/alunos/novo')
    await preencher(pagina)
    await pagina.getByRole('button', { name: 'Cadastrar' }).click()

    await expect(pagina).toHaveURL('/alunos')
    await expect(pagina.getByText('Aluno cadastrado')).toBeVisible()
    await expect(pagina.getByRole('link', { name: /Beto Silva/ })).toBeVisible()
    const escritas = api.escritas()
    expect(escritas).toHaveLength(1)
    expect(escritas[0]).toMatchObject({ metodo: 'POST', caminho: '/api/cornerman/alunos' })
    expect(escritas[0].corpo).toEqual({
      nome: 'Beto Silva', email: 'beto@exemplo.com', telefone: '(11) 91234-5678', nivel: 'avancado', estilo: 'Out-boxer', notas: 'Treina de manhã', foto: '',
    })
  })

  test('só o nome basta; o resto vai vazio ou nulo', async ({ pagina }) => {
    const api = await simularAlunos(pagina)
    await pagina.goto('/alunos/novo')
    await pagina.getByLabel('Nome').fill('Zé')
    await pagina.getByRole('button', { name: 'Cadastrar' }).click()
    await expect(pagina).toHaveURL('/alunos')
    expect(api.escritas()[0].corpo).toEqual({ nome: 'Zé', email: null, telefone: null, nivel: null, estilo: null, notas: '', foto: '' })
  })

  test('duplo clique em "Cadastrar" cria uma ficha só', async ({ pagina }) => {
    const api = await simularAlunos(pagina, [], { atrasoMs: 600 })
    await pagina.goto('/alunos/novo')
    await pagina.getByLabel('Nome').fill('Beto')
    await pagina.getByRole('button', { name: 'Cadastrar' }).dblclick()
    await expect(pagina).toHaveURL('/alunos')
    expect(api.escritas()).toHaveLength(1)
    expect(api.fichas).toHaveLength(1)
  })

  test('nome vazio: erro na tela, sem chamar a API', async ({ pagina }) => {
    const api = await simularAlunos(pagina)
    await pagina.goto('/alunos/novo')
    await pagina.getByLabel('Nome').fill('   ')
    await pagina.getByRole('button', { name: 'Cadastrar' }).click()
    await expect(alerta(pagina)).toHaveText('Informe o nome do aluno.')
    await expect(pagina.getByLabel('Nome')).toHaveAttribute('aria-invalid', 'true')
    expect(api.escritas()).toEqual([])
  })



  test('notas com HTML e script ficam como texto no campo', async ({ pagina }) => {
    await simularAlunos(pagina)
    await pagina.goto('/alunos/novo')
    await pagina.getByLabel('Notas').fill('<script>alert(1)</script><b>x</b>')
    await expect(pagina.getByLabel('Notas')).toHaveValue('<script>alert(1)</script><b>x</b>')
    await expect(pagina.locator('script', { hasText: 'alert(1)' })).toHaveCount(0)
  })

  test('os campos têm o limite de caracteres da ficha e as notas mostram o contador', async ({ pagina }) => {
    await simularAlunos(pagina)
    await pagina.goto('/alunos/novo')
    await expect(pagina.getByLabel('Nome')).toHaveAttribute('maxlength', '80')
    await expect(pagina.getByLabel('E-mail')).toHaveAttribute('maxlength', '120')
    await expect(pagina.getByLabel('Telefone')).toHaveAttribute('maxlength', '30')
    await expect(pagina.getByLabel('Estilo')).toHaveAttribute('maxlength', '40')
    await expect(pagina.getByLabel('Notas')).toHaveAttribute('maxlength', '2000')
    await pagina.getByLabel('Notas').fill('12345')
    await expect(pagina.getByText('5/2000')).toBeVisible()
  })

  test('foto: a imagem escolhida é recortada para 200×200, aparece na prévia e vai no cadastro', async ({ pagina }) => {
    const api = await simularAlunos(pagina)
    await pagina.goto('/alunos/novo')
    await pagina.getByLabel(/^Adicionar foto$/).setInputFiles(arquivoPng())
    const previa = pagina.getByRole('img', { name: 'Foto do aluno' })
    await expect(previa).toBeVisible()
    expect(await previa.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])).toEqual([200, 200])
    await pagina.getByLabel('Nome').fill('Com foto')
    await pagina.getByRole('button', { name: 'Cadastrar' }).click()
    await expect(pagina).toHaveURL('/alunos')
    expect((api.escritas()[0].corpo as { foto: string }).foto).toMatch(/^data:image\/jpeg;base64,/)
  })

  test('foto: arquivo que não é imagem avisa e não muda nada; "Remover foto" tira a prévia', async ({ pagina }) => {
    await simularAlunos(pagina)
    await pagina.goto('/alunos/novo')
    await pagina.getByLabel(/^Adicionar foto$/).setInputFiles({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('oi') })
    await expect(pagina.getByText('Escolha uma imagem.')).toBeVisible()
    await expect(pagina.getByRole('img', { name: 'Foto do aluno' })).toHaveCount(0)

    await pagina.getByLabel(/^Adicionar foto$/).setInputFiles(arquivoPng())
    await expect(pagina.getByRole('img', { name: 'Foto do aluno' })).toBeVisible()
    await pagina.getByRole('button', { name: 'Remover foto' }).click()
    await expect(pagina.getByRole('img', { name: 'Foto do aluno' })).toHaveCount(0)
  })

  test('sem plano: o convite no lugar do formulário', async ({ pagina }) => {
    await simularEstado(pagina, ativa('amador'))
    await simularAlunos(pagina)
    await pagina.goto('/alunos/novo')
    await expect(pagina.getByText('Disponível a partir do plano Cornerman')).toBeVisible()
    await expect(pagina.getByLabel('Nome')).toHaveCount(0)
  })

  test('o formulário inteiro funciona só com o teclado, e o axe não acha violações', async ({ pagina }) => {
    const api = await simularAlunos(pagina)
    await pagina.goto('/alunos/novo')
    expect(await auditar(pagina)).toEqual([])
    await pagina.getByLabel('Nome').focus()
    await pagina.keyboard.type('Teclado')
    await pagina.getByRole('radio', { name: 'Iniciante' }).focus()
    await pagina.keyboard.press('Space')
    await expect(pagina.getByRole('radio', { name: 'Iniciante' })).toHaveAttribute('aria-checked', 'true')
    await pagina.getByRole('button', { name: 'Cadastrar' }).focus()
    await pagina.keyboard.press('Enter')
    await expect(pagina).toHaveURL('/alunos')
    expect(api.escritas()[0].corpo).toMatchObject({ nome: 'Teclado', nivel: 'iniciante' })
  })
})

test.describe('respostas de erro de propósito (o navegador registra no console, e o teste tolera)', () => {
  test.use({ toleraRespostaDeErro: true })
  test.beforeEach(async ({ pagina }) => {
    await simularEstado(pagina, ativa('cornerman'))
  })

  test('falha ao carregar: aviso com "Tentar de novo"', async ({ pagina }) => {
    await simularAlunos(pagina, fichas(1), { falhaNaListagem: true })
    await pagina.goto('/alunos')
    await expect(alerta(pagina)).toContainText('Não foi possível')
    await expect(pagina.getByRole('button', { name: 'Tentar de novo' })).toBeVisible()
  })

  test('limite atingido: a mensagem do servidor aparece e nada muda', async ({ pagina }) => {
    const api = await simularAlunos(pagina, fichas(20))
    await pagina.goto('/alunos/novo')
    await pagina.getByLabel('Nome').fill('Aluno 21')
    await pagina.getByRole('button', { name: 'Cadastrar' }).click()
    await expect(alerta(pagina)).toContainText('Você já tem 20 alunos.')
    await expect(pagina).toHaveURL('/alunos/novo')
    expect(api.fichas).toHaveLength(20)
  })

  test('sem conexão: mensagem de rede e o que foi digitado continua no formulário', async ({ pagina }) => {
    await simularAlunos(pagina, [], { falhaDeRede: true })
    await pagina.goto('/alunos/novo')
    await preencher(pagina)
    await pagina.getByRole('button', { name: 'Cadastrar' }).click()
    await expect(alerta(pagina)).toHaveText('Sem conexão. Verifique a internet e tente de novo.')
    await expect(pagina.getByLabel('Nome')).toHaveValue('Beto Silva')
    await expect(pagina.getByLabel('Notas')).toHaveValue('Treina de manhã')
    await expect(pagina.getByRole('button', { name: 'Cadastrar' })).toBeEnabled()
  })
})

// ── Ficha do aluno ───────────────────────────────────────────

const abaDaFicha = (pagina: Page, nome: string) => pagina.getByRole('tab', { name: nome })

test.describe('ficha do aluno', () => {
  test.beforeEach(async ({ pagina }) => {
    await simularEstado(pagina, ativa('cornerman'))
  })

  const beto = () => ficha('Beto Silva', { email: 'beto@exemplo.com', telefone: '(11) 91234-5678', nivel: 'avancado', estilo: 'Out-boxer', notas: 'Treina de manhã' })

  test('visão geral: nome, foto (ou inicial), nível, estilo, contatos como links e o selo da ficha manual', async ({ pagina }) => {
    const b = beto()
    await simularAlunos(pagina, [b])
    await pagina.goto(`/alunos/${b.id}`)
    await expect(pagina.getByRole('heading', { name: 'Beto Silva', level: 1 })).toBeVisible()
    await expect(pagina.getByText('Ficha manual · sem dados de treino')).toBeVisible()
    await expect(pagina.getByText('Avançado')).toBeVisible()
    await expect(pagina.getByText('Out-boxer')).toBeVisible()
    await expect(pagina.getByRole('link', { name: 'beto@exemplo.com' })).toHaveAttribute('href', 'mailto:beto@exemplo.com')
    await expect(pagina.getByRole('link', { name: '(11) 91234-5678' })).toHaveAttribute('href', 'tel:11912345678')
    await expect(abaDaFicha(pagina, 'Visão geral')).toHaveAttribute('aria-selected', 'true')
    await expect(pagina.getByRole('link', { name: 'Meus alunos' })).toHaveAttribute('href', '/alunos')
  })

  test('campos vazios não viram links nem "null" na tela', async ({ pagina }) => {
    const sem = ficha('Sem contato')
    await simularAlunos(pagina, [sem])
    await pagina.goto(`/alunos/${sem.id}`)
    await expect(pagina.getByRole('heading', { name: 'Sem contato', level: 1 })).toBeVisible()
    await expect(pagina.locator('a[href^="mailto:"], a[href^="tel:"]')).toHaveCount(0)
    await expect(pagina.getByText(/null|undefined/)).toHaveCount(0)
  })

  test('com foto: a imagem tem o nome do aluno como texto alternativo', async ({ pagina }) => {
    const b = ficha('Com Foto', { foto: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' })
    await simularAlunos(pagina, [b])
    await pagina.goto(`/alunos/${b.id}`)
    await expect(pagina.getByRole('img', { name: 'Com Foto' })).toBeVisible()
  })

  test.describe('notas', () => {
    test('editar e salvar faz um PATCH só com as notas, avisa e mantém o texto', async ({ pagina }) => {
      const b = beto()
      const api = await simularAlunos(pagina, [b])
      await pagina.goto(`/alunos/${b.id}`)
      await abaDaFicha(pagina, 'Notas').click()
      const campo = pagina.getByRole('textbox', { name: 'Notas' })
      await expect(campo).toHaveValue('Treina de manhã')
      await expect(pagina.getByRole('button', { name: 'Salvar notas' })).toBeDisabled() // nada mudou ainda
      await campo.fill('Treina de manhã e à noite')
      await pagina.getByRole('button', { name: 'Salvar notas' }).click()
      await expect(pagina.getByText('Notas salvas')).toBeVisible()
      expect(api.escritas()).toHaveLength(1)
      expect(api.escritas()[0]).toMatchObject({ metodo: 'PATCH', caminho: `/api/cornerman/alunos/${b.id}`, corpo: { notas: 'Treina de manhã e à noite' } })
      await expect(campo).toHaveValue('Treina de manhã e à noite')
      await expect(pagina.getByRole('button', { name: 'Salvar notas' })).toBeDisabled()
    })

    test('HTML e script nas notas aparecem como texto, sem virar elemento nem executar', async ({ pagina }) => {
      const perigoso = '<script>window.__invadido = true</script><img src=x onerror="window.__invadido = true"><b>negrito</b>'
      const b = ficha('Perigoso', { notas: perigoso })
      await simularAlunos(pagina, [b])
      await pagina.goto(`/alunos/${b.id}`)
      await abaDaFicha(pagina, 'Notas').click()
      await expect(pagina.getByRole('textbox', { name: 'Notas' })).toHaveValue(perigoso)
      await expect(pagina.locator('main b, main img[src="x"]')).toHaveCount(0)
      expect(await pagina.evaluate(() => (window as unknown as { __invadido?: boolean }).__invadido)).toBeUndefined()
    })

    test('as notas aparecem como texto também na visão geral', async ({ pagina }) => {
      const b = ficha('Resumo', { notas: '<b>negrito</b> e <script>x</script>' })
      await simularAlunos(pagina, [b])
      await pagina.goto(`/alunos/${b.id}`)
      await expect(pagina.getByText('<b>negrito</b> e <script>x</script>')).toBeVisible()
      await expect(pagina.locator('main b')).toHaveCount(0)
    })

    test('trocar de aba com notas não salvas pergunta antes; "Cancelar" mantém a edição', async ({ pagina }) => {
      const b = beto()
      await simularAlunos(pagina, [b])
      await pagina.goto(`/alunos/${b.id}`)
      await abaDaFicha(pagina, 'Notas').click()
      await pagina.getByRole('textbox', { name: 'Notas' }).fill('mudei')

      pagina.removeAllListeners('dialog') // o vigia dos testes aceita tudo; aqui o teste decide
      const perguntas: string[] = []
      pagina.once('dialog', d => { perguntas.push(d.message()); void d.dismiss() })
      await abaDaFicha(pagina, 'Visão geral').click()
      expect(perguntas).toEqual(['Você alterou as notas e ainda não salvou. Sair desta aba descarta a alteração. Continuar?'])
      await expect(abaDaFicha(pagina, 'Notas')).toHaveAttribute('aria-selected', 'true')
      await expect(pagina.getByRole('textbox', { name: 'Notas' })).toHaveValue('mudei')

      pagina.once('dialog', d => void d.accept())
      await abaDaFicha(pagina, 'Visão geral').click()
      await expect(abaDaFicha(pagina, 'Visão geral')).toHaveAttribute('aria-selected', 'true')
    })

    test('o campo para em 2000 caracteres e o contador acompanha', async ({ pagina }) => {
      const b = beto()
      await simularAlunos(pagina, [b])
      await pagina.goto(`/alunos/${b.id}`)
      await abaDaFicha(pagina, 'Notas').click()
      await expect(pagina.getByRole('textbox', { name: 'Notas' })).toHaveAttribute('maxlength', '2000')
      await pagina.getByRole('textbox', { name: 'Notas' }).fill('x'.repeat(2000))
      await expect(pagina.getByText('2000/2000')).toBeVisible()
    })
  })

  test.describe('editar dados', () => {
    test('abre o formulário preenchido; salvar manda só o que mudou', async ({ pagina }) => {
      const b = beto()
      const api = await simularAlunos(pagina, [b])
      await pagina.goto(`/alunos/${b.id}`)
      await pagina.getByRole('button', { name: 'Editar dados' }).click()
      await expect(pagina.getByLabel('Nome')).toHaveValue('Beto Silva')
      await expect(pagina.getByLabel('E-mail')).toHaveValue('beto@exemplo.com')
      await expect(pagina.getByRole('radio', { name: 'Avançado' })).toHaveAttribute('aria-checked', 'true')
      await pagina.getByLabel('Estilo').fill('Pressão')
      await pagina.getByRole('button', { name: 'Salvar dados' }).click()
      await expect(pagina.getByText('Dados do aluno salvos')).toBeVisible()
      expect(api.escritas()).toHaveLength(1)
      expect(api.escritas()[0].corpo).toEqual({ estilo: 'Pressão' })
      await expect(pagina.getByText('Pressão')).toBeVisible()
      await expect(pagina.getByLabel('Nome')).toHaveCount(0) // voltou à visão geral
    })

    test('sem nenhuma mudança, salvar só fecha o formulário (nenhum pedido)', async ({ pagina }) => {
      const b = beto()
      const api = await simularAlunos(pagina, [b])
      await pagina.goto(`/alunos/${b.id}`)
      await pagina.getByRole('button', { name: 'Editar dados' }).click()
      await pagina.getByRole('button', { name: 'Salvar dados' }).click()
      await expect(pagina.getByLabel('Nome')).toHaveCount(0)
      expect(api.escritas()).toEqual([])
    })

    test('nome vazio é recusado na tela; Cancelar descarta o que foi digitado', async ({ pagina }) => {
      const b = beto()
      const api = await simularAlunos(pagina, [b])
      await pagina.goto(`/alunos/${b.id}`)
      await pagina.getByRole('button', { name: 'Editar dados' }).click()
      await pagina.getByLabel('Nome').fill('')
      await pagina.getByRole('button', { name: 'Salvar dados' }).click()
      await expect(alerta(pagina)).toHaveText('Informe o nome do aluno.')
      await pagina.getByLabel('Nome').fill('Outro nome')
      await pagina.getByRole('button', { name: 'Cancelar' }).click()
      await expect(pagina.getByRole('heading', { name: 'Beto Silva', level: 1 })).toBeVisible()
      expect(api.escritas()).toEqual([])
    })
  })

  test.describe('encerrar, reabrir e apagar', () => {
    test('encerrar: confirma, faz PATCH {status:"encerrado"}, avisa e a ficha passa a "Encerrada" com o botão "Reabrir"', async ({ pagina }) => {
      const b = beto()
      const api = await simularAlunos(pagina, [b])
      await pagina.goto(`/alunos/${b.id}`)
      const perguntas: string[] = []
      pagina.removeAllListeners('dialog')
      pagina.on('dialog', d => { perguntas.push(d.message()); void d.accept() })
      await pagina.getByRole('button', { name: 'Encerrar ficha' }).click()
      await expect(pagina.getByText('Ficha encerrada').first()).toBeVisible()
      expect(perguntas).toHaveLength(1)
      expect(perguntas[0]).toContain('Beto Silva')
      expect(api.escritas()[0].corpo).toEqual({ status: 'encerrado' })
      await expect(pagina.getByRole('button', { name: 'Reabrir ficha' })).toBeVisible()
      await expect(pagina.getByRole('button', { name: 'Encerrar ficha' })).toHaveCount(0)
    })

    test('encerrar e cancelar a pergunta: nada acontece', async ({ pagina }) => {
      const b = beto()
      const api = await simularAlunos(pagina, [b])
      await pagina.goto(`/alunos/${b.id}`)
      pagina.removeAllListeners('dialog')
      pagina.once('dialog', d => void d.dismiss())
      await pagina.getByRole('button', { name: 'Encerrar ficha' }).click()
      await expect(pagina.getByRole('button', { name: 'Encerrar ficha' })).toBeVisible()
      expect(api.escritas()).toEqual([])
    })

    test('reabrir: PATCH {status:"ativo"} e a ficha volta a ativa', async ({ pagina }) => {
      const b = ficha('Parado', { status: 'encerrado' })
      const api = await simularAlunos(pagina, [b])
      await pagina.goto(`/alunos/${b.id}`)
      await expect(pagina.getByText('Encerrada', { exact: true })).toBeVisible()
      await pagina.getByRole('button', { name: 'Reabrir ficha' }).click()
      await expect(pagina.getByText('Ficha reaberta')).toBeVisible()
      expect(api.escritas()[0].corpo).toEqual({ status: 'ativo' })
      await expect(pagina.getByRole('button', { name: 'Encerrar ficha' })).toBeVisible()
    })

    test('apagar: confirma com o nome, faz DELETE, avisa e volta à lista sem a ficha', async ({ pagina }) => {
      const b = beto()
      const api = await simularAlunos(pagina, [b, ficha('Fica')])
      await pagina.goto(`/alunos/${b.id}`)
      const perguntas: string[] = []
      pagina.removeAllListeners('dialog')
      pagina.on('dialog', d => { perguntas.push(d.message()); void d.accept() })
      await pagina.getByRole('button', { name: 'Apagar ficha' }).click()
      await expect(pagina).toHaveURL('/alunos')
      await expect(pagina.getByText('Ficha apagada')).toBeVisible()
      expect(perguntas).toEqual(['Apagar de vez a ficha de Beto Silva? Isso não pode ser desfeito.'])
      expect(api.escritas().map(p => p.metodo)).toEqual(['DELETE'])
      await expect(pagina.getByRole('link', { name: /Beto Silva/ })).toHaveCount(0)
      await expect(pagina.getByRole('link', { name: /Fica/ })).toBeVisible()
    })

    test('apagar e cancelar a pergunta: nada acontece', async ({ pagina }) => {
      const b = beto()
      const api = await simularAlunos(pagina, [b])
      await pagina.goto(`/alunos/${b.id}`)
      pagina.removeAllListeners('dialog')
      pagina.once('dialog', d => void d.dismiss())
      await pagina.getByRole('button', { name: 'Apagar ficha' }).click()
      await expect(pagina.getByRole('heading', { name: 'Beto Silva', level: 1 })).toBeVisible()
      expect(api.escritas()).toEqual([])
    })
  })

  test('sem plano: o convite, sem chamar a API', async ({ pagina }) => {
    await simularEstado(pagina, ativa('amador'))
    const api = await simularAlunos(pagina, [beto()])
    await pagina.goto('/alunos/00000000-0000-4000-8000-000000000001')
    await expect(pagina.getByText('Disponível a partir do plano Cornerman')).toBeVisible()
    await pagina.waitForTimeout(500)
    expect(api.pedidos).toEqual([])
  })

  test('acessibilidade (axe): visão geral, notas, editando e encerrada', async ({ pagina }) => {
    const b = beto()
    const parada = ficha('Parada', { status: 'encerrado', foto: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' })
    await simularAlunos(pagina, [b, parada])
    await pagina.goto(`/alunos/${b.id}`)
    await expect(pagina.getByRole('heading', { name: 'Beto Silva', level: 1 })).toBeVisible()
    expect(await auditar(pagina), 'visão geral').toEqual([])
    await abaDaFicha(pagina, 'Notas').click()
    expect(await auditar(pagina), 'notas').toEqual([])
    await abaDaFicha(pagina, 'Visão geral').click()
    await pagina.getByRole('button', { name: 'Editar dados' }).click()
    expect(await auditar(pagina), 'editando').toEqual([])
    await pagina.goto(`/alunos/${parada.id}`)
    await expect(pagina.getByRole('heading', { name: 'Parada', level: 1 })).toBeVisible()
    expect(await auditar(pagina), 'encerrada').toEqual([])
  })

  test('as abas respondem às setas do teclado', async ({ pagina }) => {
    const b = beto()
    await simularAlunos(pagina, [b])
    await pagina.goto(`/alunos/${b.id}`)
    await abaDaFicha(pagina, 'Visão geral').focus()
    await pagina.keyboard.press('ArrowRight')
    await expect(abaDaFicha(pagina, 'Notas')).toHaveAttribute('aria-selected', 'true')
    await pagina.keyboard.press('ArrowLeft')
    await expect(abaDaFicha(pagina, 'Visão geral')).toHaveAttribute('aria-selected', 'true')
  })
})

test.describe('ficha: respostas de erro de propósito', () => {
  test.use({ toleraRespostaDeErro: true })
  test.beforeEach(async ({ pagina }) => {
    await simularEstado(pagina, ativa('cornerman'))
  })

  test('ficha que o servidor diz que não existe: "Aluno não encontrado." com volta à lista', async ({ pagina }) => {
    await simularAlunos(pagina, [])
    await pagina.goto('/alunos/00000000-0000-4000-8000-999999999999')
    await expect(pagina.getByText('Aluno não encontrado.')).toBeVisible()
    await expect(pagina.getByRole('link', { name: 'Voltar para Meus Alunos' })).toHaveAttribute('href', '/alunos')
  })

  test('reabrir com 20 fichas ativas: mostra a mensagem do servidor e a ficha continua encerrada', async ({ pagina }) => {
    const parada = ficha('Parada', { status: 'encerrado' })
    await simularAlunos(pagina, [...fichas(20), parada])
    await pagina.goto(`/alunos/${parada.id}`)
    await pagina.getByRole('button', { name: 'Reabrir ficha' }).click()
    await expect(alerta(pagina)).toContainText('Você já tem 20 alunos.')
    await expect(pagina.getByRole('button', { name: 'Reabrir ficha' })).toBeVisible()
    await expect(pagina.getByText('Encerrada', { exact: true })).toBeVisible()
  })

  test('sem conexão ao salvar as notas: avisa e mantém o texto digitado', async ({ pagina }) => {
    const b = ficha('Rede', { notas: 'antes' })
    await simularAlunos(pagina, [b])
    await pagina.goto(`/alunos/${b.id}`)
    await abaDaFicha(pagina, 'Notas').click()
    await simularAlunos(pagina, [b], { falhaDeRede: true }) // a rota registrada por último vale primeiro
    await pagina.getByRole('textbox', { name: 'Notas' }).fill('depois')
    await pagina.getByRole('button', { name: 'Salvar notas' }).click()
    await expect(alerta(pagina)).toHaveText('Sem conexão. Verifique a internet e tente de novo.')
    await expect(pagina.getByRole('textbox', { name: 'Notas' })).toHaveValue('depois')
    await expect(pagina.getByRole('button', { name: 'Salvar notas' })).toBeEnabled()
  })
})

// ── Alterações não salvas nos formulários ────────────────────

const protegeContraSaida = (pagina: Page) =>
  pagina.evaluate(() => {
    const e = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(e)
    return e.defaultPrevented
  })

test.describe('formulários: o que foi digitado e não salvo não se perde sem aviso', () => {
  test.beforeEach(async ({ pagina }) => {
    await simularEstado(pagina, ativa('cornerman'))
  })

  const beto = () => ficha('Beto Silva', { email: 'beto@exemplo.com', nivel: 'avancado', estilo: 'Out-boxer', notas: 'Treina de manhã' })

  test('editando os dados e trocando para a aba Notas: pergunta; "Cancelar" mantém o que foi digitado', async ({ pagina }) => {
    const b = beto()
    await simularAlunos(pagina, [b])
    await pagina.goto(`/alunos/${b.id}`)
    await pagina.getByRole('button', { name: 'Editar dados' }).click()
    await pagina.getByLabel('Estilo').fill('Pressão')

    pagina.removeAllListeners('dialog')
    const perguntas: string[] = []
    pagina.once('dialog', d => { perguntas.push(d.message()); void d.dismiss() })
    await abaDaFicha(pagina, 'Notas').click()
    expect(perguntas).toEqual(['Você alterou os dados e ainda não salvou. Sair desta aba descarta a alteração. Continuar?'])
    await expect(abaDaFicha(pagina, 'Visão geral')).toHaveAttribute('aria-selected', 'true')
    await expect(pagina.getByLabel('Estilo')).toHaveValue('Pressão')

    pagina.once('dialog', d => void d.accept())
    await abaDaFicha(pagina, 'Notas').click()
    await expect(abaDaFicha(pagina, 'Notas')).toHaveAttribute('aria-selected', 'true')
    await abaDaFicha(pagina, 'Visão geral').click()
    await expect(pagina.getByText('Out-boxer')).toBeVisible() // voltou à visão geral, com o valor original
    await expect(pagina.getByLabel('Estilo')).toHaveCount(0)
  })

  test('mexer nas notas dentro do formulário de dados também conta como alteração', async ({ pagina }) => {
    const b = beto()
    await simularAlunos(pagina, [b])
    await pagina.goto(`/alunos/${b.id}`)
    await pagina.getByRole('button', { name: 'Editar dados' }).click()
    await pagina.getByLabel('Notas').fill('Treina de manhã e à noite')
    expect(await protegeContraSaida(pagina)).toBe(true)
  })

  test('sem alterações, trocar de aba não pergunta nada', async ({ pagina }) => {
    const b = beto()
    await simularAlunos(pagina, [b])
    await pagina.goto(`/alunos/${b.id}`)
    await pagina.getByRole('button', { name: 'Editar dados' }).click()
    pagina.removeAllListeners('dialog')
    const perguntas: string[] = []
    pagina.on('dialog', d => { perguntas.push(d.message()); void d.accept() })
    await abaDaFicha(pagina, 'Notas').click()
    await expect(abaDaFicha(pagina, 'Notas')).toHaveAttribute('aria-selected', 'true')
    expect(perguntas).toEqual([])
  })

  test('voltar ao valor original desfaz a "alteração": nada a perder, nada a perguntar', async ({ pagina }) => {
    const b = beto()
    await simularAlunos(pagina, [b])
    await pagina.goto(`/alunos/${b.id}`)
    await pagina.getByRole('button', { name: 'Editar dados' }).click()
    await pagina.getByLabel('Estilo').fill('Pressão')
    expect(await protegeContraSaida(pagina)).toBe(true)
    await pagina.getByLabel('Estilo').fill('Out-boxer')
    expect(await protegeContraSaida(pagina)).toBe(false)
  })

  test('recarregar ou fechar a página com o formulário de dados alterado é protegido pelo navegador', async ({ pagina }) => {
    const b = beto()
    await simularAlunos(pagina, [b])
    await pagina.goto(`/alunos/${b.id}`)
    expect(await protegeContraSaida(pagina)).toBe(false)
    await pagina.getByRole('button', { name: 'Editar dados' }).click()
    expect(await protegeContraSaida(pagina)).toBe(false)
    await pagina.getByLabel('Nome').fill('Beto Silva Júnior')
    expect(await protegeContraSaida(pagina)).toBe(true)
    await pagina.getByRole('button', { name: 'Cancelar' }).click()
    expect(await protegeContraSaida(pagina)).toBe(false)
  })

  test('cadastro novo: com algo digitado a saída é protegida; vazio, não; depois de cadastrar, não', async ({ pagina }) => {
    await simularAlunos(pagina)
    await pagina.goto('/alunos/novo')
    expect(await protegeContraSaida(pagina)).toBe(false)
    await pagina.getByLabel('Nome').fill('Zé')
    expect(await protegeContraSaida(pagina)).toBe(true)
    await pagina.getByRole('button', { name: 'Cadastrar' }).click()
    await expect(pagina).toHaveURL('/alunos')
    expect(await protegeContraSaida(pagina)).toBe(false)
  })
})

// ── Convite na ficha (etapa 3a) ──────────────────────────────

test.describe('convite na ficha', () => {
  test.beforeEach(async ({ pagina }) => {
    await simularEstado(pagina, ativa('cornerman'))
  })

  const secao = (pagina: Page) => pagina.getByRole('region', { name: 'Convite' })
  const campoDoLink = (pagina: Page) => pagina.getByRole('textbox', { name: 'Link do convite' })
  const gerar = (pagina: Page) => pagina.getByRole('button', { name: 'Gerar link de convite' })

  test('ficha manual: "Gerar link de convite" faz UM pedido, mostra o link, o aviso e o e-mail desligado; a ficha vira "Convidado"', async ({ pagina }) => {
    const b = ficha('Beto')
    const api = await simularAlunos(pagina, [b])
    await pagina.goto(`/alunos/${b.id}`)
    await expect(secao(pagina).getByText('Convidar para o Corner')).toBeVisible()
    await gerar(pagina).click()

    await expect(campoDoLink(pagina)).toHaveValue(/^http:\/\/localhost:3100\/convite\/[A-Za-z0-9_-]{43}$/)
    await expect(campoDoLink(pagina)).toHaveValue(api.links[0])
    await expect(campoDoLink(pagina)).toHaveAttribute('readonly', '')
    await expect(pagina.getByText('Quem abrir este link primeiro e aceitar fica vinculado ao aluno. Mande só para ele.')).toBeVisible()
    const email = pagina.getByRole('button', { name: 'Enviar por e-mail' })
    await expect(email).toBeDisabled()
    await expect(email).toHaveAccessibleDescription('Envio por e-mail ainda não está disponível.')
    await expect(pagina.getByText('Convidado', { exact: true })).toBeVisible() // o selo do topo
    expect(api.escritas().map(p => [p.metodo, p.caminho])).toEqual([['POST', `/api/cornerman/alunos/${b.id}/convite`]])
  })

  test('duplo clique em "Gerar link de convite": um pedido só', async ({ pagina }) => {
    const b = ficha('Beto')
    const api = await simularAlunos(pagina, [b], { atrasoMs: 500 })
    await pagina.goto(`/alunos/${b.id}`)
    await gerar(pagina).dblclick()
    await expect(campoDoLink(pagina)).toBeVisible()
    expect(api.escritas()).toHaveLength(1)
  })

  test('"Gerar novo link" faz um segundo pedido e mostra o link NOVO (o antigo morre no servidor)', async ({ pagina }) => {
    const b = ficha('Beto')
    const api = await simularAlunos(pagina, [b])
    await pagina.goto(`/alunos/${b.id}`)
    await gerar(pagina).click()
    await expect(campoDoLink(pagina)).toHaveValue(api.links[0])
    await pagina.getByRole('button', { name: 'Gerar novo link' }).click()
    await expect(campoDoLink(pagina)).toHaveValue(api.links[1])
    expect(api.links[0]).not.toBe(api.links[1])
    expect(api.escritas()).toHaveLength(2)
  })

  test('"Copiar link" copia o link exato e avisa', async ({ pagina, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:3100' })
    const b = ficha('Beto')
    const api = await simularAlunos(pagina, [b])
    await pagina.goto(`/alunos/${b.id}`)
    await gerar(pagina).click()
    await pagina.getByRole('button', { name: 'Copiar link' }).click()
    await expect(pagina.getByText('Link copiado')).toBeVisible()
    expect(await pagina.evaluate(() => navigator.clipboard.readText())).toBe(api.links[0])
  })

  test('"Copiar link" sem permissão da área de transferência: avisa como fazer à mão e deixa o link selecionado', async ({ pagina }) => {
    const b = ficha('Beto')
    await simularAlunos(pagina, [b])
    await pagina.goto(`/alunos/${b.id}`)
    await gerar(pagina).click()
    await expect(campoDoLink(pagina)).toBeVisible()
    await pagina.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error('negado')) })
    await pagina.getByRole('button', { name: 'Copiar link' }).click()
    await expect(pagina.getByText('Não foi possível copiar. Selecione e copie o link.')).toBeVisible()
    const selecionado = await campoDoLink(pagina).evaluate((el: HTMLInputElement) => el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0))
    expect(selecionado).toBe(await campoDoLink(pagina).inputValue())
  })

  test('"Compartilhar" sem o compartilhamento do aparelho: link do WhatsApp com o texto e o endereço codificados', async ({ pagina }) => {
    await pagina.addInitScript(() => Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }))
    const b = ficha('Beto')
    const api = await simularAlunos(pagina, [b])
    await pagina.goto(`/alunos/${b.id}`)
    await gerar(pagina).click()
    const compartilhar = pagina.getByRole('link', { name: 'Compartilhar' })
    await expect(compartilhar).toBeVisible()
    const href = (await compartilhar.getAttribute('href')) ?? ''
    expect(href.startsWith('https://wa.me/?text=')).toBe(true)
    expect(decodeURIComponent(href.slice('https://wa.me/?text='.length))).toBe(`Convite do seu treinador no Corner: ${api.links[0]}`)
    await expect(compartilhar).toHaveAttribute('rel', /noopener/)
  })

  test('"Compartilhar" com o compartilhamento do aparelho: chama navigator.share com o link', async ({ pagina }) => {
    await pagina.addInitScript(() => {
      ;(window as unknown as { __compartilhado: unknown[] }).__compartilhado = []
      Object.defineProperty(navigator, 'share', { value: (d: unknown) => { (window as unknown as { __compartilhado: unknown[] }).__compartilhado.push(d); return Promise.resolve() }, configurable: true })
    })
    const b = ficha('Beto')
    const api = await simularAlunos(pagina, [b])
    await pagina.goto(`/alunos/${b.id}`)
    await gerar(pagina).click()
    await pagina.getByRole('button', { name: 'Compartilhar' }).click()
    const dados = await pagina.evaluate(() => (window as unknown as { __compartilhado: { url: string; text: string }[] }).__compartilhado)
    expect(dados).toHaveLength(1)
    expect(dados[0].url).toBe(api.links[0])
    expect(dados[0].text).toContain('Convite do seu treinador no Corner')
  })

  test('recarregar a ficha convidada: "Convite pendente" com a validade, SEM o link, com "Gerar novo link" e "Cancelar convite"', async ({ pagina }) => {
    const b = ficha('Beto')
    await simularAlunos(pagina, [b])
    await pagina.goto(`/alunos/${b.id}`)
    await gerar(pagina).click()
    await expect(campoDoLink(pagina)).toBeVisible()
    await pagina.reload()
    await expect(pagina.getByText('Convite pendente · expira em 28/10')).toBeVisible()
    await expect(campoDoLink(pagina)).toHaveCount(0)
    await expect(pagina.getByRole('button', { name: 'Gerar novo link' })).toBeVisible()
    await expect(pagina.getByRole('button', { name: 'Cancelar convite' })).toBeVisible()
  })

  test('cancelar o convite: DELETE, aviso e a ficha volta a "Ficha manual"', async ({ pagina }) => {
    const b = ficha('Pendente', { status: 'convidado' })
    const api = await simularAlunos(pagina, [b])
    await pagina.goto(`/alunos/${b.id}`)
    await pagina.getByRole('button', { name: 'Cancelar convite' }).click()
    await expect(pagina.getByText('Convite cancelado')).toBeVisible()
    expect(api.escritas().map(p => [p.metodo, p.caminho])).toEqual([['DELETE', `/api/cornerman/alunos/${b.id}/convite`]])
    await expect(pagina.getByText('Ficha manual · sem dados de treino')).toBeVisible()
    await expect(gerar(pagina)).toBeVisible()
  })

  test('ficha convidada não mostra "Encerrar ficha" nem "Reabrir ficha"; mostra "Editar dados" e "Apagar ficha"', async ({ pagina }) => {
    const b = ficha('Pendente', { status: 'convidado' })
    await simularAlunos(pagina, [b])
    await pagina.goto(`/alunos/${b.id}`)
    await expect(pagina.getByRole('button', { name: 'Editar dados' })).toBeVisible()
    await expect(pagina.getByRole('button', { name: 'Apagar ficha' })).toBeVisible()
    await expect(pagina.getByRole('button', { name: 'Encerrar ficha' })).toHaveCount(0)
    await expect(pagina.getByRole('button', { name: 'Reabrir ficha' })).toHaveCount(0)
  })

  test('ficha com conta: "Vinculado a uma conta do Corner.", selo "Com conta", sem botões de convite', async ({ pagina }) => {
    const b = ficha('Com conta', { comConta: true })
    await simularAlunos(pagina, [b])
    await pagina.goto(`/alunos/${b.id}`)
    await expect(pagina.getByText('Vinculado a uma conta do Corner.')).toBeVisible()
    await expect(pagina.getByText('Com conta no Corner')).toBeVisible()
    await expect(gerar(pagina)).toHaveCount(0)
    await expect(pagina.getByRole('button', { name: 'Gerar novo link' })).toHaveCount(0)
    await expect(pagina.getByText('Ficha manual · sem dados de treino')).toHaveCount(0)
  })

  test('encerrar uma ficha COM conta pergunta com o aviso do vínculo, desfaz o vínculo e reabrir não o restaura', async ({ pagina }) => {
    const b = ficha('Com conta', { comConta: true })
    const api = await simularAlunos(pagina, [b])
    await pagina.goto(`/alunos/${b.id}`)
    const perguntas: string[] = []
    pagina.removeAllListeners('dialog')
    pagina.on('dialog', d => { perguntas.push(d.message()); void d.accept() })
    await pagina.getByRole('button', { name: 'Encerrar ficha' }).click()
    await expect(pagina.getByText('Encerrada', { exact: true })).toBeVisible()
    expect(perguntas).toEqual(['Encerrar a ficha de Com conta? O vínculo com a conta dele acaba e você perde o acesso aos dados de treino dele. Para vincular de novo, será preciso um convite novo.'])
    expect(api.escritas()[0].corpo).toEqual({ status: 'encerrado' })
    expect(api.fichas[0].comConta).toBe(false)

    await pagina.getByRole('button', { name: 'Reabrir ficha' }).click()
    await expect(pagina.getByText('Ficha manual · sem dados de treino')).toBeVisible()
    await expect(pagina.getByText('Com conta no Corner')).toHaveCount(0)
  })

  test('ficha encerrada sem conta: gerar o convite reabre a vaga e a ficha vira "Convidado"', async ({ pagina }) => {
    const b = ficha('Antiga', { status: 'encerrado' })
    const api = await simularAlunos(pagina, [b])
    await pagina.goto(`/alunos/${b.id}`)
    await gerar(pagina).click()
    await expect(campoDoLink(pagina)).toBeVisible()
    await expect(pagina.getByText('Convidado', { exact: true })).toBeVisible()
    expect(api.fichas[0].status).toBe('convidado')
  })

  test('lista: selos "Convidado", "Com conta", "Ficha manual" e "Encerrada" nos cartões certos', async ({ pagina }) => {
    await simularAlunos(pagina, [
      ficha('A manual'), ficha('B convidada', { status: 'convidado' }), ficha('C com conta', { comConta: true }), ficha('D parada', { status: 'encerrado' }),
    ])
    await pagina.goto('/alunos')
    const cartoes = pagina.getByRole('list', { name: 'Alunos' }).getByRole('listitem')
    await expect(cartoes).toHaveCount(3)
    await expect(cartoes.nth(0)).toContainText('Ficha manual')
    await expect(cartoes.nth(1)).toContainText('Convidado')
    await expect(cartoes.nth(2)).toContainText('Com conta')
    await pagina.getByRole('button', { name: /Encerrados \(1\)/ }).click()
    await expect(pagina.getByRole('list', { name: 'Fichas encerradas' }).getByRole('listitem').first()).toContainText('Encerrada')
  })

  test('acessibilidade (axe): ficha com convite pendente, com o link gerado e com conta', async ({ pagina }) => {
    const pendente = ficha('Pendente', { status: 'convidado' })
    const manual = ficha('Manual')
    const comConta = ficha('Com conta', { comConta: true })
    await simularAlunos(pagina, [pendente, manual, comConta])
    await pagina.goto(`/alunos/${pendente.id}`)
    await expect(pagina.getByText(/Convite pendente/)).toBeVisible()
    expect(await auditar(pagina), 'pendente').toEqual([])
    await pagina.goto(`/alunos/${manual.id}`)
    await gerar(pagina).click()
    await expect(campoDoLink(pagina)).toBeVisible()
    expect(await auditar(pagina), 'com o link').toEqual([])
    await pagina.goto(`/alunos/${comConta.id}`)
    await expect(pagina.getByText('Vinculado a uma conta do Corner.')).toBeVisible()
    expect(await auditar(pagina), 'com conta').toEqual([])
  })

  test('teclado: os botões do convite recebem foco, na ordem', async ({ pagina }) => {
    const b = ficha('Beto')
    await simularAlunos(pagina, [b])
    await pagina.goto(`/alunos/${b.id}`)
    await gerar(pagina).focus()
    await pagina.keyboard.press('Enter')
    await expect(campoDoLink(pagina)).toBeVisible()
    await pagina.getByRole('button', { name: 'Copiar link' }).focus()
    await expect(pagina.getByRole('button', { name: 'Copiar link' })).toBeFocused()
  })
})

test.describe('convite na ficha: respostas de erro de propósito', () => {
  test.use({ toleraRespostaDeErro: true })
  test.beforeEach(async ({ pagina }) => {
    await simularEstado(pagina, ativa('cornerman'))
  })

  test('ficha encerrada com 20 ativas: o servidor recusa (limite) e a mensagem aparece; a ficha continua encerrada', async ({ pagina }) => {
    const antiga = ficha('Antiga', { status: 'encerrado' })
    await simularAlunos(pagina, [...fichas(20), antiga])
    await pagina.goto(`/alunos/${antiga.id}`)
    await pagina.getByRole('button', { name: 'Gerar link de convite' }).click()
    await expect(alerta(pagina)).toContainText('Você já tem 20 alunos.')
    await expect(pagina.getByRole('textbox', { name: 'Link do convite' })).toHaveCount(0)
    await expect(pagina.getByText('Encerrada', { exact: true })).toBeVisible()
  })

  test('sem conexão ao gerar: mensagem de rede, nenhum link e o botão continua disponível', async ({ pagina }) => {
    const b = ficha('Beto')
    await simularAlunos(pagina, [b])
    await pagina.goto(`/alunos/${b.id}`)
    await expect(pagina.getByRole('button', { name: 'Gerar link de convite' })).toBeVisible() // a ficha carregou antes de a rede "cair"
    await simularAlunos(pagina, [b], { falhaDeRede: true }) // a rota registrada por último vale primeiro
    await pagina.getByRole('button', { name: 'Gerar link de convite' }).click()
    await expect(alerta(pagina)).toHaveText('Sem conexão. Verifique a internet e tente de novo.')
    await expect(pagina.getByRole('textbox', { name: 'Link do convite' })).toHaveCount(0)
    await expect(pagina.getByRole('button', { name: 'Gerar link de convite' })).toBeEnabled()
  })
})
