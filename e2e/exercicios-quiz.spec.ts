import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { ATLETAS } from '../data/atletas'
import { CATEGORIAS, EXERCICIOS, exerciciosDaCategoria } from '../data/exercicios'
import { PERGUNTAS } from '../data/quiz'
import { SEM_ASSINATURA_TESTE, ativa, simularEstado } from './assinatura-simulada'
import { DADOS_DE_EXEMPLO, semear } from './dados-exemplo'
import { expect, lerJson, test } from './fixtures'

// Biblioteca de exercícios (gratuita), quiz de estilo (gratuito) e treinos no estilo de um atleta (plano Profissional).
// As rotas de pagamento são simuladas: nenhum teste fala com o Stripe.

const HOJE = new Date('2026-10-14T12:00:00-03:00')

// Respostas de quem luta de longe, com velocidade e técnica: o primeiro resultado é Muhammad Ali.
const COMO_O_ALI = [0, 0, 0, 2, 0]

async function responder(pagina: Page, respostas: number[]) {
  for (let i = 0; i < respostas.length; i++) {
    await expect(pagina.getByText(`Pergunta ${i + 1} de ${PERGUNTAS.length}`)).toBeVisible()
    await pagina.getByRole('button', { name: PERGUNTAS[i].opcoes[respostas[i]].texto }).click()
  }
}

async function auditar(pagina: Page) {
  await pagina.evaluate(() => Promise.all(
    document.getAnimations().filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime ?? Infinity)).map(a => a.finished.catch(() => undefined)),
  ))
  const resultado = await new AxeBuilder({ page: pagina }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return resultado.violations.map(v => `${v.id} (${v.impact}): ${v.help}\n${v.nodes.slice(0, 4).map(n => `   - ${n.target.join(' ')}  ${(n.failureSummary ?? '').split('\n')[1] ?? ''}`).join('\n')}`)
}

test.beforeEach(async ({ pagina }) => {
  await pagina.clock.setFixedTime(HOJE)
})

test.describe('biblioteca de exercícios', () => {
  test('abre pelo atalho da tela Plano e pelo da tela Hoje, sem exigir assinatura', async ({ pagina }) => {
    await simularEstado(pagina, SEM_ASSINATURA_TESTE)
    await pagina.goto('/plano')
    await pagina.getByRole('link', { name: /^Exercícios/ }).click()
    await expect(pagina.getByRole('heading', { name: 'Exercícios', level: 1 })).toBeVisible()

    await pagina.goto('/hoje')
    await pagina.getByRole('link', { name: /^Exercícios/ }).click()
    await expect(pagina.getByRole('heading', { name: 'Exercícios', level: 1 })).toBeVisible()
  })

  test('tem cinco categorias, e cada uma lista os seus exercícios com o nível', async ({ pagina }) => {
    await pagina.goto('/exercicios')
    const abas = pagina.getByRole('tablist', { name: 'Categorias de exercícios' }).getByRole('tab')
    await expect(abas).toHaveText(CATEGORIAS.map(c => c.nome))
    for (const c of CATEGORIAS) {
      await pagina.getByRole('tab', { name: c.nome }).click()
      const cartoes = pagina.getByRole('tabpanel').getByRole('button')
      await expect(cartoes).toHaveCount(exerciciosDaCategoria(c.id).length)
      for (const e of exerciciosDaCategoria(c.id)) await expect(pagina.getByRole('tabpanel').getByRole('button', { name: new RegExp(e.nome.replace(/[()+]/g, '\\$&')) })).toBeVisible()
    }
  })

  test('as setas trocam de categoria', async ({ pagina }) => {
    await pagina.goto('/exercicios')
    await pagina.getByRole('tab', { name: 'Footwork' }).focus()
    await pagina.keyboard.press('ArrowRight')
    await expect(pagina.getByRole('tab', { name: 'Esquivas de cabeça' })).toHaveAttribute('aria-selected', 'true')
    await pagina.keyboard.press('End')
    await expect(pagina.getByRole('tab', { name: 'Combinações' })).toHaveAttribute('aria-selected', 'true')
  })

  test('o painel de cada um dos 20 exercícios mostra descrição, 3 dicas, 2 erros comuns e o aviso de vídeo', async ({ pagina }) => {
    await pagina.goto('/exercicios')
    for (const c of CATEGORIAS) {
      await pagina.getByRole('tab', { name: c.nome }).click()
      for (const e of exerciciosDaCategoria(c.id)) {
        await pagina.getByRole('tabpanel').getByRole('button', { name: new RegExp(e.nome.replace(/[()+]/g, '\\$&')) }).click()
        const painel = pagina.getByRole('dialog', { name: e.nome })
        await expect(painel).toContainText(e.descricao)
        for (const d of e.dicas) await expect(painel).toContainText(d)
        for (const d of e.errosComuns) await expect(painel).toContainText(d)
        await expect(painel.getByRole('heading', { name: 'Dicas' })).toBeVisible()
        await expect(painel.getByRole('heading', { name: 'Erros comuns' })).toBeVisible()
        await expect(painel.getByText('Em breve: vídeo')).toBeVisible()
        await pagina.keyboard.press('Escape')
        await expect(painel).toHaveCount(0)
      }
    }
    expect(EXERCICIOS).toHaveLength(20)
  })

  test('fechar o painel devolve o foco ao exercício que foi aberto', async ({ pagina }) => {
    await pagina.goto('/exercicios')
    const cartao = pagina.getByRole('tabpanel').getByRole('button', { name: /Passo lateral/ })
    await cartao.click()
    await pagina.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click()
    await expect(cartao).toBeFocused()
  })

  test('acessibilidade: a lista e o painel aberto não têm violações do axe', async ({ pagina }) => {
    await pagina.goto('/exercicios')
    await pagina.waitForLoadState('networkidle')
    expect(await auditar(pagina), 'lista').toEqual([])
    await pagina.getByRole('tab', { name: 'Golpes' }).click()
    expect(await auditar(pagina), 'aba Golpes').toEqual([])
    await pagina.getByRole('tabpanel').getByRole('button', { name: /Jab/ }).click()
    expect(await auditar(pagina), 'painel do Jab').toEqual([])
  })
})

