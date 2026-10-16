import type { Page } from '@playwright/test'
import { PLANOS } from '../data/planos'
import { ativa, cancelada, emTeste, SEM_ASSINATURA_TESTE, simularEstado } from './assinatura-simulada'
import { DADOS_DE_EXEMPLO, semear } from './dados-exemplo'
import { expect, lerJson, test, treino } from './fixtures'

// O que cada plano libera, vendo as telas de verdade com o estado da assinatura simulado.
// (As rotas de pagamento são simuladas: nenhum teste fala com o Stripe.)

const FUNDAMENTOS = PLANOS.find(p => p.id === 'fundamentos')!

// Semana anterior leve e semana atual pesada. O histórico precisa ter pelo menos 14 dias (o primeiro treino é de 28/09)
// para a carga poder ser comparada; aqui a razão passa de 1,5 e o alerta de carga é crítico. O teste do Amador prova que
// o alerta EXISTE com estes dados; só então vale conferir que ele some no gratuito.
const HISTORICO_COM_SALTO_DE_CARGA = [
  treino('z', { data: '2026-09-28T15:00:00.000Z', rounds: 1, minPorRound: 1, rpe: 3 }),
  treino('a', { data: '2026-10-03T15:00:00.000Z', rounds: 4, minPorRound: 1, rpe: 5 }),
  treino('b', { data: '2026-10-12T15:00:00.000Z', rounds: 10, minPorRound: 3, rpe: 8 }),
  treino('c', { data: '2026-10-13T15:00:00.000Z', rounds: 10, minPorRound: 3, rpe: 8 }),
]
const convite = (p: Page, plano: string, texto?: string) => {
  const c = p.getByRole('region', { name: `Recurso do plano ${plano}` })
  return texto ? c.filter({ hasText: texto }) : c
}

async function abrir(p: Page, estado: Parameters<typeof simularEstado>[1], rota: string, dados: Record<string, unknown> = DADOS_DE_EXEMPLO) {
  await simularEstado(p, estado)
  await semear(p, dados)
  await p.goto(rota)
}

test.describe('Gratuito: o que continua liberado', () => {
  test('registrar treino e histórico', async ({ pagina }) => {
    await abrir(pagina, SEM_ASSINATURA_TESTE, '/progresso')
    await expect(pagina.getByText('7 treinos', { exact: true })).toBeVisible()
    await pagina.getByRole('button', { name: 'Registrar treino', exact: true }).click()
    await expect(pagina.getByRole('dialog', { name: 'Registrar treino' })).toBeVisible()
  })

  test('cronômetro', async ({ pagina }) => {
    await abrir(pagina, SEM_ASSINATURA_TESTE, '/treino?tipo=tec&rounds=2&min=1&descanso=10')
    await expect(pagina.getByRole('button', { name: /Começar/ })).toBeVisible()
  })

  test('exportar os próprios dados', async ({ pagina }) => {
    await abrir(pagina, SEM_ASSINATURA_TESTE, '/perfil')
    const [download] = await Promise.all([pagina.waitForEvent('download'), pagina.getByRole('button', { name: /Baixar backup/ }).click()])
    expect(download.suggestedFilename()).toMatch(/^corner-backup-.*\.json$/)
  })

  test('registrar lesão (e ver as lesões ativas), porque o alerta de segurança depende disso', async ({ pagina }) => {
    await abrir(pagina, SEM_ASSINATURA_TESTE, '/saude')
    await expect(pagina.getByText('Lesões e dores')).toBeVisible()
    await pagina.getByLabel('Onde dói?').selectOption({ label: 'Cabeça / pescoço' })
    await pagina.getByLabel('Observação sobre a lesão').fill('Tontura leve')
    await pagina.getByRole('button', { name: 'Registrar lesão' }).click()
    await expect.poll(async () => (await lerJson(pagina, 'lesoes')).length).toBe(3)
  })
})

