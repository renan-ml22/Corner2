import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { SEM_ASSINATURA_TESTE, ativa, simularEstado } from './assinatura-simulada'
import { expect, lerJson, test } from './fixtures'

// Timer (aba do meio da barra): cronômetro livre, igual para todos os planos. O relógio do navegador é falso
// (clock.install): o teste "avança" o tempo sem esperar de verdade.

const AGORA = new Date('2026-10-14T12:00:00-03:00')
const CONFIG_CURTA = { rounds: 2, roundSeg: 60, descansoSeg: 30, preparo: true, vibracao: true, volume: 80, mudo: false }

declare global {
  interface Window {
    __audio: { criados: number; oscs: number[] }
    __vibrou: number[][]
    __wake: number
  }
}

/** Anota o que o app tentaria tocar, vibrar e travar (o navegador de teste não tem alto-falante nem tela para apagar). */
async function espionar(pagina: Page) {
  await pagina.addInitScript(() => {
    window.__audio = { criados: 0, oscs: [] }
    window.__vibrou = []
    window.__wake = 0
    const Original = window.AudioContext
    window.AudioContext = class extends Original {
      constructor(...args: ConstructorParameters<typeof AudioContext>) {
        super(...args)
        window.__audio.criados++
      }
      createOscillator() {
        const o = super.createOscillator()
        const iniciar = o.start.bind(o)
        o.start = (t?: number) => { window.__audio.oscs.push(o.frequency.value); iniciar(t) }
        return o
      }
    }
    navigator.vibrate = ((padrao: number | number[]) => { window.__vibrou.push(Array.isArray(padrao) ? padrao : [padrao]); return true }) as typeof navigator.vibrate
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: async () => { window.__wake++; return { release: async () => undefined, addEventListener() {}, removeEventListener() {} } } },
      configurable: true,
    })
  })
}

async function abrirTimer(pagina: Page, config: Record<string, unknown> | null = CONFIG_CURTA, congelar = true) {
  await simularEstado(pagina, SEM_ASSINATURA_TESTE)
  await espionar(pagina)
  await pagina.clock.install({ time: AGORA })
  await pagina.goto('/')
  if (config) await pagina.evaluate(c => localStorage.setItem('corner:timer:config', JSON.stringify(c)), config)
  await pagina.goto('/timer')
  await expect(pagina.getByRole('heading', { name: 'Timer', level: 1 })).toBeVisible()
  // Daqui em diante o tempo só anda quando o teste manda (clock.runFor): com o relógio correndo sozinho, uma máquina lenta
  // deixaria a contagem passar do valor esperado antes da conferência.
  // (O axe espera por animações e não termina com o relógio parado: o teste de acessibilidade deixa o tempo correr.)
  if (congelar) await pagina.clock.pauseAt(new Date(AGORA.getTime() + 10 * 60_000))
}

const fase = (pagina: Page) => pagina.locator('[data-fase]')
const tempo = (pagina: Page) => pagina.getByRole('timer')
const avancar = (pagina: Page, segundos: number) => pagina.clock.runFor(segundos * 1000)
/** Um segundo de cada vez, dando tempo para a tela desenhar cada valor (avisos da contagem regressiva dependem disso). */
async function avancarDevagar(pagina: Page, segundos: number) {
  for (let i = 0; i < segundos; i++) {
    await pagina.clock.runFor(1000)
    await pagina.evaluate(() => new Promise<void>(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0) }))
  }
}
const oscs = (pagina: Page) => pagina.evaluate(() => window.__audio.oscs)

async function auditar(pagina: Page) {
  // Espera a troca de cor da fase terminar: medir contraste no meio da transição lê uma cor misturada.
  await pagina.evaluate(() => Promise.all(document.getAnimations().filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime ?? Infinity)).map(a => a.finished.catch(() => undefined))))
  const resultado = await new AxeBuilder({ page: pagina }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  return resultado.violations.map(v => `${v.id} (${v.impact}): ${v.help}\n${v.nodes.slice(0, 4).map(n => `   - ${n.target.join(' ')}  ${(n.failureSummary ?? '').split('\n')[1] ?? ''}`).join('\n')}`)
}