test.describe('quiz de estilo', () => {
  test('abre pelo atalho da tela Plano, sem exigir assinatura, e mostra a pergunta 1 de 5', async ({ pagina }) => {
    await simularEstado(pagina, SEM_ASSINATURA_TESTE)
    await pagina.goto('/plano')
    await pagina.getByRole('link', { name: /^Quiz de estilo/ }).click()
    await expect(pagina.getByText('Pergunta 1 de 5')).toBeVisible()
    await expect(pagina.getByRole('heading', { name: PERGUNTAS[0].pergunta, level: 1 })).toBeVisible()
    await expect(pagina.getByRole('progressbar', { name: 'Progresso do quiz' })).toHaveAttribute('aria-valuenow', '1')
    for (const o of PERGUNTAS[0].opcoes) await expect(pagina.getByRole('button', { name: o.texto })).toBeVisible()
  })

  test('a tela Hoje convida para o quiz logo no começo, sem precisar rolar, e o convite leva ao quiz', async ({ pagina }) => {
    await simularEstado(pagina, SEM_ASSINATURA_TESTE)
    await pagina.goto('/hoje')
    const convite = pagina.getByRole('link', { name: /^Qual é o seu estilo de lutador\?/ })
    await expect(convite).toBeVisible()
    await expect(convite).toContainText('Clique aqui')
    await expect(convite).toBeInViewport()
    // Vem antes de tudo o que é da rotina (check-in, semana, treino de hoje).
    const aAltura = async (alvo: ReturnType<typeof pagina.locator>) => (await alvo.boundingBox())!.y
    expect(await aAltura(convite)).toBeLessThan(await aAltura(pagina.getByRole('heading', { name: 'Como você está' })))
    // Aparece uma vez só: o atalho de baixo ("Para evoluir") não repete o quiz.
    await expect(pagina.getByRole('link', { name: /Quiz de estilo/ })).toHaveCount(0)
    await convite.click()
    await expect(pagina.getByText('Pergunta 1 de 5')).toBeVisible()
  })

  test('uma pergunta por tela: cada resposta leva à seguinte, com o foco no título e o progresso andando', async ({ pagina }) => {
    await pagina.goto('/quiz')
    await pagina.getByRole('button', { name: PERGUNTAS[0].opcoes[0].texto }).click()
    await expect(pagina.getByText('Pergunta 2 de 5')).toBeVisible()
    await expect(pagina.getByRole('heading', { name: PERGUNTAS[1].pergunta, level: 1 })).toBeFocused()
    await expect(pagina.getByRole('progressbar', { name: 'Progresso do quiz' })).toHaveAttribute('aria-valuenow', '2')
  })

  test('o botão de voltar leva à pergunta anterior e mostra a resposta que já estava marcada', async ({ pagina }) => {
    await pagina.goto('/quiz')
    await pagina.getByRole('button', { name: PERGUNTAS[0].opcoes[1].texto }).click()
    await pagina.getByRole('button', { name: 'Pergunta anterior' }).click()
    await expect(pagina.getByText('Pergunta 1 de 5')).toBeVisible()
    await expect(pagina.getByRole('button', { name: PERGUNTAS[0].opcoes[1].texto })).toHaveAttribute('aria-pressed', 'true')
    await expect(pagina.getByRole('button', { name: PERGUNTAS[0].opcoes[0].texto })).toHaveAttribute('aria-pressed', 'false')
    // Na primeira pergunta não há "anterior": o voltar sai do quiz.
    await expect(pagina.getByRole('button', { name: 'Pergunta anterior' })).toHaveCount(0)
    await expect(pagina.getByRole('link', { name: 'Voltar' })).toBeVisible()
  })

  test('no fim mostra dois atletas, o mais compatível primeiro, com a porcentagem, e o endereço guarda as respostas', async ({ pagina }) => {
    await simularEstado(pagina, SEM_ASSINATURA_TESTE)
    await pagina.goto('/quiz')
    await responder(pagina, COMO_O_ALI)
    await pagina.waitForURL(/\/quiz\?r=00020$/)
    await expect(pagina.getByRole('heading', { name: 'Seu estilo de luta', level: 1 })).toBeVisible()
    const cartoes = pagina.getByRole('article')
    await expect(cartoes).toHaveCount(2)
    await expect(cartoes.first().getByRole('heading', { name: 'Muhammad Ali' })).toBeVisible()
    await expect(cartoes.first()).toContainText('% de compatibilidade')
    await expect(cartoes.nth(1)).toContainText('% de compatibilidade')
    // O resultado sobrevive a recarregar a página.
    await pagina.reload()
    await expect(pagina.getByRole('article')).toHaveCount(2)
    await expect(pagina.getByRole('article').first().getByRole('heading', { name: 'Muhammad Ali' })).toBeVisible()
  })

  test('resposta inválida no endereço recomeça o quiz em vez de quebrar', async ({ pagina }) => {
    for (const r of ['abc', '0000', '000000', '99999', '3', '']) {
      await pagina.goto(`/quiz?r=${r}`)
      await expect(pagina.getByText('Pergunta 1 de 5'), r).toBeVisible()
    }
  })

  test('"Refazer o quiz" recomeça da pergunta 1', async ({ pagina }) => {
    await pagina.goto('/quiz')
    await responder(pagina, COMO_O_ALI)
    await pagina.getByRole('link', { name: 'Refazer o quiz' }).click()
    await expect(pagina.getByText('Pergunta 1 de 5')).toBeVisible()
  })

  test('o botão Voltar do navegador, depois de abrir um atleta, volta ao resultado', async ({ pagina }) => {
    await pagina.goto('/quiz')
    await responder(pagina, COMO_O_ALI)
    await pagina.getByRole('article').first().getByRole('link', { name: /Ver estilo e plano/ }).click()
    await expect(pagina.getByRole('heading', { name: 'Muhammad Ali', level: 1 })).toBeVisible()
    await pagina.getByRole('button', { name: 'Voltar' }).click()
    await expect(pagina.getByRole('heading', { name: 'Seu estilo de luta', level: 1 })).toBeVisible()
  })

  test('sem o plano Profissional, "Treinar como" aparece trancado, com PRO e o caminho para assinar', async ({ pagina }) => {
    await simularEstado(pagina, SEM_ASSINATURA_TESTE)
    await pagina.goto('/quiz')
    await responder(pagina, COMO_O_ALI)
    const primeiro = pagina.getByRole('article').first()
    const trancado = primeiro.getByRole('region', { name: /Treinar como Muhammad Ali: recurso do plano Profissional/ })
    await expect(trancado).toBeVisible()
    await expect(trancado.getByText('PRO', { exact: true })).toBeVisible()
    await expect(primeiro.getByRole('button', { name: /Treinar como/ })).toHaveCount(0)
    await trancado.getByRole('link', { name: 'Assinar Pro' }).click()
    await pagina.waitForURL('**/assinatura')
  })

  test('com o Iniciante e com o Amador, continua trancado (é do Profissional)', async ({ pagina }) => {
    for (const nivel of ['iniciante', 'amador'] as const) {
      await simularEstado(pagina, ativa(nivel))
      await pagina.goto('/atletas/ali')
      await expect(pagina.getByRole('region', { name: /Treinar como Muhammad Ali: recurso do plano Profissional/ }), nivel).toBeVisible()
    }
  })

  test('com o Profissional, "Treinar como" ativa o plano do atleta e leva à tela Plano', async ({ pagina }) => {
    await simularEstado(pagina, ativa('profissional'))
    await pagina.goto('/quiz')
    await responder(pagina, COMO_O_ALI)
    await pagina.getByRole('article').first().getByRole('button', { name: /Treinar como Muhammad Ali/ }).click()
    await pagina.waitForURL('**/plano')
    await expect(pagina.getByRole('heading', { name: 'Estilo Muhammad Ali', level: 2 })).toBeVisible()
    expect((await lerJson(pagina, 'plano')).planoId).toBe('atleta-ali')
    // A tela Plano mostra as sessões do plano do atleta, e nenhum convite.
    await expect(pagina.getByRole('region', { name: /Recurso do plano/ })).toHaveCount(0)
    await expect(pagina.getByText('Jab longo e distância').first()).toBeVisible()
  })

  test('com outro plano ativo, pede confirmação antes de trocar para o do atleta', async ({ pagina }) => {
    await simularEstado(pagina, ativa('profissional'))
    await semear(pagina, { ...DADOS_DE_EXEMPLO, plano: { planoId: 'fundamentos', inicio: '2026-10-12' } })
    await pagina.goto('/atletas/tyson')
    // O vigia dos testes (fixtures.ts) aceita todo window.confirm; aqui só lemos o que foi perguntado.
    const perguntas: string[] = []
    pagina.on('dialog', d => perguntas.push(d.message()))
    await pagina.getByRole('button', { name: /Treinar como Mike Tyson/ }).click()
    await pagina.waitForURL('**/plano')
    expect(perguntas).toEqual([expect.stringContaining('Trocar para o plano Estilo Mike Tyson')])
    expect((await lerJson(pagina, 'plano')).planoId).toBe('atleta-tyson')
  })

  test('o plano ativo do atleta aparece como "seu plano ativo", sem botão para ativar de novo', async ({ pagina }) => {
    await simularEstado(pagina, ativa('profissional'))
    await semear(pagina, { ...DADOS_DE_EXEMPLO, plano: { planoId: 'atleta-ali', inicio: '2026-10-12' } })
    await pagina.goto('/atletas/ali')
    await expect(pagina.getByText('Este é o seu plano ativo')).toBeVisible()
    await expect(pagina.getByRole('button', { name: /Treinar como/ })).toHaveCount(0)
    await pagina.getByRole('link', { name: 'Ver meu plano' }).click()
    await pagina.waitForURL('**/plano')
  })

  test('quem perdeu o Profissional mantém o plano do atleta guardado, mas vê o convite no lugar das sessões', async ({ pagina }) => {
    await simularEstado(pagina, SEM_ASSINATURA_TESTE)
    await semear(pagina, { ...DADOS_DE_EXEMPLO, plano: { planoId: 'atleta-ali', inicio: '2026-10-12' } })
    await pagina.goto('/plano')
    await expect(pagina.getByRole('region', { name: 'Recurso do plano Profissional' })).toBeVisible()
    expect((await lerJson(pagina, 'plano')).planoId).toBe('atleta-ali')
  })

  test('acessibilidade: perguntas, resultado e telas dos atletas não têm violações do axe', async ({ pagina }) => {
    test.setTimeout(120_000)
    await simularEstado(pagina, SEM_ASSINATURA_TESTE)
    await pagina.goto('/quiz')
    await pagina.waitForLoadState('networkidle')
    expect(await auditar(pagina), 'pergunta 1').toEqual([])
    await responder(pagina, COMO_O_ALI)
    await expect(pagina.getByRole('heading', { name: 'Seu estilo de luta', level: 1 })).toBeVisible()
    await expect(pagina.getByRole('region', { name: /recurso do plano Profissional/ }).first()).toBeVisible()
    expect(await auditar(pagina), 'resultado (gratuito)').toEqual([])
    // Três atletas bastam para o axe (o contraste das dez cores é conferido em tests/atletas.test.ts e as dez telas abrem em outro teste).
    for (const a of ATLETAS.filter(x => ['ali', 'tyson', 'conceicao'].includes(x.id))) {
      await pagina.goto(`/atletas/${a.id}`)
      await expect(pagina.getByRole('heading', { name: a.nome, level: 1 })).toBeVisible()
      await expect(pagina.getByRole('region', { name: /recurso do plano Profissional/ })).toBeVisible()
      expect(await auditar(pagina), `atleta ${a.nome} (gratuito)`).toEqual([])
    }
  })

  test('acessibilidade: tela do atleta com o Profissional', async ({ pagina }) => {
    await simularEstado(pagina, ativa('profissional'))
    await pagina.goto('/atletas/conceicao')
    await expect(pagina.getByRole('button', { name: /Treinar como Robson Conceição/ })).toBeVisible()
    expect(await auditar(pagina), 'atleta (Profissional)').toEqual([])
  })
})