test.describe('SEGURANÇA: alertas de saúde chegam em todos os planos, inclusive no gratuito', () => {
  for (const [nome, estado] of [['gratuito', SEM_ASSINATURA_TESTE], ['Iniciante', ativa('iniciante')], ['cancelada', cancelada()]] as const) {
    test(`${nome}: registrar sparring com pancada forte na cabeça avisa na hora e gera alerta`, async ({ pagina }) => {
      await simularEstado(pagina, estado)
      await pagina.goto('/hoje')
      await pagina.getByRole('button', { name: 'Registrar treino', exact: true }).click()
      await pagina.getByRole('dialog').getByRole('button', { name: /Sparring/ }).click()
      // O campo "Pancadas na cabeça" tem de existir sem assinatura: sem ele o alerta nunca dispararia.
      await pagina.getByRole('radiogroup', { name: 'Pancadas na cabeça' }).getByRole('radio', { name: 'Fortes' }).click()
      await pagina.getByRole('button', { name: 'Salvar treino' }).click()
      await expect(pagina.getByRole('dialog', { name: 'Concluído' }).getByRole('alert')).toContainText('pancadas fortes na cabeça')
      await pagina.getByRole('button', { name: 'Concluir' }).click()
      await pagina.getByRole('button', { name: /^Alertas/ }).click()
      await expect(pagina.getByRole('dialog', { name: 'Alertas' })).toContainText('Pancadas fortes na cabeça')
    })
  }

  test('lesão ativa forte aparece nos alertas do plano gratuito', async ({ pagina }) => {
    await abrir(pagina, SEM_ASSINATURA_TESTE, '/hoje')
    await pagina.getByRole('button', { name: /^Alertas/ }).click()
    await expect(pagina.getByRole('dialog', { name: 'Alertas' })).toContainText('Lesão ativa: Punhos (4/5)')
  })

  test('o alerta de carga é do plano Amador: some no gratuito e aparece no Amador', async ({ pagina }) => {
    // Semana anterior leve e semana atual pesada: razão acima de 1,5 (alerta crítico de carga).
    const historico = HISTORICO_COM_SALTO_DE_CARGA
    const dados = { ...DADOS_DE_EXEMPLO, historico }
    await abrir(pagina, SEM_ASSINATURA_TESTE, '/hoje', dados)
    await pagina.getByRole('button', { name: /^Alertas/ }).click()
    const painel = pagina.getByRole('dialog', { name: 'Alertas' })
    await expect(painel).toContainText('Lesão ativa') // segurança sempre aparece
    await expect(painel).not.toContainText('Carga alta demais')
    await expect(painel).not.toContainText('Subindo rápido')
  })
})