test.describe('aba Timer', () => {
  test('a aba Timer fica na barra, com o ícone de cronômetro, e abre a tela, no plano gratuito e no Profissional', async ({ pagina }) => {
    for (const estado of [SEM_ASSINATURA_TESTE, ativa('profissional')]) {
      await simularEstado(pagina, estado)
      await pagina.goto('/hoje')
      const nav = pagina.getByRole('navigation', { name: 'Navegação principal' })
      await expect(nav.getByRole('link', { name: 'Timer' })).toBeVisible()
      await nav.getByRole('link', { name: 'Timer' }).click()
      await pagina.waitForURL('**/timer')
      await expect(nav.getByRole('link', { name: 'Timer' })).toHaveAttribute('aria-current', 'page')
      await expect(pagina.getByRole('heading', { name: 'Timer', level: 1 })).toBeVisible()
      await expect(pagina.getByRole('button', { name: 'INICIAR', exact: true })).toBeVisible()
    }
  })

  test('a barra continua com todas as abas e o botão de registrar', async ({ pagina }) => {
    await pagina.goto('/timer')
    const nav = pagina.getByRole('navigation', { name: 'Navegação principal' })
    for (const nome of ['Hoje', 'Plano', 'Timer', 'Progresso', 'Perfil']) await expect(nav.getByRole('link', { name: nome })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Registrar treino' })).toBeVisible()
  })
})

test.describe('timer: configuração', () => {
  test('sem nada guardado: 3 rounds de 3 minutos, descanso de 1 minuto, preparo de 10 s', async ({ pagina }) => {
    await abrirTimer(pagina, null)
    await expect(pagina.getByText('Round 1 / 3')).toBeVisible()
    await expect(tempo(pagina)).toHaveText('03:00')
    await expect(fase(pagina)).toHaveAttribute('data-fase', 'pronto')
    await expect(pagina.getByText('PRONTO', { exact: true })).toBeVisible()
    await expect(pagina.getByText(/3 × 03:00 · descanso 1 min · 11:10 no total/)).toBeVisible()
  })

  test('o painel muda rounds, tempo, descanso, preparo e vibração, guarda no aparelho e vale depois de recarregar', async ({ pagina }) => {
    await abrirTimer(pagina, null)
    await pagina.getByRole('button', { name: 'Ajustes' }).click()
    const painel = pagina.getByRole('dialog', { name: 'Configurações do timer' })
    await painel.getByRole('button', { name: 'Aumentar Rounds' }).click()
    await painel.getByRole('button', { name: 'Aumentar Rounds' }).click()
    await painel.getByRole('button', { name: 'Diminuir Tempo do round' }).click()
    await painel.getByRole('radio', { name: '2 min' }).click()
    await painel.getByRole('switch', { name: /Preparação de 10 s/ }).uncheck()
    await painel.getByRole('switch', { name: /Vibração/ }).uncheck()
    // O painel continua aberto depois de cada toque (mudar o tempo recria o cronômetro, mas não o painel).
    await expect(painel).toBeVisible()
    await expect(painel.getByRole('radio', { name: '2 min' })).toHaveAttribute('aria-checked', 'true')
    await painel.getByRole('button', { name: 'Fechar' }).click()

    await expect(pagina.getByText('Round 1 / 5')).toBeVisible()
    await expect(tempo(pagina)).toHaveText('02:30')
    expect(await pagina.evaluate(() => JSON.parse(localStorage.getItem('corner:timer:config')!))).toMatchObject({
      rounds: 5, roundSeg: 150, descansoSeg: 120, preparo: false, vibracao: false,
    })

    await pagina.reload()
    await expect(pagina.getByText('Round 1 / 5')).toBeVisible()
    await expect(tempo(pagina)).toHaveText('02:30')
  })

  test('limites: de 1 a 20 rounds, de 01:00 a 05:00 por round', async ({ pagina }) => {
    await abrirTimer(pagina, { ...CONFIG_CURTA, rounds: 20, roundSeg: 300 })
    await pagina.getByRole('button', { name: 'Ajustes' }).click()
    const painel = pagina.getByRole('dialog', { name: 'Configurações do timer' })
    await expect(painel.getByRole('button', { name: 'Aumentar Rounds' })).toBeDisabled()
    await expect(painel.getByRole('button', { name: 'Aumentar Tempo do round' })).toBeDisabled()
    await painel.getByRole('button', { name: 'Fechar' }).click()
    await pagina.evaluate(() => localStorage.setItem('corner:timer:config', JSON.stringify({ rounds: 1, roundSeg: 60 })))
    await pagina.reload()
    await pagina.getByRole('button', { name: 'Ajustes' }).click()
    await expect(pagina.getByRole('button', { name: 'Diminuir Rounds' })).toBeDisabled()
    await expect(pagina.getByRole('button', { name: 'Diminuir Tempo do round' })).toBeDisabled()
  })

  test('configuração quebrada ou adulterada no aparelho não derruba a tela: volta ao padrão, campo por campo', async ({ pagina }) => {
    await abrirTimer(pagina, { rounds: 999, roundSeg: 'x', descansoSeg: 45, preparo: 'sim', volume: -3 })
    await expect(pagina.getByText('Round 1 / 20')).toBeVisible()
    await expect(tempo(pagina)).toHaveText('03:00')
    await pagina.evaluate(() => localStorage.setItem('corner:timer:config', '{quebrado'))
    await pagina.reload()
    await expect(pagina.getByText('Round 1 / 3')).toBeVisible()
  })
})

test.describe('timer: andamento', () => {
  test('passa por preparação, rounds e descanso, com o nome, o round e a contagem de cada fase, até o fim', async ({ pagina }) => {
    await abrirTimer(pagina)
    await pagina.getByRole('button', { name: 'INICIAR', exact: true }).click()
    await expect(fase(pagina)).toHaveAttribute('data-fase', 'preparo')
    await expect(pagina.getByText('PREPARAÇÃO', { exact: true })).toBeVisible()
    await expect(tempo(pagina)).toHaveText('00:10')

    await avancar(pagina, 4)
    await expect(tempo(pagina)).toHaveText('00:06')

    await avancar(pagina, 6)
    await expect(fase(pagina)).toHaveAttribute('data-fase', 'round')
    await expect(pagina.getByText('ROUND', { exact: true })).toBeVisible()
    await expect(pagina.getByText('Round 1 / 2')).toBeVisible()
    await expect(tempo(pagina)).toHaveText('01:00')

    await avancar(pagina, 60)
    await expect(fase(pagina)).toHaveAttribute('data-fase', 'descanso')
    await expect(pagina.getByText('DESCANSO', { exact: true })).toBeVisible()
    await expect(tempo(pagina)).toHaveText('00:30')

    await avancar(pagina, 30)
    await expect(fase(pagina)).toHaveAttribute('data-fase', 'round')
    await expect(pagina.getByText('Round 2 / 2')).toBeVisible()

    await avancar(pagina, 60)
    await expect(fase(pagina)).toHaveAttribute('data-fase', 'fim')
    await expect(pagina.getByText('Treino concluído!')).toBeVisible()
    await expect(pagina.getByText('2/2')).toBeVisible()
    // 2 rounds de 1 min + 1 descanso de 30 s + 10 s de preparo = 02:40
    await expect(pagina.getByRole('group').or(pagina.locator('dl')).getByText('02:40')).toBeVisible()
  })

  test('pausar para o relógio e retomar continua de onde parou', async ({ pagina }) => {
    await abrirTimer(pagina, { ...CONFIG_CURTA, preparo: false })
    await pagina.getByRole('button', { name: 'INICIAR', exact: true }).click()
    await avancar(pagina, 15)
    await expect(tempo(pagina)).toHaveText('00:45')
    await pagina.getByRole('button', { name: 'PAUSAR', exact: true }).click()
    await expect(pagina.getByText('PAUSADO', { exact: true })).toBeVisible()
    await avancar(pagina, 120)
    await expect(tempo(pagina)).toHaveText('00:45')
    await pagina.getByRole('button', { name: 'RETOMAR', exact: true }).click()
    await avancar(pagina, 5)
    await expect(tempo(pagina)).toHaveText('00:40')
  })

  test('sem preparação, o primeiro round começa na hora', async ({ pagina }) => {
    await abrirTimer(pagina, { ...CONFIG_CURTA, preparo: false })
    await pagina.getByRole('button', { name: 'INICIAR', exact: true }).click()
    await expect(fase(pagina)).toHaveAttribute('data-fase', 'round')
  })

  test('reiniciar volta ao começo (e pede confirmação se estiver andando); durante o treino, as configurações ficam travadas', async ({ pagina }) => {
    await abrirTimer(pagina)
    await expect(pagina.getByRole('button', { name: 'Reiniciar' })).toBeDisabled()
    await pagina.getByRole('button', { name: 'INICIAR', exact: true }).click()
    await expect(pagina.getByRole('button', { name: 'Ajustes' })).toBeDisabled()
    await avancar(pagina, 30)
    await pagina.getByRole('button', { name: 'Reiniciar' }).click() // o vigia dos testes aceita a confirmação
    await expect(fase(pagina)).toHaveAttribute('data-fase', 'pronto')
    await expect(tempo(pagina)).toHaveText('01:00')
    await expect(pagina.getByRole('button', { name: 'Ajustes' })).toBeEnabled()
  })

  test('encerrar antes do fim mostra o resumo com os rounds completos', async ({ pagina }) => {
    await abrirTimer(pagina, { ...CONFIG_CURTA, preparo: false })
    await pagina.getByRole('button', { name: 'INICIAR', exact: true }).click()
    await avancar(pagina, 75)
    await pagina.getByRole('button', { name: 'Encerrar e ver o resumo' }).click()
    await expect(pagina.getByText('Treino encerrado')).toBeVisible()
    await expect(pagina.getByText('1/2')).toBeVisible()
  })

  test('pausar e encerrar: o tempo parado não vira treino', async ({ pagina }) => {
    await abrirTimer(pagina, { ...CONFIG_CURTA, preparo: false })
    await pagina.getByRole('button', { name: 'INICIAR', exact: true }).click()
    await avancar(pagina, 45)
    await pagina.getByRole('button', { name: 'PAUSAR', exact: true }).click()
    await avancar(pagina, 120)
    await pagina.getByRole('button', { name: 'Encerrar e ver o resumo' }).click()
    await expect(pagina.getByText('Nenhum round foi completo')).toBeVisible()
    await expect(pagina.locator('dl').getByText('00:45')).toBeVisible()
  })

  test('a barra de baixo pergunta antes de sair com o timer contando', async ({ pagina }) => {
    await abrirTimer(pagina)
    const perguntas: string[] = []
    pagina.on('dialog', d => perguntas.push(d.message()))
    const nav = pagina.getByRole('navigation', { name: 'Navegação principal' })
    // Parado: sai sem perguntar.
    await nav.getByRole('link', { name: 'Plano' }).click()
    await pagina.waitForURL('**/plano')
    expect(perguntas).toEqual([])
    await nav.getByRole('link', { name: 'Timer' }).click()
    await pagina.getByRole('button', { name: 'INICIAR', exact: true }).click()
    await nav.getByRole('link', { name: 'Plano' }).click()
    await pagina.waitForURL('**/plano')
    expect(perguntas).toEqual([expect.stringContaining('Sair do Timer')])
  })

  test('outra aba mudando a configuração não zera um timer que está contando', async ({ pagina }) => {
    await abrirTimer(pagina, { ...CONFIG_CURTA, preparo: false })
    await pagina.getByRole('button', { name: 'INICIAR', exact: true }).click()
    await avancar(pagina, 20)
    await pagina.evaluate(() => {
      const novo = JSON.stringify({ rounds: 9, roundSeg: 120, descansoSeg: 30, preparo: false, vibracao: true, volume: 80, mudo: false })
      localStorage.setItem('corner:timer:config', novo)
      window.dispatchEvent(new StorageEvent('storage', { key: 'corner:timer:config', newValue: novo }))
    })
    await expect(pagina.getByText('Round 1 / 2')).toBeVisible()
    await expect(tempo(pagina)).toHaveText('00:40')
    // Reiniciado, vale a configuração nova.
    await pagina.getByRole('button', { name: 'Reiniciar' }).click()
    await expect(pagina.getByText('Round 1 / 9')).toBeVisible()
  })

  test('o app tenta manter a tela acesa enquanto o timer anda', async ({ pagina }) => {
    await abrirTimer(pagina)
    expect(await pagina.evaluate(() => window.__wake)).toBe(0)
    await pagina.getByRole('button', { name: 'INICIAR', exact: true }).click()
    await expect.poll(() => pagina.evaluate(() => window.__wake)).toBeGreaterThan(0)
  })

  test('o tempo segue o relógio: com a aba em segundo plano e de volta, o timer não atrasa', async ({ pagina }) => {
    await abrirTimer(pagina, { ...CONFIG_CURTA, preparo: false, roundSeg: 300 })
    await pagina.getByRole('button', { name: 'INICIAR', exact: true }).click()
    await pagina.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    // fastForward pula o tempo sem disparar cada tick do relógio: é o que acontece com a aba em segundo plano.
    await pagina.clock.fastForward(100_000)
    await pagina.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await expect(tempo(pagina)).toHaveText('03:20')
  })
})

test.describe('timer: sons e vibração', () => {
  test('o áudio só nasce depois do toque em INICIAR (antes disso, nenhum AudioContext)', async ({ pagina }) => {
    await abrirTimer(pagina)
    expect(await pagina.evaluate(() => window.__audio.criados)).toBe(0)
    await pagina.getByRole('button', { name: 'INICIAR', exact: true }).click()
    await expect.poll(() => pagina.evaluate(() => window.__audio.criados)).toBe(1)
  })

  test('toca a campainha no início do round, o aviso aos 10 s, o bipe longo no fim do round e a sequência no fim', async ({ pagina }) => {
    await abrirTimer(pagina, { ...CONFIG_CURTA, preparo: false })
    await pagina.getByRole('button', { name: 'INICIAR', exact: true }).click()
    // Início do round 1: 3 bipes curtos e 1 longo, todos de 880 Hz.
    await expect.poll(() => oscs(pagina)).toEqual([880, 880, 880, 880])
    await avancar(pagina, 49)
    await expect(tempo(pagina)).toHaveText('00:11')
    expect(await oscs(pagina)).toEqual([880, 880, 880, 880])
    await avancar(pagina, 1)
    // Faltando 10 s: 1 bipe de 660 Hz.
    await expect.poll(() => oscs(pagina)).toEqual([880, 880, 880, 880, 660])
    await avancar(pagina, 10)
    // Fim do round, começo do descanso: 1 bipe de 440 Hz.
    await expect.poll(() => oscs(pagina)).toEqual([880, 880, 880, 880, 660, 440])
    await avancarDevagar(pagina, 27)
    // Faltam 3 s do descanso: primeiro bipe da contagem (um por segundo: 3, 2 e 1).
    await expect.poll(async () => (await oscs(pagina)).length).toBe(6 + 1)
    await avancarDevagar(pagina, 3)
    // Mais 2 bipes da contagem, e a campainha do round 2 (3 curtos e 1 longo): 6 + 3 + 4 sons, todos de 880 Hz.
    await expect.poll(async () => (await oscs(pagina)).slice(6)).toEqual(Array(7).fill(880))
    await avancar(pagina, 60)
    await expect(fase(pagina)).toHaveAttribute('data-fase', 'fim')
    // Fim de todos os rounds: 880 -> 1100 -> 1320 Hz.
    await expect.poll(async () => (await oscs(pagina)).slice(-3)).toEqual([880, 1100, 1320])
  })

  test('mudo: o timer anda, mas nenhum som é gerado; ligar o som volta a tocar', async ({ pagina }) => {
    await abrirTimer(pagina, { ...CONFIG_CURTA, preparo: false, mudo: true })
    await expect(pagina.getByRole('button', { name: 'Mudo' })).toHaveAttribute('aria-pressed', 'true')
    await pagina.getByRole('button', { name: 'INICIAR', exact: true }).click()
    await avancar(pagina, 70)
    await expect(fase(pagina)).toHaveAttribute('data-fase', 'descanso')
    expect(await oscs(pagina)).toEqual([])
    await pagina.getByRole('button', { name: 'Mudo' }).click()
    await expect(pagina.getByRole('button', { name: 'Mudo' })).toHaveAttribute('aria-pressed', 'false')
    await avancar(pagina, 30)
    // Só o que vem depois de desmutar: 3 bipes de contagem do descanso e a campainha do round 2 (o sino do descanso não toca de novo).
    await expect.poll(() => oscs(pagina)).toEqual(Array(7).fill(880))
    expect((await pagina.evaluate(() => JSON.parse(localStorage.getItem('corner:timer:config')!))).mudo).toBe(false)
  })

  test('volume zero também é silêncio', async ({ pagina }) => {
    await abrirTimer(pagina, { ...CONFIG_CURTA, preparo: false, volume: 0 })
    await pagina.getByRole('button', { name: 'INICIAR', exact: true }).click()
    await avancar(pagina, 70)
    expect(await oscs(pagina)).toEqual([])
  })

  test('o controle de volume guarda o valor e ligar o som pelo controle tira o mudo', async ({ pagina }) => {
    await abrirTimer(pagina, { ...CONFIG_CURTA, mudo: true })
    await pagina.getByRole('button', { name: 'Ajustes' }).click()
    const painel = pagina.getByRole('dialog', { name: 'Configurações do timer' })
    await painel.getByRole('slider', { name: 'Volume' }).fill('35')
    expect(await pagina.evaluate(() => JSON.parse(localStorage.getItem('corner:timer:config')!))).toMatchObject({ volume: 35, mudo: false })
    await painel.getByRole('button', { name: 'Mudo' }).click()
    expect((await pagina.evaluate(() => JSON.parse(localStorage.getItem('corner:timer:config')!))).mudo).toBe(true)
  })

  test('vibra ao trocar de fase; com a vibração desligada, não vibra', async ({ pagina }) => {
    await abrirTimer(pagina, { ...CONFIG_CURTA, preparo: false })
    await pagina.getByRole('button', { name: 'INICIAR', exact: true }).click()
    await expect.poll(() => pagina.evaluate(() => window.__vibrou.length)).toBeGreaterThan(0)
  })

  test('vibração desligada: nenhuma vibração', async ({ pagina }) => {
    await abrirTimer(pagina, { ...CONFIG_CURTA, preparo: false, vibracao: false })
    await pagina.getByRole('button', { name: 'INICIAR', exact: true }).click()
    await avancar(pagina, 70)
    expect(await pagina.evaluate(() => window.__vibrou)).toEqual([])
  })
})

test.describe('timer: registrar o treino', () => {
  async function terminar(pagina: Page) {
    await abrirTimer(pagina, { ...CONFIG_CURTA, preparo: false })
    await pagina.getByRole('button', { name: 'INICIAR', exact: true }).click()
    await avancar(pagina, 150)
    await expect(pagina.getByText('Treino concluído!')).toBeVisible()
  }

  test('"Registrar este treino" abre o registro já com os rounds e o tempo do round do timer', async ({ pagina }) => {
    await terminar(pagina)
    await pagina.getByRole('radio', { name: 'Condicionamento' }).click()
    await pagina.getByRole('button', { name: 'Registrar este treino' }).click()
    const registro = pagina.getByRole('dialog', { name: 'Condicionamento' })
    await expect(registro).toBeVisible()
    await expect(registro.getByText('Rounds', { exact: true }).locator('..')).toContainText('2')
    await expect(registro.getByText('Duração do round').locator('..')).toContainText('1')
    await registro.getByRole('button', { name: 'Salvar treino' }).click()
    await expect.poll(async () => (await lerJson(pagina, 'historico')).at(-1)?.rounds ?? (await lerJson(pagina, 'historico'))[0]?.rounds).toBe(2)
    const treinos = await lerJson(pagina, 'historico')
    expect(treinos.some((t: { tipo: string; rounds: number; minPorRound: number; duracaoSegundos: number }) => t.tipo === 'con' && t.rounds === 2 && t.minPorRound === 1 && t.duracaoSegundos === 150)).toBe(true)
  })

  test('"Fechar" volta ao timer pronto, sem registrar nada', async ({ pagina }) => {
    await terminar(pagina)
    await pagina.getByRole('button', { name: 'Fechar' }).click()
    await expect(fase(pagina)).toHaveAttribute('data-fase', 'pronto')
    await expect(pagina.getByRole('dialog')).toHaveCount(0)
  })

  test('encerrar sem completar nenhum round: não há o que registrar', async ({ pagina }) => {
    await abrirTimer(pagina, { ...CONFIG_CURTA, preparo: false })
    await pagina.getByRole('button', { name: 'INICIAR', exact: true }).click()
    await avancar(pagina, 20)
    await pagina.getByRole('button', { name: 'Encerrar e ver o resumo' }).click()
    await expect(pagina.getByText('Nenhum round foi completo')).toBeVisible()
    await expect(pagina.getByRole('button', { name: 'Registrar este treino' })).toHaveCount(0)
  })
})

test.describe('timer: acessibilidade', () => {
  test('sem violações do axe em cada fase, no resumo e no painel de configurações', async ({ pagina }) => {
    await abrirTimer(pagina, { ...CONFIG_CURTA }, false)
    await pagina.waitForLoadState('networkidle')
    expect(await auditar(pagina), 'pronto').toEqual([])

    await pagina.getByRole('button', { name: 'Ajustes' }).click()
    expect(await auditar(pagina), 'painel de configurações').toEqual([])
    await pagina.keyboard.press('Escape')

    await pagina.getByRole('button', { name: 'INICIAR', exact: true }).click()
    expect(await auditar(pagina), 'preparação').toEqual([])
    await avancar(pagina, 10)
    await expect(fase(pagina)).toHaveAttribute('data-fase', 'round')
    expect(await auditar(pagina), 'round').toEqual([])
    await avancar(pagina, 60)
    await expect(fase(pagina)).toHaveAttribute('data-fase', 'descanso')
    expect(await auditar(pagina), 'descanso').toEqual([])
    await pagina.getByRole('button', { name: 'PAUSAR', exact: true }).click()
    expect(await auditar(pagina), 'pausado').toEqual([])
    await pagina.getByRole('button', { name: 'RETOMAR', exact: true }).click()
    await avancar(pagina, 100)
    await expect(fase(pagina)).toHaveAttribute('data-fase', 'fim')
    expect(await auditar(pagina), 'fim').toEqual([])
  })

  test('o painel de configurações fecha com Esc e devolve o foco ao botão de ajustes', async ({ pagina }) => {
    await abrirTimer(pagina)
    const botao = pagina.getByRole('button', { name: 'Ajustes' })
    await botao.click()
    await expect(pagina.getByRole('dialog', { name: 'Configurações do timer' })).toBeVisible()
    await pagina.keyboard.press('Escape')
    await expect(pagina.getByRole('dialog')).toHaveCount(0)
    await expect(botao).toBeFocused()
  })
})
