import { PLANOS } from '../data/planos'
import { expect, gravarRaw, lerJson, lerRaw, test } from './fixtures'

const plano = (id: string) => PLANOS.find(p => p.id === id)!

/** Abre o painel de registro pelo botão "+" da barra inferior. */
async function abrirRegistro(pagina: import('@playwright/test').Page) {
  await pagina.goto('/hoje')
  await pagina.getByRole('button', { name: 'Registrar treino', exact: true }).click()
  await expect(pagina.getByRole('dialog', { name: 'Registrar treino' })).toBeVisible()
}

test.describe('painel: registrar treino', () => {
  test('técnica: escolher, ajustar rounds e esforço, anotar, salvar e concluir', async ({ pagina }) => {
    await abrirRegistro(pagina)
    await pagina.getByRole('dialog').getByRole('button', { name: /Técnica/ }).click()

    const detalhes = pagina.getByRole('dialog', { name: 'Técnica' })
    await expect(detalhes).toBeVisible()
    await detalhes.getByRole('button', { name: 'Aumentar Rounds' }).click() // técnica abre com 6 rounds de 3 min
    await detalhes.getByRole('button', { name: '8', exact: true }).click()
    await expect(detalhes.getByRole('button', { name: '8', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await detalhes.getByLabel('Anotações do treino').fill('Jab mais curto')
    await expect(detalhes).toContainText('21 min') // 7 rounds x 3 min

    await detalhes.getByRole('button', { name: 'Salvar treino' }).click()
    const concluido = pagina.getByRole('dialog', { name: 'Concluído' })
    await expect(concluido).toContainText('Treino registrado!')
    await expect(concluido).toContainText('168') // carga = 7 x 3 x RPE 8
    await expect(concluido.getByRole('alert')).toHaveCount(0) // sem pancada forte, sem aviso

    await concluido.getByRole('button', { name: 'Concluir' }).click()
    await expect(pagina.getByRole('dialog')).toHaveCount(0)
    await expect(pagina.getByText('Treino salvo no seu histórico')).toBeVisible()

    const historico = await lerJson(pagina, 'historico')
    expect(historico).toHaveLength(1)
    expect(historico[0]).toMatchObject({ tipo: 'tec', rounds: 7, minPorRound: 3, rpe: 8, nota: 'Jab mais curto' })
    expect(historico[0].sparring).toBeUndefined()

    await pagina.goto('/progresso')
    await expect(pagina.getByText('1 treino', { exact: true })).toBeVisible()
  })

  test('sparring: campos extras, aviso de pancada forte e alerta na tela Hoje', async ({ pagina }) => {
    await abrirRegistro(pagina)
    await pagina.getByRole('dialog').getByRole('button', { name: /Sparring/ }).click()

    const detalhes = pagina.getByRole('dialog', { name: 'Sparring' })
    await detalhes.getByRole('radiogroup', { name: 'Intensidade do sparring' }).getByRole('radio', { name: 'Forte' }).click()
    await detalhes.getByRole('radiogroup', { name: 'Pancadas na cabeça' }).getByRole('radio', { name: 'Fortes' }).click()
    await detalhes.getByLabel('Parceiro de sparring').fill('Zé')
    await detalhes.getByRole('button', { name: 'Salvar treino' }).click()

    const concluido = pagina.getByRole('dialog', { name: 'Concluído' })
    await expect(concluido.getByRole('alert')).toContainText('pancadas fortes na cabeça')
    await concluido.getByRole('button', { name: 'Concluir' }).click()

    const [t] = await lerJson(pagina, 'historico')
    expect(t).toMatchObject({ tipo: 'spa', sparring: { intensidade: 'forte', cabeca: 'fortes', parceiro: 'Zé' } })

    await pagina.goto('/hoje')
    await pagina.getByRole('button', { name: /^Alertas/ }).click()
    await expect(pagina.getByRole('dialog', { name: 'Alertas' })).toContainText('Pancadas fortes na cabeça')
  })

  test('voltar leva à escolha do tipo e fechar encerra o painel sem salvar nada', async ({ pagina }) => {
    await abrirRegistro(pagina)
    await pagina.getByRole('dialog').getByRole('button', { name: /Condicionamento/ }).click()
    await pagina.getByRole('dialog', { name: 'Condicionamento' }).getByRole('button', { name: 'Voltar' }).click()
    await expect(pagina.getByRole('dialog', { name: 'Registrar treino' })).toBeVisible()
    await pagina.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click()
    await expect(pagina.getByRole('dialog')).toHaveCount(0)
    expect(await lerRaw(pagina, 'historico')).toBeNull()
  })

  test('os contadores respeitam os limites (rounds de 1 a 20)', async ({ pagina }) => {
    await abrirRegistro(pagina)
    await pagina.getByRole('dialog').getByRole('button', { name: /Técnica/ }).click()
    const detalhes = pagina.getByRole('dialog', { name: 'Técnica' })
    for (let i = 0; i < 5; i++) await detalhes.getByRole('button', { name: 'Diminuir Rounds' }).click()
    await expect(detalhes.getByRole('button', { name: 'Diminuir Rounds' })).toBeDisabled()
    for (let i = 0; i < 19; i++) await detalhes.getByRole('button', { name: 'Aumentar Rounds' }).click()
    await expect(detalhes.getByRole('button', { name: 'Aumentar Rounds' })).toBeDisabled()
  })

  test('treino salvo a partir do painel tem a duração do tempo gasto (no mínimo 4 s) e id próprio', async ({ pagina }) => {
    await abrirRegistro(pagina)
    await pagina.getByRole('dialog').getByRole('button', { name: /Condicionamento/ }).click()
    await pagina.getByRole('dialog', { name: 'Condicionamento' }).getByRole('button', { name: 'Salvar treino' }).click()
    await pagina.getByRole('dialog', { name: 'Concluído' }).getByRole('button', { name: 'Concluir' }).click()
    const [t] = await lerJson(pagina, 'historico')
    expect(typeof t.id).toBe('string')
    expect(t.id.length).toBeGreaterThan(5)
    expect(t.duracaoSegundos).toBeGreaterThanOrEqual(4)
  })
})

test.describe('painel: perfil de atleta', () => {
  test('cinco passos, plano recomendado e ativação gravam perfil e plano', async ({ pagina }) => {
    await pagina.goto('/perfil')
    await pagina.getByRole('button', { name: /Montar perfil de atleta/ }).click()
    const painel = pagina.getByRole('dialog', { name: 'Perfil de atleta' })
    await expect(painel).toContainText('Passo 1 de 5')

    await painel.getByRole('button', { name: /Canhoto/ }).click()
    await expect(painel).toContainText('Passo 2 de 5')
    await painel.getByRole('button', { name: 'Mais de 3 anos ou já compito' }).click()
    await expect(painel).toContainText('Passo 3 de 5')
    await painel.getByRole('button', { name: /Competir/ }).click()
    await expect(painel).toContainText('Passo 4 de 5')
    for (let i = 0; i < 2; i++) await painel.getByRole('button', { name: 'Aumentar Dias por semana' }).click() // 3 -> 5
    await painel.getByRole('button', { name: 'Ver plano recomendado' }).click()

    const rec = plano('pre-competicao')
    await expect(painel).toContainText('Passo 5 de 5')
    await expect(painel).toContainText(rec.nome)
    await painel.getByRole('button', { name: 'Ativar este plano' }).click()
    await expect(pagina.getByText(`Perfil salvo. Plano ${rec.nome} ativado`)).toBeVisible()

    expect(await lerJson(pagina, 'plano')).toMatchObject({ planoId: 'pre-competicao' })
    expect(await lerJson(pagina, 'config')).toMatchObject({ postura: 'canhoto', experiencia: 'mais3', onboardingFeito: true, metaSemanal: Math.min(5, rec.diasPorSemana) })
  })

  test('iniciante recebe o plano Fundamentos, e escolher menos dias do que o plano pede mostra aviso e ajusta a meta', async ({ pagina }) => {
    await pagina.goto('/perfil')
    await pagina.getByRole('button', { name: /Montar perfil de atleta/ }).click()
    const painel = pagina.getByRole('dialog', { name: 'Perfil de atleta' })
    await painel.getByRole('button', { name: /Ortodoxo/ }).click()
    await painel.getByRole('button', { name: 'Nunca treinei' }).click()
    await painel.getByRole('button', { name: /Técnica/ }).click()
    await painel.getByRole('button', { name: 'Diminuir Dias por semana' }).click() // 3 -> 2
    await painel.getByRole('button', { name: 'Ver plano recomendado' }).click()

    const rec = plano('fundamentos')
    await expect(painel).toContainText(rec.nome)
    if (rec.diasPorSemana > 2) await expect(painel).toContainText('sua meta semanal ficará em 2×')
    await painel.getByRole('button', { name: 'Ativar este plano' }).click()
    expect(await lerJson(pagina, 'plano')).toMatchObject({ planoId: 'fundamentos' })
    expect((await lerJson(pagina, 'config')).metaSemanal).toBe(Math.min(2, rec.diasPorSemana))
  })

  test('voltar entre os passos e fechar sem concluir não grava nada', async ({ pagina }) => {
    await pagina.goto('/perfil')
    await pagina.getByRole('button', { name: /Montar perfil de atleta/ }).click()
    const painel = pagina.getByRole('dialog', { name: 'Perfil de atleta' })
    await painel.getByRole('button', { name: /Ortodoxo/ }).click()
    await expect(painel).toContainText('Passo 2 de 5')
    await painel.getByRole('button', { name: 'Voltar' }).click()
    await expect(painel).toContainText('Passo 1 de 5')
    await painel.getByRole('button', { name: 'Fechar' }).click()
    await expect(pagina.getByRole('dialog')).toHaveCount(0)
    expect(await lerRaw(pagina, 'config')).toBeNull()
    expect(await lerRaw(pagina, 'plano')).toBeNull()
  })

  test('"Ver outros planos" salva o perfil e abre a lista de planos', async ({ pagina }) => {
    await pagina.goto('/perfil')
    await pagina.getByRole('button', { name: /Montar perfil de atleta/ }).click()
    const painel = pagina.getByRole('dialog', { name: 'Perfil de atleta' })
    await painel.getByRole('button', { name: /Ortodoxo/ }).click()
    await painel.getByRole('button', { name: 'Menos de 1 ano' }).click()
    await painel.getByRole('button', { name: /Técnica/ }).click()
    await painel.getByRole('button', { name: 'Ver plano recomendado' }).click()
    await painel.getByRole('button', { name: 'Ver outros planos' }).click()
    await expect(pagina.getByRole('dialog', { name: 'Escolher plano' })).toBeVisible()
    expect(await lerJson(pagina, 'config')).toMatchObject({ onboardingFeito: true })
    expect(await lerRaw(pagina, 'plano')).toBeNull() // ainda não escolheu
  })
})

test.describe('painel: escolher plano', () => {
  test('sem plano ativo, escolher ativa direto; trocar pede confirmação e zera os reagendamentos', async ({ pagina }) => {
    await pagina.goto('/plano')
    await pagina.getByRole('button', { name: 'Escolher plano' }).click()
    const lista = pagina.getByRole('dialog', { name: 'Escolher plano' })
    for (const p of PLANOS) await expect(lista).toContainText(p.nome)

    await lista.getByRole('button', { name: new RegExp(plano('base-aerobica').nome) }).click()
    await expect(pagina.getByText(`Plano ${plano('base-aerobica').nome} ativado`)).toBeVisible()
    expect(await lerJson(pagina, 'plano')).toMatchObject({ planoId: 'base-aerobica' })

    await gravarRaw(pagina, 'reag', JSON.stringify({ '1:qualquer': 2 }))
    await pagina.getByRole('button', { name: 'Trocar' }).click() // a fixture aceita o window.confirm
    const lista2 = pagina.getByRole('dialog', { name: 'Escolher plano' })
    await expect(lista2.getByRole('button', { name: new RegExp(plano('base-aerobica').nome) })).toHaveAttribute('aria-pressed', 'true')
    await lista2.getByRole('button', { name: new RegExp(plano('fundamentos').nome) }).click()
    await expect(pagina.getByText(`Plano ${plano('fundamentos').nome} ativado`)).toBeVisible()
    expect(await lerJson(pagina, 'plano')).toMatchObject({ planoId: 'fundamentos' })
    await expect.poll(async () => await lerJson(pagina, 'reag')).toEqual({})
  })

  test('escolher o plano que já está ativo só fecha o painel', async ({ pagina }) => {
    await gravarRaw(pagina, 'plano', JSON.stringify({ planoId: 'fundamentos', inicio: '2026-10-12' }))
    await pagina.goto('/plano')
    await pagina.getByRole('button', { name: 'Trocar' }).click()
    await pagina.getByRole('dialog', { name: 'Escolher plano' }).getByRole('button', { name: new RegExp(plano('fundamentos').nome) }).click()
    await expect(pagina.getByRole('dialog')).toHaveCount(0)
    expect(await lerJson(pagina, 'plano')).toEqual({ planoId: 'fundamentos', inicio: '2026-10-12' })
  })
})

test.describe('painel: alertas', () => {
  test('sem nada a avisar mostra a mensagem de tudo certo', async ({ pagina }) => {
    await pagina.goto('/hoje')
    await pagina.getByRole('button', { name: /^Alertas/ }).click()
    await expect(pagina.getByRole('dialog', { name: 'Alertas' })).toContainText('Tudo certo por aqui')
  })

  test('lesão ativa forte aparece como alerta crítico', async ({ pagina }) => {
    await gravarRaw(pagina, 'lesoes', JSON.stringify([{ id: 'l1', regiao: 'punhos', intensidade: 4, inicio: '2026-10-01' }]))
    await pagina.goto('/hoje')
    await pagina.getByRole('button', { name: /^Alertas/ }).click()
    const painel = pagina.getByRole('dialog', { name: 'Alertas' })
    await expect(painel).toContainText('Lesão ativa: Punhos (4/5)')
    await expect(painel).toContainText('Crítico')
  })

  test('clicar fora do painel fecha', async ({ pagina }) => {
    await pagina.goto('/hoje')
    await pagina.getByRole('button', { name: /^Alertas/ }).click()
    await expect(pagina.getByRole('dialog', { name: 'Alertas' })).toBeVisible()
    await pagina.mouse.click(210, 60) // acima do painel, no fundo escuro
    await expect(pagina.getByRole('dialog')).toHaveCount(0)
  })
})