test.describe('Gratuito: o que fica bloqueado, com convite para assinar', () => {
  test('biblioteca técnica: convite do plano Iniciante, mantendo o título da tela', async ({ pagina }) => {
    await abrir(pagina, SEM_ASSINATURA_TESTE, '/tecnicas')
    await expect(pagina.getByRole('heading', { name: 'Biblioteca técnica', level: 1 })).toBeVisible()
    await expect(convite(pagina, 'Iniciante', 'Biblioteca técnica')).toContainText('Disponível a partir do plano Iniciante')
    await expect(pagina.getByRole('tablist')).toHaveCount(0)
    await convite(pagina, 'Iniciante').getByRole('link', { name: 'Ver planos' }).click()
    await expect(pagina).toHaveURL(/\/assinatura$/)
  })

  test('check-in da tela Hoje: convite do plano Amador no lugar do formulário', async ({ pagina }) => {
    await abrir(pagina, SEM_ASSINATURA_TESTE, '/hoje')
    await expect(convite(pagina, 'Amador', 'Check-in diário')).toBeVisible()
    await expect(pagina.getByRole('button', { name: 'Salvar check-in' })).toHaveCount(0)
    await expect(pagina.getByRole('region', { name: 'Check-in de hoje' })).toHaveCount(0)
  })

  test('plano de treino escolhido que a assinatura não inclui: convite, e os dados do plano ficam guardados', async ({ pagina }) => {
    await abrir(pagina, SEM_ASSINATURA_TESTE, '/plano')
    await expect(pagina.getByText(/não está incluído na sua assinatura atual/)).toBeVisible()
    await expect(convite(pagina, 'Iniciante', 'Fundamentos')).toBeVisible()
    expect(await lerJson(pagina, 'plano')).toMatchObject({ planoId: 'fundamentos' })
    await expect(pagina.getByRole('button', { name: 'Escolher outro plano' })).toBeVisible()
  })

  test('tela Hoje com plano bloqueado: convite e sugestão de treino (o treino continua possível)', async ({ pagina }) => {
    await abrir(pagina, SEM_ASSINATURA_TESTE, '/hoje')
    await expect(convite(pagina, 'Iniciante', 'Fundamentos')).toBeVisible()
    await expect(pagina.getByRole('heading', { name: /Sugestão:/ })).toBeVisible()
    await expect(pagina.getByRole('link', { name: /Iniciar com cronômetro/ })).toBeVisible()
  })

  test('escolher plano: todos mostram o plano de assinatura que os inclui, e tocar leva à assinatura sem ativar nada', async ({ pagina }) => {
    await abrir(pagina, SEM_ASSINATURA_TESTE, '/hoje', { ...DADOS_DE_EXEMPLO, plano: null })
    await pagina.getByRole('button', { name: /Escolha um plano de treino/ }).click()
    const lista = pagina.getByRole('dialog', { name: 'Escolher plano' })
    await expect(lista.getByRole('button', { name: new RegExp(FUNDAMENTOS.nome) })).toContainText('Plano Iniciante')
    await expect(lista.getByRole('button', { name: /Pré-competição/ })).toContainText('Plano Profissional')
    await lista.getByRole('button', { name: new RegExp(FUNDAMENTOS.nome) }).click()
    await expect(pagina).toHaveURL(/\/assinatura$/)
    await expect(pagina.getByRole('dialog')).toHaveCount(0)
    expect(await lerJson(pagina, 'plano')).toBeNull()
  })

  test('perfil de atleta: o plano recomendado é de assinatura, então leva às opções (e o perfil é salvo)', async ({ pagina }) => {
    await abrir(pagina, SEM_ASSINATURA_TESTE, '/perfil', { ...DADOS_DE_EXEMPLO, plano: null, config: {} })
    await pagina.getByRole('button', { name: /Montar perfil de atleta/ }).click()
    const painel = pagina.getByRole('dialog', { name: 'Perfil de atleta' })
    await painel.getByRole('button', { name: /Ortodoxo/ }).click()
    await painel.getByRole('button', { name: 'Nunca treinei' }).click()
    await painel.getByRole('button', { name: /Técnica/ }).click()
    await painel.getByRole('button', { name: 'Ver plano recomendado' }).click()
    await expect(painel).toContainText('faz parte do plano Iniciante')
    await expect(painel.getByRole('button', { name: 'Ativar este plano' })).toHaveCount(0)
    await painel.getByRole('button', { name: 'Ver planos de assinatura' }).click()
    await expect(pagina).toHaveURL(/\/assinatura$/)
    expect(await lerJson(pagina, 'config')).toMatchObject({ postura: 'ortodoxo', onboardingFeito: true })
    expect(await lerJson(pagina, 'plano')).toBeNull()
  })

  test('progresso: a carga de treino é convite do plano Amador; o resto do progresso continua', async ({ pagina }) => {
    await abrir(pagina, SEM_ASSINATURA_TESTE, '/progresso')
    await expect(convite(pagina, 'Amador', 'Carga de treino')).toBeVisible()
    await expect(pagina.getByText('7 treinos', { exact: true })).toBeVisible()
  })

  test('saúde: peso e resumo de pancadas bloqueados; lesões e registros livres', async ({ pagina }) => {
    await abrir(pagina, SEM_ASSINATURA_TESTE, '/saude')
    await expect(convite(pagina, 'Amador', 'Peso, categoria')).toBeVisible()
    await expect(convite(pagina, 'Profissional', 'resumo de pancadas')).toBeVisible()
    await expect(pagina.getByLabel('Peso de hoje em quilos')).toHaveCount(0)
    await expect(pagina.getByLabel('Onde dói?')).toBeVisible()
  })

  test('registro de sparring: sem intensidade e parceiro (plano Profissional), mas com pancadas na cabeça', async ({ pagina }) => {
    await abrir(pagina, SEM_ASSINATURA_TESTE, '/hoje')
    await pagina.getByRole('button', { name: 'Registrar treino', exact: true }).click()
    await pagina.getByRole('dialog').getByRole('button', { name: /Sparring/ }).click()
    const painel = pagina.getByRole('dialog', { name: 'Sparring' })
    await expect(painel.getByRole('radiogroup', { name: 'Pancadas na cabeça' })).toBeVisible()
    await expect(painel.getByRole('radiogroup', { name: 'Intensidade do sparring' })).toHaveCount(0)
    await expect(painel.getByLabel('Parceiro de sparring')).toHaveCount(0)
    await expect(painel.getByRole('link', { name: 'plano Profissional' })).toBeVisible()
  })

  test('perfil: lembrete e importar backup mostram o plano que os libera', async ({ pagina }) => {
    await abrir(pagina, SEM_ASSINATURA_TESTE, '/perfil')
    await expect(pagina.getByText(/a partir do plano Profissional/)).toBeVisible()
    await expect(pagina.getByRole('switch', { name: /Lembretes/ })).toHaveCount(0)
    await expect(pagina.getByRole('link', { name: /Importar backup: disponível no plano Profissional/ })).toBeVisible()
    await expect(pagina.locator('input[type=file]')).toHaveCount(0)
  })
})

