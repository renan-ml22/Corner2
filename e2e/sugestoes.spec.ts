import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import type { SugestaoDaFicha } from '../lib/cornerman/sugestao'
import { SEM_ASSINATURA_TESTE, ativa, simularEstado } from './assinatura-simulada'
import { ficha, simularAlunos } from './alunos-simulados'
import { expect, gravarRaw, lerJson, test } from './fixtures'
import { simularSugestaoDoTreinador, sugestaoDeExemplo } from './sugestao-simulada'

// Etapa 4 do Cornerman: o treinador sugere um plano (aba "Plano sugerido" da ficha), o aluno recebe o aviso na tela Hoje e
// responde, o plano aceito ganha o selo "Sugerido pelo seu treinador", e a barra ganha a aba "Alunos" com o selo vermelho.
// As APIs são simuladas em memória (e2e/alunos-simulados.ts e e2e/sugestao-simulada.ts); as regras do servidor têm testes
// próprios (tests/cornerman-sugestao*.test.ts e a fumaça contra o Postgres real).

async function auditar(pagina: Page) {
  await pagina.waitForLoadState('networkidle')
  const r = await new AxeBuilder({ page: pagina }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return r.violations.map(v => `${v.id} (${v.impact}): ${v.help} em ${v.nodes.map(n => n.target.join(' ')).join(' | ')}`)
}

const alerta = (pagina: Page) => pagina.locator('[role="alert"]:not(#__next-route-announcer__)')
const historico = (pagina: Page) => pagina.getByRole('list', { name: 'Histórico de sugestões' })
const aviso = (pagina: Page) => pagina.getByRole('region', { name: 'Plano sugerido pelo seu treinador' })
const barra = (pagina: Page) => pagina.getByRole('navigation', { name: 'Navegação principal' })

const sugestaoDaFicha = (extra: Partial<SugestaoDaFicha> = {}): SugestaoDaFicha => ({
  id: 's1', planoId: 'fundamentos', planoNome: 'Fundamentos', mensagem: '', status: 'pendente',
  criadaEm: '2026-10-10T12:00:00.000Z', respondidaEm: null, ...extra,
})

async function abrirAbaDeSugestao(pagina: Page, id: string) {
  await pagina.goto(`/alunos/${id}`)
  await pagina.getByRole('tab', { name: 'Plano sugerido' }).click()
}

test.describe('treinador: aba "Plano sugerido" da ficha', () => {
  test.beforeEach(async ({ pagina }) => { await simularEstado(pagina, ativa('cornerman')) })

  test('aluno com conta: escolhe o plano, escreve a mensagem e envia; vira pendente e o formulário limpa', async ({ pagina }) => {
    const ana = ficha('Ana Souza', { comConta: true })
    const api = await simularAlunos(pagina, [ana])
    await abrirAbaDeSugestao(pagina, ana.id)

    await expect(pagina.getByText('vê um aviso na tela Hoje')).toBeVisible()
    const enviar = pagina.getByRole('button', { name: 'Enviar sugestão' })
    await expect(enviar).toBeDisabled()
    await expect(pagina.getByText('Nenhuma sugestão ainda.')).toBeVisible()

    await pagina.getByLabel('Plano', { exact: true }).selectOption('fundamentos')
    await pagina.getByLabel('Mensagem (opcional)').fill('  Comece por aqui.  ')
    await expect(pagina.getByText('20/500')).toBeVisible()
    await expect(enviar).toBeEnabled()
    await enviar.click()

    await expect(pagina.getByText('Sugestão enviada ao aluno')).toBeVisible()
    const itens = historico(pagina).getByRole('listitem')
    await expect(itens).toHaveCount(1)
    await expect(itens.first()).toContainText('Fundamentos')
    await expect(itens.first()).toContainText('Aguardando resposta')
    await expect(itens.first()).toContainText('Comece por aqui.')
    await expect(pagina.getByLabel('Mensagem (opcional)')).toHaveValue('')
    await expect(pagina.getByLabel('Plano', { exact: true })).toHaveValue('')
    expect(api.escritas()).toEqual([{ metodo: 'POST', caminho: `/api/cornerman/alunos/${ana.id}/sugestoes`, corpo: { planoId: 'fundamentos', mensagem: '  Comece por aqui.  ' } }])
  })

  test('uma nova sugestão substitui a que esperava resposta, e a tela avisa antes', async ({ pagina }) => {
    const ana = ficha('Ana Souza', { comConta: true })
    await simularAlunos(pagina, [ana], { sugestoes: { [ana.id]: [sugestaoDaFicha()] } })
    await abrirAbaDeSugestao(pagina, ana.id)

    await expect(pagina.getByText('Já há uma sugestão esperando resposta (Fundamentos). Enviar esta a substitui.')).toBeVisible()
    await pagina.getByLabel('Plano', { exact: true }).selectOption('base-aerobica')
    await pagina.getByRole('button', { name: 'Enviar sugestão' }).click()

    const itens = historico(pagina).getByRole('listitem')
    await expect(itens).toHaveCount(2)
    await expect(itens.nth(0)).toContainText('Base Aeróbica')
    await expect(itens.nth(0)).toContainText('Aguardando resposta')
    await expect(itens.nth(1)).toContainText('Fundamentos')
    await expect(itens.nth(1)).toContainText('Substituída por outra')
  })

  test('ficha sem conta: só registra, e o texto e o botão dizem isso', async ({ pagina }) => {
    const beto = ficha('Beto Lima')
    await simularAlunos(pagina, [beto])
    await abrirAbaDeSugestao(pagina, beto.id)

    await expect(pagina.getByText('ainda não tem conta no Corner')).toBeVisible()
    await expect(pagina.getByRole('button', { name: 'Enviar sugestão' })).toHaveCount(0)
    await pagina.getByLabel('Plano', { exact: true }).selectOption('atleta-ali')
    await pagina.getByRole('button', { name: 'Registrar sugestão' }).click()
    await expect(pagina.getByText('Sugestão registrada na ficha')).toBeVisible()
    await expect(historico(pagina).getByRole('listitem').first()).toContainText('Registrada na ficha')
  })

  test('ficha encerrada: histórico à mostra, sem formulário', async ({ pagina }) => {
    const cleo = ficha('Cléo', { status: 'encerrado' })
    await simularAlunos(pagina, [cleo], { sugestoes: { [cleo.id]: [sugestaoDaFicha({ status: 'cancelada', respondidaEm: '2026-10-11T12:00:00.000Z' })] } })
    await abrirAbaDeSugestao(pagina, cleo.id)

    await expect(pagina.getByText('Esta ficha está encerrada.')).toBeVisible()
    await expect(pagina.getByLabel('Plano', { exact: true })).toHaveCount(0)
    await expect(historico(pagina).getByRole('listitem').first()).toContainText('Cancelada: o vínculo terminou')
  })

  test('o histórico mostra aceita e recusada com a data da resposta', async ({ pagina }) => {
    const ana = ficha('Ana Souza', { comConta: true })
    await simularAlunos(pagina, [ana], {
      sugestoes: { [ana.id]: [
        sugestaoDaFicha({ id: 's2', status: 'aceita', respondidaEm: '2026-10-12T12:00:00.000Z', mensagem: 'Boa semana!' }),
        sugestaoDaFicha({ id: 's1', planoId: 'base-aerobica', planoNome: 'Base Aeróbica', status: 'recusada', respondidaEm: '2026-10-09T12:00:00.000Z' }),
      ] },
    })
    await abrirAbaDeSugestao(pagina, ana.id)
    const itens = historico(pagina).getByRole('listitem')
    await expect(itens.nth(0)).toContainText('Aceita')
    await expect(itens.nth(0)).toContainText('respondida em')
    await expect(itens.nth(0)).toContainText('Boa semana!')
    await expect(itens.nth(1)).toContainText('Recusada')
  })

  test.describe('com resposta de erro de propósito', () => {
    test.use({ toleraRespostaDeErro: true })

    test('erro ao carregar o histórico: aviso e "Tentar de novo"', async ({ pagina }) => {
      const ana = ficha('Ana Souza', { comConta: true })
      await simularAlunos(pagina, [ana], { falhaNasSugestoes: true })
      await abrirAbaDeSugestao(pagina, ana.id)
      await expect(alerta(pagina).first()).toContainText('Não foi possível falar com o banco de dados')
      await expect(pagina.getByRole('button', { name: 'Tentar de novo' })).toBeVisible()
    })
  })

  test('360 px sem rolagem lateral, quatro abas legíveis e sem violações de acessibilidade (axe)', async ({ pagina }) => {
    await pagina.setViewportSize({ width: 360, height: 760 })
    const ana = ficha('Ana Souza com um nome bem comprido para testar a quebra de linha', { comConta: true })
    await simularAlunos(pagina, [ana], { sugestoes: { [ana.id]: [sugestaoDaFicha({ mensagem: 'Uma mensagem longa '.repeat(20) })] } })
    await abrirAbaDeSugestao(pagina, ana.id)

    expect(await pagina.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
    for (const aba of await pagina.getByRole('tab').all()) {
      expect(await aba.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `aba cortada: ${await aba.textContent()}`).toBe(true)
    }
    expect(await auditar(pagina)).toEqual([])
  })
})

test.describe('aluno: aviso na tela Hoje', () => {
  test('sem sugestão, nada aparece', async ({ pagina }) => {
    await simularEstado(pagina, ativa('iniciante'))
    await simularSugestaoDoTreinador(pagina)
    await pagina.goto('/hoje')
    await expect(pagina.getByRole('heading', { name: 'Treino de hoje' })).toBeVisible()
    await expect(aviso(pagina)).toHaveCount(0)
  })

  test('mostra quem sugeriu, o plano e a mensagem; "Ver o plano" abre os detalhes', async ({ pagina }) => {
    await simularEstado(pagina, ativa('iniciante'))
    await simularSugestaoDoTreinador(pagina, { pendente: sugestaoDeExemplo({ mensagem: 'Foque na guarda.' }) })
    await pagina.goto('/hoje')

    await expect(aviso(pagina)).toContainText('Marcos sugeriu um plano para você')
    await expect(aviso(pagina)).toContainText('Fundamentos')
    await expect(aviso(pagina)).toContainText('Foque na guarda.')
    await expect(pagina.getByText('4 semanas')).toHaveCount(0)
    const ver = aviso(pagina).getByRole('button', { name: 'Ver o plano' })
    await ver.click()
    await expect(aviso(pagina)).toContainText('4 semanas · 3× por semana')
    await expect(aviso(pagina).getByRole('button', { name: 'Esconder o plano' })).toHaveAttribute('aria-expanded', 'true')
  })

  test('aceitar sem plano ativo: o servidor confirma, o plano passa a valer e o selo aparece', async ({ pagina }) => {
    await simularEstado(pagina, ativa('iniciante'))
    const api = await simularSugestaoDoTreinador(pagina, { pendente: sugestaoDeExemplo() })
    await pagina.goto('/hoje')
    await aviso(pagina).getByRole('button', { name: 'Aceitar plano' }).click()

    await expect(pagina.getByText('Plano Fundamentos ativado')).toBeVisible()
    await expect(aviso(pagina)).toHaveCount(0)
    await expect(pagina.getByText('Sugerido pelo seu treinador Marcos')).toBeVisible()
    expect((await lerJson(pagina, 'plano')).planoId).toBe('fundamentos')
    expect(api.escritas()).toEqual([{ metodo: 'POST', caminho: `/api/sugestao-do-treinador/${sugestaoDeExemplo().id}/aceitar` }])
  })

  test('aceitar com outro plano ativo: pergunta antes de trocar e começa o plano na semana atual', async ({ pagina }) => {
    await simularEstado(pagina, ativa('amador'))
    await simularSugestaoDoTreinador(pagina, { pendente: sugestaoDeExemplo({ planoId: 'base-aerobica', planoNome: 'Base Aeróbica' }) })
    await pagina.goto('/hoje')
    await gravarRaw(pagina, 'plano', JSON.stringify({ planoId: 'fundamentos', inicio: '2026-10-05' }))
    await pagina.reload()

    const perguntas: string[] = []
    pagina.on('dialog', d => perguntas.push(d.message()))
    await aviso(pagina).getByRole('button', { name: 'Aceitar plano' }).click()
    await expect(pagina.getByText('Plano Base Aeróbica ativado')).toBeVisible()
    expect(perguntas).toEqual(['Trocar para o plano Base Aeróbica? O plano atual será substituído e a semana 1 começa agora.'])
    expect(await lerJson(pagina, 'plano')).toEqual({ planoId: 'base-aerobica', inicio: '2026-10-12' })
  })

  test('sugestão do plano que a pessoa já usa: aceitar não pergunta, não reinicia a semana e mostra o selo', async ({ pagina }) => {
    await simularEstado(pagina, ativa('iniciante'))
    await simularSugestaoDoTreinador(pagina, { pendente: sugestaoDeExemplo() })
    await pagina.goto('/hoje')
    await gravarRaw(pagina, 'plano', JSON.stringify({ planoId: 'fundamentos', inicio: '2026-10-05' }))
    await pagina.reload()

    const perguntas: string[] = []
    pagina.on('dialog', d => perguntas.push(d.message()))
    await aviso(pagina).getByRole('button', { name: 'Aceitar plano' }).click()
    await expect(aviso(pagina)).toHaveCount(0)
    expect(perguntas).toEqual([])
    expect(await lerJson(pagina, 'plano')).toEqual({ planoId: 'fundamentos', inicio: '2026-10-05' })
    await expect(pagina.getByText('Sugerido pelo seu treinador Marcos')).toBeVisible()
  })

  test('plano que o nível da pessoa não libera: convite ao plano, sem botão de aceitar, e a sugestão continua', async ({ pagina }) => {
    await simularEstado(pagina, ativa('iniciante'))
    const api = await simularSugestaoDoTreinador(pagina, { pendente: sugestaoDeExemplo({ planoId: 'pre-competicao', planoNome: 'Pré-competição' }) })
    await pagina.goto('/hoje')

    await expect(aviso(pagina)).toContainText('Pré-competição')
    await expect(aviso(pagina)).toContainText('Disponível a partir do plano Profissional')
    await expect(aviso(pagina).getByRole('button', { name: 'Aceitar plano' })).toHaveCount(0)
    await expect(aviso(pagina).getByRole('button', { name: 'Recusar' })).toBeVisible()
    expect(api.escritas()).toEqual([])
    await pagina.reload()
    await expect(aviso(pagina)).toBeVisible()
  })

  test('recusar: pergunta, avisa o servidor, o aviso some e o plano não muda', async ({ pagina }) => {
    await simularEstado(pagina, ativa('iniciante'))
    const api = await simularSugestaoDoTreinador(pagina, { pendente: sugestaoDeExemplo() })
    await pagina.goto('/hoje')
    const perguntas: string[] = []
    pagina.on('dialog', d => perguntas.push(d.message()))
    await aviso(pagina).getByRole('button', { name: 'Recusar' }).click()

    await expect(pagina.getByText('Sugestão recusada')).toBeVisible()
    await expect(aviso(pagina)).toHaveCount(0)
    expect(perguntas).toEqual(['Recusar o plano sugerido por Marcos? Ele pode sugerir outro depois.'])
    expect(api.escritas()).toEqual([{ metodo: 'POST', caminho: `/api/sugestao-do-treinador/${sugestaoDeExemplo().id}/recusar` }])
    expect(await lerJson(pagina, 'plano')).toBeNull()
    await expect(pagina.getByText('Sugerido pelo seu treinador')).toHaveCount(0)
  })

  test('cancelar a pergunta de recusar não faz nada', async ({ pagina }) => {
    await simularEstado(pagina, ativa('iniciante'))
    const api = await simularSugestaoDoTreinador(pagina, { pendente: sugestaoDeExemplo() })
    await pagina.goto('/hoje')
    pagina.removeAllListeners('dialog')
    pagina.on('dialog', d => void d.dismiss())
    await aviso(pagina).getByRole('button', { name: 'Recusar' }).click()
    await expect(aviso(pagina)).toBeVisible()
    expect(api.escritas()).toEqual([])
  })

  test.describe('com resposta de erro de propósito', () => {
    test.use({ toleraRespostaDeErro: true })

    test('o servidor recusa o aceite (já respondida): mostra o erro e NÃO aplica o plano', async ({ pagina }) => {
      await simularEstado(pagina, ativa('iniciante'))
      await simularSugestaoDoTreinador(pagina, {
        pendente: sugestaoDeExemplo(),
        falhaAoResponder: { status: 404, json: { erro: 'Sugestão não encontrada ou já respondida.', codigo: 'nao_encontrado' } },
      })
      await pagina.goto('/hoje')
      await aviso(pagina).getByRole('button', { name: 'Aceitar plano' }).click()

      await expect(alerta(pagina).first()).toContainText('Sugestão não encontrada ou já respondida.')
      await expect(aviso(pagina)).toBeVisible()
      expect(await lerJson(pagina, 'plano')).toBeNull()
      await expect(aviso(pagina).getByRole('button', { name: 'Aceitar plano' })).toBeEnabled()
    })

    test('falha ao consultar as sugestões: a tela Hoje segue normal, sem aviso e sem erro visível', async ({ pagina }) => {
      await simularEstado(pagina, ativa('iniciante'))
      await simularSugestaoDoTreinador(pagina, { falhaNaConsulta: true })
      await pagina.goto('/hoje')
      await expect(pagina.getByRole('heading', { name: 'Treino de hoje' })).toBeVisible()
      await expect(aviso(pagina)).toHaveCount(0)
      await expect(alerta(pagina)).toHaveCount(0)
    })
  })

  test('360 px sem rolagem lateral e sem violações de acessibilidade (axe), com os detalhes abertos', async ({ pagina }) => {
    await pagina.setViewportSize({ width: 360, height: 760 })
    await simularEstado(pagina, ativa('iniciante'))
    await simularSugestaoDoTreinador(pagina, { pendente: sugestaoDeExemplo({ treinador: 'Maximiliano', mensagem: 'Uma mensagem bem longa para testar a quebra. '.repeat(8) }) })
    await pagina.goto('/hoje')
    await aviso(pagina).getByRole('button', { name: 'Ver o plano' }).click()
    expect(await pagina.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
    expect(await auditar(pagina)).toEqual([])
  })
})

test.describe('aluno: selo "Sugerido pelo seu treinador"', () => {
  const aceitaEm = (respondidaEm: string) => sugestaoDeExemplo({ respondidaEm })

  test('no plano e na tela Hoje, quando o plano ativo é o da última sugestão aceita', async ({ pagina }) => {
    await simularEstado(pagina, ativa('iniciante'))
    await simularSugestaoDoTreinador(pagina, { aceita: aceitaEm('2026-10-13T15:00:00.000Z') })
    await pagina.goto('/hoje')
    await gravarRaw(pagina, 'plano', JSON.stringify({ planoId: 'fundamentos', inicio: '2026-10-12' }))
    await pagina.reload()
    await expect(pagina.getByText('Sugerido pelo seu treinador Marcos')).toBeVisible()
    await pagina.goto('/plano')
    await expect(pagina.getByText('Sugerido pelo seu treinador Marcos')).toBeVisible()
  })

  test('sem selo quando o plano ativo é outro; com o mesmo plano de semanas antes, o selo continua', async ({ pagina }) => {
    await simularEstado(pagina, ativa('amador'))
    await simularSugestaoDoTreinador(pagina, { aceita: aceitaEm('2026-10-13T15:00:00.000Z') })
    await pagina.goto('/plano')
    await gravarRaw(pagina, 'plano', JSON.stringify({ planoId: 'base-aerobica', inicio: '2026-10-12' }))
    await pagina.reload()
    await expect(pagina.getByRole('heading', { name: 'Base Aeróbica' })).toBeVisible()
    await expect(pagina.getByText('Sugerido pelo seu treinador')).toHaveCount(0)

    await gravarRaw(pagina, 'plano', JSON.stringify({ planoId: 'fundamentos', inicio: '2026-10-05' }))
    await pagina.reload()
    await expect(pagina.getByRole('heading', { name: 'Fundamentos' })).toBeVisible()
    await expect(pagina.getByText('Sugerido pelo seu treinador Marcos')).toBeVisible()
  })
})

test.describe('barra: aba "Alunos" e selo vermelho', () => {
  for (const [nome, estado, aparece] of [
    ['Cornerman', ativa('cornerman'), true],
    ['Profissional', ativa('profissional'), true],
    ['pagamento desligado', 'indisponivel', true],
    ['Amador', ativa('amador'), false],
    ['Iniciante', ativa('iniciante'), false],
    ['gratuito', SEM_ASSINATURA_TESTE, false],
  ] as const) {
    test(`${nome}: ${aparece ? 'tem' : 'não tem'} a aba, entre Progresso e Perfil`, async ({ pagina }) => {
      await simularEstado(pagina, estado)
      const api = await simularAlunos(pagina, [])
      await pagina.goto('/hoje')
      await expect(barra(pagina).getByRole('link', { name: 'Perfil' })).toBeVisible()
      const nomes = await barra(pagina).getByRole('link').evaluateAll(els => els.map(e => e.textContent?.trim()))
      if (aparece) {
        expect(nomes).toEqual(['Hoje', 'Plano', 'Timer', 'Progresso', 'Alunos', 'Perfil'])
      } else {
        expect(nomes).toEqual(['Hoje', 'Plano', 'Timer', 'Progresso', 'Perfil'])
        // Sem o plano, o selo nem é consultado (a página do login, de antes do teste, pode ter feito a dela).
        const antes = api.consultasDoSelo
        await pagina.waitForTimeout(600)
        expect(api.consultasDoSelo).toBe(antes)
      }
    })
  }

  test('clicar leva à lista de alunos e acende a aba', async ({ pagina }) => {
    await simularEstado(pagina, ativa('cornerman'))
    await simularAlunos(pagina, [ficha('Ana')])
    await pagina.goto('/hoje')
    await barra(pagina).getByRole('link', { name: 'Alunos' }).click()
    await expect(pagina).toHaveURL(/\/alunos$/)
    await expect(barra(pagina).getByRole('link', { name: 'Alunos' })).toHaveAttribute('aria-current', 'page')
  })

  test('selo com o número de alunos parados, lido por inteiro por leitor de tela', async ({ pagina }) => {
    await simularEstado(pagina, ativa('cornerman'))
    await simularAlunos(pagina, [], { vermelhos: 3 })
    await pagina.goto('/hoje')
    const aba = barra(pagina).getByRole('link', { name: /^Alunos/ })
    await expect(aba).toContainText('3')
    await expect(aba).toContainText('3 alunos sem treinar há 7 dias ou mais')
    await expect(aba.locator('[aria-hidden="true"]').filter({ hasText: '3' })).toBeVisible()
  })

  test('um aluno no singular, e mais de 9 vira "9+"', async ({ pagina }) => {
    await simularEstado(pagina, ativa('cornerman'))
    await simularAlunos(pagina, [], { vermelhos: 1 })
    await pagina.goto('/hoje')
    await expect(barra(pagina).getByRole('link', { name: /^Alunos/ })).toContainText('1 aluno sem treinar há 7 dias ou mais')

    const outra = await pagina.context().newPage()
    await simularEstado(outra, ativa('cornerman'))
    await simularAlunos(outra, [], { vermelhos: 12 })
    await outra.goto('/hoje')
    const aba = barra(outra).getByRole('link', { name: /^Alunos/ })
    await expect(aba.locator('[aria-hidden="true"]').filter({ hasText: '9+' })).toBeVisible()
    await expect(aba).toContainText('12 alunos sem treinar há 7 dias ou mais')
  })

  test('nenhum aluno parado: sem selo', async ({ pagina }) => {
    await simularEstado(pagina, ativa('cornerman'))
    await simularAlunos(pagina, [], { vermelhos: 0 })
    await pagina.goto('/hoje')
    await expect(barra(pagina).getByRole('link', { name: 'Alunos', exact: true })).toBeVisible()
    await expect(barra(pagina).getByText('sem treinar')).toHaveCount(0)
  })

  test.describe('com resposta de erro de propósito', () => {
    test.use({ toleraRespostaDeErro: true })

    test('falha ao consultar o selo: a aba continua, sem selo e sem erro na tela', async ({ pagina }) => {
      await simularEstado(pagina, ativa('cornerman'))
      await simularAlunos(pagina, [], { falhaNoSelo: true })
      await pagina.goto('/hoje')
      await expect(barra(pagina).getByRole('link', { name: 'Alunos', exact: true })).toBeVisible()
      await expect(barra(pagina).getByText('sem treinar')).toHaveCount(0)
      await expect(alerta(pagina)).toHaveCount(0)
    })
  })

  test('o selo é consultado de novo a cada troca de tela', async ({ pagina }) => {
    await simularEstado(pagina, ativa('cornerman'))
    const api = await simularAlunos(pagina, [], { vermelhos: 2 })
    await pagina.goto('/hoje')
    await expect(barra(pagina).getByRole('link', { name: /^Alunos/ })).toContainText('2')
    const antes = api.consultasDoSelo
    await barra(pagina).getByRole('link', { name: 'Plano' }).click()
    await expect(pagina).toHaveURL(/\/plano$/)
    await expect.poll(() => api.consultasDoSelo).toBeGreaterThan(antes)
  })

  test('360 px: as sete posições cabem sem se sobrepor, sem texto cortado, e sem violações de acessibilidade (axe)', async ({ pagina }) => {
    await pagina.setViewportSize({ width: 360, height: 760 })
    await simularEstado(pagina, ativa('cornerman'))
    await simularAlunos(pagina, [], { vermelhos: 12 })
    await pagina.goto('/hoje')
    const aba = barra(pagina).getByRole('link', { name: /^Alunos/ })
    await expect(aba).toContainText('12 alunos')

    const caixas = await barra(pagina).locator('a, button').evaluateAll(els => els.map(e => {
      const r = e.getBoundingClientRect()
      return { nome: (e.getAttribute('aria-label') ?? e.textContent ?? '').trim().slice(0, 12), esquerda: r.left, direita: r.right }
    }))
    expect(caixas).toHaveLength(7)
    for (let i = 0; i < caixas.length; i++) {
      expect(caixas[i].esquerda, caixas[i].nome).toBeGreaterThanOrEqual(0)
      expect(caixas[i].direita, caixas[i].nome).toBeLessThanOrEqual(360)
      if (i > 0) expect(caixas[i].esquerda, `${caixas[i - 1].nome} / ${caixas[i].nome}`).toBeGreaterThanOrEqual(caixas[i - 1].direita - 1)
    }
    // O rótulo de cada aba inteiro dentro da própria aba (nada cortado nem vazando para a vizinha).
    for (const link of await barra(pagina).getByRole('link').all()) {
      const rotulo = link.locator('span').nth(1)
      expect(await rotulo.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `rótulo cortado: ${await rotulo.textContent()}`).toBe(true)
    }
    expect(await pagina.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
    expect(await auditar(pagina)).toEqual([])
  })
})