test.describe('tela do atleta', () => {
  test('mostra nome, estilo, descrição, as 4 características e o plano de 4 semanas', async ({ pagina }) => {
    await simularEstado(pagina, SEM_ASSINATURA_TESTE)
    await pagina.goto('/atletas/mayweather')
    const a = ATLETAS.find(x => x.id === 'mayweather')!
    await expect(pagina.getByRole('heading', { name: a.nome, level: 1 })).toBeVisible()
    await expect(pagina.getByText(a.estilo, { exact: true })).toBeVisible()
    await expect(pagina.getByText(a.descricao)).toBeVisible()
    const caracteristicas = pagina.getByRole('list', { name: 'Características do estilo' }).getByRole('listitem')
    await expect(caracteristicas).toHaveText(a.caracteristicas)
    await expect(pagina.getByRole('heading', { name: /Plano de 4 semanas/ })).toBeVisible()
    for (const semana of [1, 2, 3, 4]) await expect(pagina.getByRole('heading', { name: `Semana ${semana}`, level: 3 })).toBeVisible()
    await expect(pagina).toHaveTitle('Floyd Mayweather Jr. · Corner')
  })

  test.describe('atleta inexistente', () => {
    test.use({ toleraRespostaDeErro: true }) // o 404 aparece como erro de rede no console do navegador

    test('leva à página de não encontrado', async ({ pagina }) => {
      const resposta = await pagina.goto('/atletas/nao-existe')
      expect(resposta?.status()).toBe(404)
    })
  })

  test('todos os dez atletas abrem', async ({ pagina }) => {
    await simularEstado(pagina, SEM_ASSINATURA_TESTE)
    for (const a of ATLETAS) {
      await pagina.goto(`/atletas/${a.id}`)
      await expect(pagina.getByRole('heading', { name: a.nome, level: 1 })).toBeVisible()
    }
  })
})

test.describe('barra de navegação', () => {
  for (const rota of ['/exercicios', '/quiz', '/atletas/ali']) {
    test(`em ${rota} a aba Plano fica marcada`, async ({ pagina }) => {
      await simularEstado(pagina, SEM_ASSINATURA_TESTE)
      await pagina.goto(rota)
      const nav = pagina.getByRole('navigation', { name: 'Navegação principal' })
      await expect(nav.getByRole('link', { name: 'Plano' })).toHaveAttribute('aria-current', 'page')
      for (const outra of ['Hoje', 'Progresso', 'Perfil']) await expect(nav.getByRole('link', { name: outra })).not.toHaveAttribute('aria-current', 'page')
    })
  }
})