test.describe('cada plano libera o seu pedaço', () => {
  test('Iniciante: biblioteca e plano Fundamentos liberados; check-in e carga não', async ({ pagina }) => {
    await abrir(pagina, ativa('iniciante'), '/tecnicas')
    await expect(pagina.getByRole('tablist')).toBeVisible()
    await pagina.goto('/plano')
    await expect(pagina.getByRole('heading', { name: FUNDAMENTOS.nome })).toBeVisible()
    await pagina.goto('/hoje')
    await expect(convite(pagina, 'Amador', 'Check-in diário')).toBeVisible()
    await pagina.goto('/progresso')
    await expect(convite(pagina, 'Amador', 'Carga de treino')).toBeVisible()
  })

  test('Iniciante: os outros planos de treino aparecem bloqueados na lista', async ({ pagina }) => {
    await abrir(pagina, ativa('iniciante'), '/plano')
    await pagina.getByRole('button', { name: 'Trocar' }).click()
    const lista = pagina.getByRole('dialog', { name: 'Escolher plano' })
    await expect(lista.getByRole('button', { name: /Base Aeróbica/ })).toContainText('Plano Amador')
    await expect(lista.getByRole('button', { name: /Pré-competição/ })).toContainText('Plano Profissional')
    await expect(lista.getByRole('button', { name: new RegExp(FUNDAMENTOS.nome) })).not.toContainText('Plano Iniciante')
  })

  test('Amador: check-in, carga, peso e reagendar liberados; resumo de sparring, lembrete e importar não', async ({ pagina }) => {
    await abrir(pagina, ativa('amador'), '/hoje')
    await expect(pagina.getByRole('region', { name: 'Check-in de hoje' })).toBeVisible()
    await pagina.goto('/progresso')
    await expect(pagina.getByText('Carga de treino')).toBeVisible()
    await expect(convite(pagina, 'Amador')).toHaveCount(0)
    await pagina.goto('/saude')
    await expect(pagina.getByLabel('Peso de hoje em quilos')).toBeVisible()
    await expect(convite(pagina, 'Profissional', 'resumo de pancadas')).toBeVisible()
    await pagina.goto('/plano')
    await expect(pagina.getByLabel(/^Mudar o dia de /).first()).toBeVisible()
    await pagina.goto('/perfil')
    await expect(pagina.getByRole('link', { name: /Importar backup: disponível no plano Profissional/ })).toBeVisible()
  })

  test('Amador: o alerta de carga aparece (carga é do plano Amador)', async ({ pagina }) => {
    const historico = HISTORICO_COM_SALTO_DE_CARGA
    await abrir(pagina, ativa('amador'), '/hoje', { ...DADOS_DE_EXEMPLO, historico })
    await pagina.getByRole('button', { name: /^Alertas/ }).click()
    await expect(pagina.getByRole('dialog', { name: 'Alertas' })).toContainText(/Carga alta demais/)
  })

  test('Amador: o plano Pré-competição continua bloqueado', async ({ pagina }) => {
    await abrir(pagina, ativa('amador'), '/plano', { ...DADOS_DE_EXEMPLO, plano: { planoId: 'pre-competicao', inicio: '2026-10-12' } })
    await expect(convite(pagina, 'Profissional', 'Pré-competição')).toBeVisible()
  })

  test('Profissional: tudo liberado', async ({ pagina }) => {
    await abrir(pagina, ativa('profissional'), '/saude')
    await expect(convite(pagina, 'Profissional')).toHaveCount(0)
    await expect(pagina.getByText('Pancadas na cabeça')).toBeVisible()
    await pagina.goto('/perfil')
    await expect(pagina.getByRole('switch', { name: /Lembretes/ })).toBeVisible()
    await expect(pagina.locator('input[type=file]')).toHaveCount(1)
    await pagina.goto('/hoje')
    await pagina.getByRole('button', { name: 'Registrar treino', exact: true }).click()
    await pagina.getByRole('dialog').getByRole('button', { name: /Sparring/ }).click()
    await expect(pagina.getByRole('radiogroup', { name: 'Intensidade do sparring' })).toBeVisible()
    await expect(pagina.getByLabel('Parceiro de sparring')).toBeVisible()
  })

  test('teste grátis do Profissional libera tudo, como o plano', async ({ pagina }) => {
    await abrir(pagina, emTeste('profissional', 6), '/progresso')
    await expect(convite(pagina, 'Amador')).toHaveCount(0)
  })

  test('assinatura cancelada volta ao gratuito, mas os dados continuam lá', async ({ pagina }) => {
    await abrir(pagina, cancelada('profissional'), '/progresso')
    await expect(convite(pagina, 'Amador', 'Carga de treino')).toBeVisible()
    await expect(pagina.getByText('7 treinos', { exact: true })).toBeVisible()
    expect(await lerJson(pagina, 'lesoes')).toHaveLength(2)
    expect(await lerJson(pagina, 'pesos')).toHaveLength(4)
  })
})

