import { PLANOS } from '../data/planos'
import { expect, gravarRaw, lerJson, lerRaw, test } from './fixtures'

// Quarta-feira, 14/10/2026, meio-dia: datas fixas deixam o conteúdo do plano previsível.
const HOJE = new Date('2026-10-14T12:00:00-03:00')
const plano = (id: string) => PLANOS.find(p => p.id === id)!

test.describe('navegação', () => {
  test('a barra inferior leva a cada tela e marca a aba atual', async ({ pagina }) => {
    await pagina.goto('/hoje')
    const nav = pagina.getByRole('navigation', { name: 'Navegação principal' })
    for (const [nome, caminho] of [['Plano', '/plano'], ['Progresso', '/progresso'], ['Perfil', '/perfil'], ['Hoje', '/hoje']] as const) {
      await nav.getByRole('link', { name: nome }).click()
      await pagina.waitForURL(`**${caminho}`)
      await expect(nav.getByRole('link', { name: nome })).toHaveAttribute('aria-current', 'page')
    }
  })

  test('o cronômetro ocupa a tela inteira, sem a barra inferior', async ({ pagina }) => {
    await pagina.goto('/treino?tipo=tec&rounds=2&min=1&descanso=10')
    await expect(pagina.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(pagina.getByRole('navigation', { name: 'Navegação principal' })).toHaveCount(0)
  })
})

test.describe('tela Hoje', () => {
  test('mostra as seções e o check-in grava as notas e vira resumo de prontidão', async ({ pagina }) => {
    await pagina.clock.setFixedTime(HOJE)
    await gravarRaw(pagina, 'plano', JSON.stringify({ planoId: 'fundamentos', inicio: '2026-10-12' }))
    await pagina.goto('/hoje')
    for (const titulo of ['Como você está', 'Sua semana', 'Treino de hoje', 'Para evoluir']) {
      await expect(pagina.getByRole('heading', { name: titulo, exact: true })).toBeVisible()
    }

    const salvar = pagina.getByRole('button', { name: 'Salvar check-in' })
    await expect(salvar).toBeDisabled()
    await pagina.getByRole('radiogroup', { name: 'Como foi o sono?' }).getByRole('radio', { name: '4' }).click()
    await pagina.getByRole('radiogroup', { name: 'Nível de energia' }).getByRole('radio', { name: '3' }).click()
    await expect(salvar).toBeDisabled() // falta a dor
    await pagina.getByRole('radiogroup', { name: 'Dor muscular ou nas articulações' }).getByRole('radio', { name: '2' }).click()
    await salvar.click()

    await expect(pagina.getByText('Check-in salvo')).toBeVisible()
    const resumo = pagina.getByRole('region', { name: 'Check-in de hoje' })
    await expect(resumo).toContainText('Prontidão de hoje')
    await expect(resumo).toContainText('Sono 4 · Energia 3 · Dor 2')
    expect(await lerJson(pagina, 'checkins')).toEqual([{ data: '2026-10-14', sono: 4, dor: 2, energia: 3 }])

    await resumo.getByRole('button', { name: 'Refazer' }).click()
    await expect(pagina.getByRole('button', { name: 'Salvar check-in' })).toBeVisible()
  })

  test('sem plano, mas com perfil feito, oferece escolher um', async ({ pagina }) => {
    await gravarRaw(pagina, 'config', JSON.stringify({ onboardingFeito: true }))
    await pagina.goto('/hoje')
    await expect(pagina.getByRole('heading', { name: 'Treino de hoje', exact: true })).toBeVisible()
    await pagina.getByRole('button', { name: /Escolha um plano de treino/ }).click()
    await expect(pagina.getByRole('dialog', { name: 'Escolher plano' })).toBeVisible()
  })
})

test.describe('tela Plano', () => {
  test.beforeEach(async ({ pagina }) => {
    await pagina.clock.setFixedTime(HOJE)
    await gravarRaw(pagina, 'plano', JSON.stringify({ planoId: 'fundamentos', inicio: '2026-10-12' }))
  })

  test('mostra o plano ativo, a semana 1 e navega entre as semanas', async ({ pagina }) => {
    const p = plano('fundamentos')
    await pagina.goto('/plano')
    await expect(pagina.getByRole('heading', { name: p.nome })).toBeVisible()
    await expect(pagina.getByText(`Semana 1 de ${p.semanas}`).first()).toBeVisible()

    const seletor = pagina.getByRole('group', { name: 'Semana do plano' })
    await expect(seletor.getByRole('button', { name: 'Semana anterior' })).toBeDisabled()
    await seletor.getByRole('button', { name: 'Próxima semana' }).click()
    await expect(seletor).toContainText(`Semana 2 de ${p.semanas}`)
    await expect(seletor).toContainText('Próxima semana')
    await seletor.getByRole('button', { name: 'Semana anterior' }).click()
    await expect(seletor).toContainText('Esta semana')
  })

  test('encerrar o plano pede confirmação, limpa o plano e volta ao estado sem plano', async ({ pagina }) => {
    await pagina.goto('/plano')
    await pagina.getByRole('button', { name: 'Encerrar plano' }).click() // a fixture aceita o confirm
    await expect(pagina.getByText('Plano encerrado')).toBeVisible()
    await expect(pagina.getByText('Nenhum plano ativo')).toBeVisible()
    expect(await lerJson(pagina, 'plano')).toBeNull()
  })

  test('mover uma sessão pendente de dia grava o reagendamento da semana 1', async ({ pagina }) => {
    await pagina.goto('/plano')
    expect(await lerRaw(pagina, 'reag')).toBeNull()
    const rotulo = await pagina.getByLabel(/^Mudar o dia de /).first().getAttribute('aria-label')
    const seletor = pagina.getByLabel(rotulo!, { exact: true }) // a lista reordena depois de mover; segue a mesma sessão
    await expect(seletor).toBeVisible()
    await seletor.selectOption({ label: 'Dom' })
    await expect.poll(async () => Object.values((await lerJson(pagina, 'reag')) ?? {})).toEqual([0])
    expect(Object.keys(await lerJson(pagina, 'reag'))[0]).toMatch(/^1:/)
    await expect(seletor).toHaveValue('0')
  })
})

test.describe('tela Progresso', () => {
  test('sem treinos mostra o estado vazio com atalho para registrar', async ({ pagina }) => {
    await pagina.goto('/progresso')
    await expect(pagina.getByText('Nenhum treino registrado')).toBeVisible()
    await pagina.getByRole('button', { name: 'Registrar treino' }).first().click()
    await expect(pagina.getByRole('dialog', { name: 'Registrar treino' })).toBeVisible()
  })

  test('com treinos mostra o histórico, os tipos e os dados de sparring', async ({ pagina }) => {
    await pagina.clock.setFixedTime(HOJE)
    await gravarRaw(pagina, 'historico', JSON.stringify([
      { id: 'a', data: '2026-10-13T12:00:00.000Z', tipo: 'spa', rounds: 5, minPorRound: 2, rpe: 8, duracaoSegundos: 1500, sparring: { intensidade: 'forte', cabeca: 'leves', parceiro: 'Marcos' }, nota: 'Bom ritmo' },
      { id: 'b', data: '2026-10-12T12:00:00.000Z', tipo: 'tec', rounds: 6, minPorRound: 3, rpe: 6, duracaoSegundos: 1800 },
    ]))
    await pagina.goto('/progresso')
    await expect(pagina.getByText('2 treinos', { exact: true })).toBeVisible()
    await expect(pagina.getByText('5 rounds de 2 min · RPE 8')).toBeVisible()
    await expect(pagina.getByText(/Sparring forte · pancadas leves na cabeça · com Marcos/)).toBeVisible()
    await expect(pagina.getByText('“Bom ritmo”')).toBeVisible()
    await expect(pagina.getByText('6 rounds de 3 min · RPE 6')).toBeVisible()
  })
})

test.describe('tela Perfil', () => {
  test('postura e meta semanal são gravadas na configuração', async ({ pagina }) => {
    await pagina.goto('/perfil')
    await pagina.getByLabel('Postura').selectOption('canhoto')
    await pagina.getByRole('button', { name: 'Aumentar meta semanal' }).click()
    await expect.poll(async () => await lerJson(pagina, 'config')).toMatchObject({ postura: 'canhoto', metaSemanal: 4 })
    await pagina.reload()
    await expect(pagina.getByLabel('Postura')).toHaveValue('canhoto')
  })

  test('meta semanal fica entre 1 e 7', async ({ pagina }) => {
    await gravarRaw(pagina, 'config', JSON.stringify({ metaSemanal: 7 }))
    await pagina.goto('/perfil')
    await expect(pagina.getByRole('button', { name: 'Aumentar meta semanal' })).toBeDisabled()
    await gravarRaw(pagina, 'config', JSON.stringify({ metaSemanal: 1 }))
    await pagina.reload()
    await expect(pagina.getByRole('button', { name: 'Diminuir meta semanal' })).toBeDisabled()
  })
})

test.describe('biblioteca técnica', () => {
  test('as abas trocam o conteúdo e o filtro de nível marca o escolhido', async ({ pagina }) => {
    await pagina.goto('/tecnicas')
    await expect(pagina.getByRole('heading', { name: 'Biblioteca técnica' })).toBeVisible()
    const abas = pagina.getByRole('tablist', { name: 'Seções da biblioteca' }).getByRole('tab')
    const total = await abas.count()
    expect(total).toBeGreaterThanOrEqual(3)
    for (let i = 0; i < total; i++) {
      await abas.nth(i).click()
      await expect(abas.nth(i)).toHaveAttribute('aria-selected', 'true')
      await expect(pagina.getByRole('tabpanel')).toBeVisible()
    }
  })

  test('a aba da URL abre direto (preparação)', async ({ pagina }) => {
    await pagina.goto('/tecnicas?aba=preparacao')
    await expect(pagina.getByRole('tab', { selected: true })).toBeVisible()
  })
})

test.describe('saúde', () => {
  test('lesão: registrar e marcar como resolvida', async ({ pagina }) => {
    await pagina.goto('/saude')
    await pagina.getByLabel('Onde dói?').selectOption({ label: 'Cabeça / pescoço' })
    await pagina.getByRole('radiogroup', { name: 'Intensidade da dor' }).getByRole('radio', { name: '3', exact: true }).click()
    await pagina.getByLabel('Observação sobre a lesão').fill('Dor leve no pescoço')
    await pagina.getByRole('button', { name: 'Registrar lesão' }).click()

    await expect.poll(async () => (await lerJson(pagina, 'lesoes'))?.length).toBe(1)
    expect((await lerJson(pagina, 'lesoes'))[0]).toMatchObject({ regiao: 'cabeca', intensidade: 3, nota: 'Dor leve no pescoço' })

    await pagina.getByRole('button', { name: 'Resolvida' }).click()
    await expect(pagina.getByText('Marcada como resolvida')).toBeVisible()
    expect((await lerJson(pagina, 'lesoes'))[0].resolvidaEm).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    await expect(pagina.getByText('0 ativas')).toBeVisible()
  })

  test('lesão ativa pode ser removida', async ({ pagina }) => {
    await gravarRaw(pagina, 'lesoes', JSON.stringify([{ id: 'l1', regiao: 'ombros', intensidade: 2, inicio: '2026-10-01' }]))
    await pagina.goto('/saude')
    await expect(pagina.getByText('1 ativa', { exact: true })).toBeVisible()
    await pagina.getByRole('button', { name: 'Remover lesão em Ombros' }).click()
    await expect.poll(async () => (await lerJson(pagina, 'lesoes')).length).toBe(0)
  })

  test('peso: valor inválido mostra erro e não grava; remover apaga o registro', async ({ pagina }) => {
    await pagina.goto('/saude')
    await pagina.fill('input[aria-label="Peso de hoje em quilos"]', '5')
    await pagina.getByRole('button', { name: 'Registrar', exact: true }).click()
    await expect(pagina.getByText('Digite um peso entre 30 e 250 kg.')).toBeVisible()
    expect(await lerRaw(pagina, 'pesos')).toBeNull()

    await pagina.fill('input[aria-label="Peso de hoje em quilos"]', '70')
    await pagina.getByRole('button', { name: 'Registrar', exact: true }).click()
    await expect.poll(async () => (await lerJson(pagina, 'pesos'))?.length).toBe(1)
    await pagina.getByText(/Ver registros/).click()
    await pagina.getByRole('button', { name: 'Remover registro de 70,0 kg' }).click()
    await expect.poll(async () => (await lerJson(pagina, 'pesos')).length).toBe(0)
  })

  test('categoria de peso é gravada na configuração e pode ser removida', async ({ pagina }) => {
    await pagina.goto('/saude')
    await pagina.getByLabel('Categoria de peso em quilos').fill('66')
    await pagina.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect.poll(async () => (await lerJson(pagina, 'config'))?.pesoCategoria).toBe(66)
    await pagina.getByLabel('Categoria de peso em quilos').fill('')
    await pagina.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect.poll(async () => (await lerJson(pagina, 'config'))?.pesoCategoria).toBeNull()
  })
})

test.describe('cronômetro de rounds', () => {
  test('preparo, pausa, retomada e encerramento sem rounds completos', async ({ pagina }) => {
    await pagina.goto('/treino?tipo=tec&rounds=2&min=1&descanso=10')
    await expect(pagina.getByText('Plano dos rounds')).toBeVisible()
    await pagina.getByRole('button', { name: /Começar/ }).click()

    await expect(pagina.getByText('Prepare-se', { exact: true })).toBeVisible()
    await pagina.getByRole('button', { name: 'Pausar' }).click()
    await expect(pagina.getByText('Pausado', { exact: true })).toBeVisible()
    await pagina.getByRole('button', { name: 'Retomar' }).click()
    await expect(pagina.getByText('Prepare-se', { exact: true })).toBeVisible()

    await pagina.getByRole('button', { name: 'Pular para a próxima fase' }).click()
    await expect(pagina.getByText('Round 1 de 2', { exact: true })).toBeVisible()

    await pagina.getByRole('button', { name: 'Encerrar treino' }).click() // a fixture aceita o confirm
    await expect(pagina.getByRole('heading', { name: 'Treino encerrado' })).toBeVisible()
    await expect(pagina.getByText('Nenhum round foi completo')).toBeVisible()
  })

  test('parâmetros inválidos na URL caem nos padrões e a tela abre', async ({ pagina }) => {
    await pagina.goto('/treino?rounds=abc&min=-5&descanso=9999&tipo=xyz')
    await expect(pagina.getByRole('button', { name: /Começar/ })).toBeVisible()
    await expect(pagina.getByText(/rounds de/).first()).toBeVisible()
  })
})
