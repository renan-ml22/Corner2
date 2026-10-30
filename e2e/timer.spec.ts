import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { FREQ_BASE_DO_SINO, PARCIAIS_DO_SINO } from '../lib/som-timer'
import { SEM_ASSINATURA_TESTE, ativa, simularEstado } from './assinatura-simulada'
import { expect, lerJson, test } from './fixtures'

// Timer (aba do meio da barra): cronômetro livre, igual para todos os planos. O relógio do navegador é falso
// (clock.install): o teste "avança" o tempo sem esperar de verdade.

const AGORA = new Date('2026-10-14T12:00:00-03:00')
const CONFIG_CURTA = { rounds: 2, roundSeg: 60, descansoSeg: 30, preparo: true, vibracao: true, volume: 80, mudo: false }

/** Um tom programado: a frequência (Hz) e daqui a quantos segundos (no relógio do áudio) ele começa. */
interface Tom { f: number; t: number }

declare global {
  interface Window {
    __audio: { criados: number; oscs: Tom[]; desligados: number }
    __vibrou: number[][]
    __wake: number
    __midia: { plays: number; handlers: Record<string, (() => void) | null | undefined> }
  }
}

/** Anota o que o app tentaria tocar, vibrar e travar (o navegador de teste não tem alto-falante nem tela para apagar). */
async function espionar(pagina: Page) {
  await pagina.addInitScript(() => {
    window.__audio = { criados: 0, oscs: [], desligados: 0 }
    window.__vibrou = []
    window.__wake = 0
    // "Manter o som com a tela bloqueada": o áudio de mídia inaudível e os botões do controle de mídia.
    window.__midia = { plays: 0, handlers: {} }
    HTMLMediaElement.prototype.play = function () { window.__midia.plays++; return Promise.resolve() }
    navigator.mediaSession.setActionHandler = ((acao: string, f: (() => void) | null) => { window.__midia.handlers[acao] = f }) as typeof navigator.mediaSession.setActionHandler
    const Original = window.AudioContext
    window.AudioContext = class extends Original {
      constructor(...args: ConstructorParameters<typeof AudioContext>) {
        super(...args)
        window.__audio.criados++
      }
      createOscillator() {
        const o = super.createOscillator()
        const iniciar = o.start.bind(o)
        // Os sons são programados no futuro: o que importa é o horário (daqui a quantos segundos), arredondado a 0,1 s.
        o.start = (t?: number) => {
          window.__audio.oscs.push({ f: Math.round(o.frequency.value), t: Math.round(((t ?? 0) - o.context.currentTime) * 10) / 10 + 0 })
          iniciar(t)
        }
        return o
      }
    }
    // Cada som passa por uma porta; cortar um som que ainda não tocou é desligar a porta dele.
    const desligar = AudioNode.prototype.disconnect as (...a: unknown[]) => void
    AudioNode.prototype.disconnect = function (this: AudioNode, ...a: unknown[]) { window.__audio.desligados++; return desligar.apply(this, a) } as typeof AudioNode.prototype.disconnect
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
/** Os tons programados até agora (ver `espionar`). */
const oscs = (pagina: Page): Promise<Tom[]> => pagina.evaluate(() => window.__audio.oscs)
/** Os tons programados depois dos `desde` primeiros: o que o app programou de novo desde a última conferência. */
const novos = async (pagina: Page, desde: number) => (await oscs(pagina)).slice(desde)
/** Um sino que entra daqui a `t` segundos; `batidas` são os atrasos de cada badalada (início do round: uma; fim de round: três). */
const sinoEm = (t: number, batidas: number[] = [0]): Tom[] =>
  batidas.flatMap(b => PARCIAIS_DO_SINO.map(p => ({ f: Math.round(FREQ_BASE_DO_SINO * p.razao), t: Math.round((t + b) * 10) / 10 })))
const BADALADAS_DE_INICIO = [0]
const BADALADAS_DE_FIM_DE_ROUND = [0, 0.5, 1]
const BADALADAS_DE_FIM_DO_TREINO = [0, 0.5, 1, 1.7]
/** A contagem 3-2-1 que termina em `t`: um bipe por segundo, cada vez mais agudo. */
const contagemAte = (t: number): Tom[] => [{ f: 1000, t: t - 3 }, { f: 1250, t: t - 2 }, { f: 1600, t: t - 1 }]
/** O aviso dos 10 s: 1 bipe de 660 Hz. */
const avisoEm = (t: number): Tom => ({ f: 660, t })

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
    await painel.getByRole('button', { name: 'Diminuir Minutos do round' }).click()
    await painel.getByRole('slider', { name: 'Segundos do round' }).fill('30')
    await painel.getByRole('button', { name: 'Aumentar Minutos do descanso' }).click()
    await painel.getByRole('switch', { name: /Preparação de 10 s/ }).uncheck()
    await painel.getByRole('switch', { name: /Vibração/ }).uncheck()
    // O painel continua aberto depois de cada toque (mudar o tempo recria o cronômetro, mas não o painel).
    await expect(painel).toBeVisible()
    await expect(painel.getByRole('slider', { name: 'Segundos do round' })).toHaveValue('30')
    await expect(painel.getByText('02:30', { exact: true })).toBeVisible()
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

  test('limites: de 1 a 20 rounds, de 00:10 a 10:00 por round, de 0 a 10:00 de descanso', async ({ pagina }) => {
    await abrirTimer(pagina, { ...CONFIG_CURTA, rounds: 20, roundSeg: 600, descansoSeg: 600 })
    await pagina.getByRole('button', { name: 'Ajustes' }).click()
    const painel = pagina.getByRole('dialog', { name: 'Configurações do timer' })
    await expect(painel.getByRole('button', { name: 'Aumentar Rounds' })).toBeDisabled()
    await expect(painel.getByRole('button', { name: 'Aumentar Minutos do round' })).toBeDisabled()
    await expect(painel.getByRole('button', { name: 'Aumentar Minutos do descanso' })).toBeDisabled()
    // 10:00 é o teto: com 10 minutos, os segundos ficam em 0 e não passam disso.
    await expect(painel.getByRole('slider', { name: 'Segundos do round' })).toHaveValue('0')
    await painel.getByRole('slider', { name: 'Segundos do round' }).fill('40')
    await expect(painel.getByRole('slider', { name: 'Segundos do round' })).toHaveValue('0')
    await painel.getByRole('button', { name: 'Fechar' }).click()

    await pagina.evaluate(() => localStorage.setItem('corner:timer:config', JSON.stringify({ rounds: 1, roundSeg: 10, descansoSeg: 0 })))
    await pagina.reload()
    await pagina.getByRole('button', { name: 'Ajustes' }).click()
    await expect(pagina.getByRole('button', { name: 'Diminuir Rounds' })).toBeDisabled()
    await expect(pagina.getByRole('button', { name: 'Diminuir Minutos do round' })).toBeDisabled()
    await expect(pagina.getByRole('button', { name: 'Diminuir Minutos do descanso' })).toBeDisabled()
    // Um round não pode ter menos de 10 s: 0 min e 3 s volta para 10 s.
    await pagina.getByRole('slider', { name: 'Segundos do round' }).fill('3')
    await expect(pagina.getByRole('slider', { name: 'Segundos do round' })).toHaveValue('10')
    await pagina.getByRole('button', { name: 'Fechar' }).click()
    await expect(tempo(pagina)).toHaveText('00:10')
  })

  test('os segundos (0 a 59) mudam o tempo de segundo em segundo, no round e no descanso, e o resumo mostra o total', async ({ pagina }) => {
    await abrirTimer(pagina, null)
    await pagina.getByRole('button', { name: 'Ajustes' }).click()
    const painel = pagina.getByRole('dialog', { name: 'Configurações do timer' })
    const segundosRound = painel.getByRole('slider', { name: 'Segundos do round' })
    const segundosDescanso = painel.getByRole('slider', { name: 'Segundos do descanso' })
    await expect(segundosRound).toHaveAttribute('min', '0')
    await expect(segundosRound).toHaveAttribute('max', '59')
    await expect(segundosDescanso).toHaveAttribute('min', '0')
    await expect(segundosDescanso).toHaveAttribute('max', '59')
    await segundosRound.fill('47')
    await segundosDescanso.fill('15')
    await expect(painel.getByText('03:47', { exact: true })).toBeVisible()
    await painel.getByRole('button', { name: 'Fechar' }).click()
    await expect(tempo(pagina)).toHaveText('03:47')
    // 10 s de preparo + 3 × 3:47 + 2 × 1:15 = 10 + 681 + 150 = 841 s = 14:01
    await expect(pagina.getByText(/3 × 03:47 · descanso 1 min 15 s · 14:01 no total/)).toBeVisible()
    expect(await pagina.evaluate(() => JSON.parse(localStorage.getItem('corner:timer:config')!))).toMatchObject({ roundSeg: 227, descansoSeg: 75 })
  })

  test('descanso de 0: os rounds seguem um atrás do outro, sem fase de descanso', async ({ pagina }) => {
    await abrirTimer(pagina, { ...CONFIG_CURTA, roundSeg: 20, descansoSeg: 0, preparo: false })
    await expect(pagina.getByText(/2 × 00:20 · sem descanso · 00:40 no total/)).toBeVisible()
    await pagina.getByRole('button', { name: 'INICIAR', exact: true }).click()
    await avancar(pagina, 20)
    await expect(fase(pagina)).toHaveAttribute('data-fase', 'round')
    await expect(pagina.getByText('Round 2 / 2')).toBeVisible()
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

  test('com tempos de segundo em segundo (round de 25 s, descanso de 7 s), cada fase dura exatamente isso', async ({ pagina }) => {
    await abrirTimer(pagina, { ...CONFIG_CURTA, roundSeg: 25, descansoSeg: 7, preparo: false })
    await pagina.getByRole('button', { name: 'INICIAR', exact: true }).click()
    await expect(tempo(pagina)).toHaveText('00:25')
    await avancar(pagina, 25)
    await expect(fase(pagina)).toHaveAttribute('data-fase', 'descanso')
    await expect(tempo(pagina)).toHaveText('00:07')
    await avancar(pagina, 7)
    await expect(fase(pagina)).toHaveAttribute('data-fase', 'round')
    await expect(pagina.getByText('Round 2 / 2')).toBeVisible()
    await avancar(pagina, 25)
    await expect(fase(pagina)).toHaveAttribute('data-fase', 'fim')
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

  test('ao tocar INICIAR o treino inteiro já fica programado no relógio do áudio: cada som no seu horário (é isso que toca com a aba em segundo plano)', async ({ pagina }) => {
    await abrirTimer(pagina, { ...CONFIG_CURTA, preparo: false })
    await pagina.getByRole('button', { name: 'INICIAR', exact: true }).click()
    await expect.poll(() => oscs(pagina)).toEqual([
      // Round 1: sino de abertura, aviso dos 10 s, contagem 3-2-1 e "ting ting ting" ao entrar no descanso.
      ...sinoEm(0, BADALADAS_DE_INICIO), avisoEm(50), ...contagemAte(60), ...sinoEm(60, BADALADAS_DE_FIM_DE_ROUND),
      // Descanso de 30 s: contagem e sino do round 2.
      ...contagemAte(90), ...sinoEm(90, BADALADAS_DE_INICIO),
      // Round 2: aviso, contagem e, no fim de tudo, 4 badaladas.
      avisoEm(140), ...contagemAte(150), ...sinoEm(150, BADALADAS_DE_FIM_DO_TREINO),
    ])
    // Nada é programado de novo enquanto o tempo anda e a página fica na tela.
    const programados = (await oscs(pagina)).length
    await avancarDevagar(pagina, 5)
    expect((await oscs(pagina)).length).toBe(programados)
  })

  test('a contagem 3-2-1 também toca no fim da preparação de 10 s, antes do sino do round 1', async ({ pagina }) => {
    await abrirTimer(pagina)
    await pagina.getByRole('button', { name: 'INICIAR', exact: true }).click()
    await expect.poll(async () => (await oscs(pagina)).slice(0, 3 + 9)).toEqual([...contagemAte(10), ...sinoEm(10, BADALADAS_DE_INICIO)])
  })

  test('aba em segundo plano: ao voltar, o sino que ficou para trás não toca atrasado e o que falta é programado a partir do relógio', async ({ pagina }) => {
    await abrirTimer(pagina, { ...CONFIG_CURTA, preparo: false })
    await pagina.getByRole('button', { name: 'INICIAR', exact: true }).click()
    await expect.poll(async () => (await oscs(pagina)).length).toBeGreaterThan(0)
    const antes = (await oscs(pagina)).length
    // 100 s de segundo plano: o relógio do aparelho andou, o do áudio quase nada (como no iPhone com a tela bloqueada).
    await pagina.clock.fastForward(100_000)
    await pagina.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await expect.poll(() => novos(pagina, antes)).toEqual([avisoEm(40), ...contagemAte(50), ...sinoEm(50, BADALADAS_DE_FIM_DO_TREINO)])
  })

  test('pausar corta os sons que ainda não tocaram; retomar programa os que faltam a partir de onde parou', async ({ pagina }) => {
    await abrirTimer(pagina)
    await pagina.getByRole('button', { name: 'INICIAR', exact: true }).click()
    await expect.poll(async () => (await oscs(pagina)).length).toBeGreaterThan(0)
    expect(await pagina.evaluate(() => window.__audio.desligados)).toBe(0)
    await avancar(pagina, 20)
    await pagina.getByRole('button', { name: 'PAUSAR' }).click()
    // Os 18 sons do treino (3 de preparo, 1 sino, ...) ainda estavam à frente no relógio do áudio: todos cortados.
    await expect.poll(() => pagina.evaluate(() => window.__audio.desligados)).toBe(18)
    const antes = (await oscs(pagina)).length
    await avancar(pagina, 30)
    await pagina.getByRole('button', { name: 'RETOMAR' }).click()
    // O treino parou nos 20 s: o aviso dos 10 s do round 1 (segundo 60) fica 40 s à frente, e o que já passou não volta.
    await expect.poll(async () => (await novos(pagina, antes)).slice(0, 4)).toEqual([avisoEm(40), ...contagemAte(50)])
    expect((await novos(pagina, antes)).every(t => t.t >= 40)).toBe(true)
  })

  test('mudo: o timer anda, mas nenhum som é gerado; ligar o som programa o que ainda falta', async ({ pagina }) => {
    await abrirTimer(pagina, { ...CONFIG_CURTA, preparo: false, mudo: true })
    await expect(pagina.getByRole('button', { name: 'Mudo' })).toHaveAttribute('aria-pressed', 'true')
    await pagina.getByRole('button', { name: 'INICIAR', exact: true }).click()
    await avancar(pagina, 70)
    await expect(fase(pagina)).toHaveAttribute('data-fase', 'descanso')
    expect(await oscs(pagina)).toEqual([])
    await pagina.getByRole('button', { name: 'Mudo' }).click()
    await expect(pagina.getByRole('button', { name: 'Mudo' })).toHaveAttribute('aria-pressed', 'false')
    // Só o que vem depois de desmutar (nos 70 s do treino): o do descanso (segundo 60) não toca atrasado.
    await expect.poll(() => oscs(pagina)).toEqual([
      ...contagemAte(20), ...sinoEm(20, BADALADAS_DE_INICIO), avisoEm(70), ...contagemAte(80), ...sinoEm(80, BADALADAS_DE_FIM_DO_TREINO),
    ])
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

test.describe('treino do plano: usa o mesmo agendamento de sons', () => {
  // O treino do plano toca sino e bipe de 880 Hz (lib/som.ts), sem o 3-2-1 no round; o aviso dos 10 s é a matraca (ruído, não oscilador).
  const SINO_DO_PLANO = [620, 1240, 1711, 3348, 5537]
  const tom = (t: number) => (f: number): Tom => ({ f, t })

  async function abrirTreino(pagina: Page) {
    await simularEstado(pagina, SEM_ASSINATURA_TESTE)
    await espionar(pagina)
    await pagina.clock.install({ time: AGORA })
    await pagina.goto('/treino?tipo=tec&rounds=2&min=1&descanso=10')
    await expect(pagina.getByRole('heading', { level: 1 })).toBeVisible()
    await pagina.clock.pauseAt(new Date(AGORA.getTime() + 10 * 60_000))
  }

  test('ao começar, o bipe do preparo e o sino do round 1 já ficam programados; pular a preparação toca o sino do round na hora', async ({ pagina }) => {
    await abrirTreino(pagina)
    await pagina.getByRole('button', { name: /Começar/ }).click()
    await expect.poll(async () => (await oscs(pagina)).slice(0, 8)).toEqual([
      ...[7, 8, 9].map(t => tom(t)(880)), ...SINO_DO_PLANO.map(tom(10)),
    ])
    const antes = (await oscs(pagina)).length
    await pagina.getByRole('button', { name: 'Pular para a próxima fase' }).click()
    // O sino do round 1 (segundo 10) agora entra já; os bipes do preparo que ficaram para trás foram cortados.
    await expect.poll(async () => (await novos(pagina, antes)).slice(0, 5)).toEqual(SINO_DO_PLANO.map(tom(0)))
    expect(await pagina.evaluate(() => window.__audio.desligados)).toBeGreaterThan(0)
  })
})

test.describe('timer: manter o som com a tela bloqueada', () => {
  const midia = (pagina: Page) => pagina.evaluate(() => ({
    plays: window.__midia.plays,
    detalhe: navigator.mediaSession.metadata?.artist ?? null,
    titulo: navigator.mediaSession.metadata?.title ?? null,
    estado: navigator.mediaSession.playbackState,
  }))

  test('vem desligado: nenhum áudio de mídia nem controle na tela de bloqueio', async ({ pagina }) => {
    await abrirTimer(pagina, { ...CONFIG_CURTA, preparo: false })
    await pagina.getByRole('button', { name: 'INICIAR', exact: true }).click()
    await expect.poll(async () => (await oscs(pagina)).length).toBeGreaterThan(0)
    expect(await midia(pagina)).toMatchObject({ plays: 0, detalhe: null, estado: 'none' })
  })

  test('a opção fica nos Ajustes, avisa do custo e é guardada neste aparelho', async ({ pagina }) => {
    await abrirTimer(pagina)
    await pagina.getByRole('button', { name: 'Ajustes' }).click()
    const painel = pagina.getByRole('dialog', { name: 'Configurações do timer' })
    const opcao = painel.getByRole('switch', { name: /Manter o som com a tela bloqueada/ })
    await expect(opcao).not.toBeChecked()
    await expect(painel.getByText(/pausar a música de outros apps/)).toBeVisible()
    await opcao.check()
    expect((await pagina.evaluate(() => JSON.parse(localStorage.getItem('corner:timer:config')!))).segundoPlano).toBe(true)
  })

  test('ligada: INICIAR toca o áudio inaudível e mostra o controle de mídia; os botões da tela de bloqueio pausam e retomam; encerrar tira tudo', async ({ pagina }) => {
    await abrirTimer(pagina, { ...CONFIG_CURTA, preparo: false, segundoPlano: true })
    await pagina.getByRole('button', { name: 'INICIAR', exact: true }).click()
    await expect.poll(() => midia(pagina)).toEqual({ plays: 1, titulo: 'Corner · Timer', detalhe: 'Round 1 de 2', estado: 'playing' })

    await pagina.evaluate(() => window.__midia.handlers.pause?.())
    await expect(pagina.getByRole('button', { name: 'RETOMAR' })).toBeVisible()
    await expect.poll(() => midia(pagina)).toMatchObject({ detalhe: 'Pausado · Round 1 de 2', estado: 'paused' })

    await pagina.evaluate(() => window.__midia.handlers.play?.())
    await expect(pagina.getByRole('button', { name: 'PAUSAR' })).toBeVisible()
    await expect.poll(() => midia(pagina)).toMatchObject({ detalhe: 'Round 1 de 2', estado: 'playing' })

    await pagina.getByRole('button', { name: 'Encerrar e ver o resumo' }).click()
    await expect(fase(pagina)).toHaveAttribute('data-fase', 'fim')
    await expect.poll(() => midia(pagina)).toMatchObject({ detalhe: null, estado: 'none' })
    expect(await pagina.evaluate(() => window.__midia.handlers.pause)).toBeNull()
  })

  test('o texto do controle acompanha a fase (descanso)', async ({ pagina }) => {
    await abrirTimer(pagina, { ...CONFIG_CURTA, preparo: false, segundoPlano: true })
    await pagina.getByRole('button', { name: 'INICIAR', exact: true }).click()
    await avancar(pagina, 61)
    await expect(fase(pagina)).toHaveAttribute('data-fase', 'descanso')
    await expect.poll(() => midia(pagina)).toMatchObject({ detalhe: 'Descanso · Round 1 de 2' })
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