test.describe('sem o pagamento ligado, o app fica todo liberado (como era antes)', () => {
  test('nada aparece bloqueado em nenhuma tela', async ({ pagina }) => {
    await abrir(pagina, 'indisponivel', '/hoje')
    for (const rota of ['/hoje', '/plano', '/progresso', '/saude', '/tecnicas', '/perfil']) {
      await pagina.goto(rota)
      await expect(pagina.getByRole('main')).toBeVisible()
      await expect(pagina.getByText(/Disponível a partir do plano/)).toHaveCount(0)
    }
  })
})

test.describe('estado ainda desconhecido ou falha de rede', () => {
  test.use({ toleraRespostaDeErro: true }) // abortar a chamada de propósito aparece como erro de rede no console

  test('falha de rede sem cópia guardada: não tranca o app', async ({ pagina }) => {
    await pagina.route('**/api/assinatura/estado*', rota => rota.abort())
    await semear(pagina)
    await pagina.goto('/tecnicas')
    await expect(pagina.getByRole('tablist')).toBeVisible()
  })

  test('falha de rede com cópia guardada: usa a última assinatura conhecida', async ({ pagina }) => {
    await abrir(pagina, ativa('amador'), '/progresso') // grava a cópia local
    await expect(pagina.getByText('Carga de treino')).toBeVisible()
    await pagina.unroute('**/api/assinatura/estado*')
    await pagina.route('**/api/assinatura/estado*', rota => rota.abort())
    await pagina.reload()
    await expect(pagina.getByText('Carga de treino')).toBeVisible()
    await expect(convite(pagina, 'Amador')).toHaveCount(0)
  })
})
