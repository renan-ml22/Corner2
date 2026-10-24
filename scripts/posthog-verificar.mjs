// Verifica as métricas de produto (PostHog) SEM mandar nada para o PostHog de verdade.
//
// Uso:  npm run posthog:verificar        (leva alguns minutos: faz um build do app com uma chave de MENTIRA)
//
// O que faz: constrói o app com uma chave falsa do PostHog, sobe o servidor, dirige o app num Chrome e INTERCEPTA a rede
// para o PostHog. Então confere, evento por evento, o que sairia do navegador: nomes, propriedades, endereços chamados,
// e que nada sensível (e-mail, nome, senha, query de URL, gravação de tela) vai junto.
//
// Atenção: o build fica com a chave falsa. Depois rode `npm run build` de novo antes de usar o app ou `npm run e2e` com CI=1.
// (Rodar `npm run e2e` sem CI já refaz o build sozinho.)

import { spawn, spawnSync } from 'node:child_process'
import { scryptSync } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'
import { chromium } from 'playwright-core'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORTA = 3110
const BASE = `http://localhost:${PORTA}`
const CHAVE_FALSA = 'phc_ChaveDeMentiraSoParaVerificarLocal0123456789'
const PERMITIDOS = new Set(['onboarding_started', 'onboarding_completed', 'workout_registered', 'plan_selected', 'sheet_opened', 'tab_changed', '$identify'])
// O usuário dos testes de navegador (mesmos valores de e2e/constantes.ts): nunca é o seu usuário real.
const E2E = { email: 'e2e@corner.test', senha: 'senha-de-teste-e2e', segredo: 'segredo-de-sessao-apenas-para-testes-e2e-0123456789', nome: 'Atleta de Teste' }

let falhas = 0
const confere = (nome, ok, detalhe = '') => { if (!ok) falhas++; console.log(`${ok ? 'PASSOU' : 'FALHOU'}  ${nome}${!ok && detalhe ? `  -> ${detalhe}` : ''}`) }
const esperar = async (fn, ms = 20000, passo = 400) => { const fim = Date.now() + ms; for (;;) { const v = await fn(); if (v) return v; if (Date.now() > fim) return null; await new Promise(r => setTimeout(r, passo)) } }
const pausa = ms => new Promise(r => setTimeout(r, ms))

const eventos = []   // tudo o que seria enviado
const caminhos = []  // endereços chamados no PostHog
const corpos = []    // texto bruto de cada envio

function decodificar(req) {
  const buf = req.postDataBuffer()
  if (!buf) return []
  let txt
  try { txt = buf[0] === 0x1f && buf[1] === 0x8b ? zlib.gunzipSync(buf).toString() : buf.toString() } catch { txt = buf.toString() }
  if (txt.startsWith('data=')) txt = Buffer.from(decodeURIComponent(txt.slice(5)), 'base64').toString()
  corpos.push(txt)
  try { const j = JSON.parse(txt); return Array.isArray(j) ? j : (j.batch ?? [j]) } catch { return [] }
}

async function principal() {
  console.log('Construindo o app com uma chave de mentira do PostHog (leva alguns minutos)...')
  const build = spawnSync('npm run build', { cwd: RAIZ, shell: true, stdio: 'ignore', env: { ...process.env, NEXT_PUBLIC_POSTHOG_KEY: CHAVE_FALSA, NEXT_PUBLIC_POSTHOG_HOST: '' } })
  if (build.status !== 0) { console.error('O build falhou.'); process.exit(1) }

  const sal = Buffer.alloc(16, 7)
  const hash = `${sal.toString('base64url')}:${scryptSync(E2E.senha, sal, 64).toString('base64url')}`
  const servidor = spawn(process.execPath, [path.join(RAIZ, 'node_modules/next/dist/bin/next'), 'start', '-p', String(PORTA)], {
    cwd: RAIZ,
    stdio: 'ignore',
    // Supabase e Stripe vazios: o `next start` leria as chaves reais do .env.local.
    env: { ...process.env, SESSION_SECRET: E2E.segredo, AUTH_TEST_EMAIL: E2E.email, AUTH_TEST_NAME: E2E.nome, AUTH_TEST_PASSWORD_HASH: hash, STRIPE_SECRET_KEY: '', STRIPE_PUBLISHABLE_KEY: '', NEXT_PUBLIC_SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' },
  })
  const nav = await chromium.launch({ channel: 'chrome', headless: true })
  try {
    const pronto = await esperar(async () => { try { return (await fetch(`${BASE}/login`)).ok } catch { return false } }, 60000, 1000)
    confere('servidor de teste subiu', !!pronto)

    // O posthog-js descarta eventos de navegador que parece robô (user agent "HeadlessChrome" e navigator.webdriver).
    // É o certo para visitantes reais; aqui disfarçamos só o necessário para o app poder ser verificado.
    const ctx = await nav.newContext({ viewport: { width: 420, height: 880 }, locale: 'pt-BR', serviceWorkers: 'block', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' })
    await ctx.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }))
    await ctx.route(u => new URL(u).hostname !== 'localhost', async rota => {
      const req = rota.request()
      if (/posthog/i.test(new URL(req.url()).hostname)) {
        caminhos.push(`${req.method()} ${new URL(req.url()).pathname}`)
        if (req.method() === 'POST') eventos.push(...decodificar(req))
        return rota.fulfill({ status: 200, contentType: 'application/json', body: '{"status":1}', headers: { 'access-control-allow-origin': '*' } })
      }
      return rota.fulfill({ status: 200, body: '', contentType: 'text/css', headers: { 'access-control-allow-origin': '*' } })
    })
    const p = await ctx.newPage()
    const erros = []
    p.on('pageerror', e => erros.push(`pageerror: ${e.message}`))
    p.on('console', m => { if (m.type() === 'error') erros.push(`console: ${m.text()}`) })

    const proprias = e => Object.fromEntries(Object.entries(e.properties ?? {}).filter(([k]) => !k.startsWith('$') && !['distinct_id', 'token', 'time'].includes(k)))
    const doTipo = nome => eventos.filter(e => e.event === nome)
    const enviar = () => pausa(4500) // o PostHog junta os eventos e envia em lotes (a cada ~3 s)

    // 1. Abrir o onboarding, sem estar logado
    await p.goto(`${BASE}/onboarding`)
    await enviar()
    const iniciado = doTipo('onboarding_started')
    confere('onboarding_started: enviado uma vez ao abrir /onboarding, sem propriedades próprias', iniciado.length === 1 && Object.keys(proprias(iniciado[0])).length === 0, `${iniciado.length}`)

    // 2. Login: identificar com o id
    await p.goto(`${BASE}/login`)
    await p.getByLabel('E-mail').fill(E2E.email)
    await p.getByLabel('Senha', { exact: true }).fill(E2E.senha)
    await p.getByRole('button', { name: /Entrar/ }).click()
    await p.waitForURL('**/hoje', { timeout: 60000 })
    await enviar()
    const ident = doTipo('$identify')
    confere('$identify: enviado depois do login, só com o id do usuário', ident.length >= 1 && ident.some(e => (e.properties?.distinct_id ?? e.distinct_id) === 'u_test'))

    // 3. Trocar de aba
    await p.getByRole('link', { name: 'Progresso' }).click()
    await p.waitForURL('**/progresso')
    await p.getByRole('link', { name: 'Progresso' }).click() // a mesma aba de novo: não é troca
    await enviar()
    const abas = doTipo('tab_changed')
    confere('tab_changed: { tab_name: "progresso" } uma vez (clicar na aba atual não conta)', abas.length === 1 && proprias(abas[0]).tab_name === 'progresso', JSON.stringify(abas.map(proprias)))

    // 4. Painéis e registro de treino (os três passos do registro contam como UM painel)
    await p.getByRole('link', { name: 'Hoje' }).click()
    await p.waitForURL('**/hoje')
    await p.getByRole('button', { name: /^Alertas/ }).click()
    await p.keyboard.press('Escape')
    await p.getByRole('button', { name: 'Registrar treino' }).click()
    await p.getByRole('button', { name: /Sparring/ }).click()
    await p.getByRole('button', { name: 'Salvar treino' }).click()
    await esperar(async () => (await p.getByText(/salvo/i).count()) > 0, 8000)
    await enviar()
    const paineis = doTipo('sheet_opened').map(e => proprias(e).sheet_name)
    confere('sheet_opened: "alertas" e "registro_treino", cada um uma vez', paineis.filter(n => n === 'alertas').length === 1 && paineis.filter(n => n === 'registro_treino').length === 1, JSON.stringify(paineis))
    const treino = doTipo('workout_registered')
    confere('workout_registered: uma vez, com tipo, rounds, rpe e duração (e só isso)', treino.length === 1 && JSON.stringify(Object.keys(proprias(treino[0])).sort()) === JSON.stringify(['duracao_segundos', 'rounds', 'rpe', 'tipo']) && proprias(treino[0]).tipo === 'spa', JSON.stringify(treino.map(proprias)))
    confere('workout_registered: nada do registro vaza (nota, parceiro, pancada)', !JSON.stringify(treino).match(/nota|parceiro|cabeca|sparring|intensidade/i))

    // 5. Onboarding logado: plano escolhido e onboarding concluído
    await p.goto(`${BASE}/onboarding/nivel`)
    await p.getByRole('radio', { name: /Intermediário/ }).click()
    await p.getByRole('button', { name: /Continuar/ }).click()
    await p.waitForURL('**/onboarding/frequencia')
    await p.getByRole('radio', { name: '4 dias por semana' }).click()
    await p.getByRole('button', { name: /Continuar/ }).click()
    await p.waitForURL('**/onboarding/plano')
    await p.getByRole('button', { name: /Começar agora/ }).click()
    await p.waitForURL('**/hoje', { timeout: 30000 })
    await enviar()
    const plano = doTipo('plan_selected')
    confere('plan_selected: { plano_id: "base-aerobica", nivel: "intermediario" }', plano.length === 1 && proprias(plano[0]).plano_id === 'base-aerobica' && proprias(plano[0]).nivel === 'intermediario', JSON.stringify(plano.map(proprias)))
    const concluido = doTipo('onboarding_completed')
    confere('onboarding_completed: { nivel, dias_por_semana: 4, plano_escolhido }', concluido.length === 1 && proprias(concluido[0]).nivel === 'intermediario' && proprias(concluido[0]).dias_por_semana === 4 && proprias(concluido[0]).plano_escolhido === 'base-aerobica', JSON.stringify(concluido.map(proprias)))

    // 6. Sair da conta
    await p.goto(`${BASE}/perfil`)
    await p.getByRole('button', { name: /Sair da conta/ }).click()
    await p.waitForURL('**/login')
    await enviar()

    // 7. O que NÃO pode acontecer, no total
    const nomes = [...new Set(eventos.map(e => e.event))]
    confere('só eventos da lista combinada (mais o $identify) saíram', nomes.every(n => PERMITIDOS.has(n)), JSON.stringify(nomes))
    confere('nenhum $pageview, $autocapture, $snapshot (gravação de tela), $exception ou clique', !nomes.some(n => /pageview|autocapture|snapshot|exception|click|rage|heatmap|web_vitals|pageleave/i.test(n)), JSON.stringify(nomes))
    const naoEnviar = caminhos.filter(c => !/^POST \/(i\/v0\/)?e\/?$/.test(c))
    confere('os únicos endereços chamados no PostHog são os de envio de eventos (nada de gravação, flags, config nem scripts)', naoEnviar.length === 0, JSON.stringify([...new Set(naoEnviar)]))
    const tudo = corpos.join('\n')
    confere('nenhum envio contém o e-mail, o nome do usuário ou a senha', !new RegExp(`${E2E.email.replace('.', '\\.')}|${E2E.nome}|${E2E.senha}`, 'i').test(tudo))
    confere('nenhuma propriedade tem cara de e-mail', !/"[^"]*":"[^"]*@[^"]*"/.test(tudo))
    const urls = eventos.flatMap(e => [e.properties?.$current_url, e.properties?.$referrer, e.properties?.$initial_referrer].filter(Boolean))
    confere('nenhuma URL enviada tem query ou hash', urls.every(u => !/[?#]/.test(u)), JSON.stringify(urls.filter(u => /[?#]/.test(u))))
    confere('nenhum evento carrega propriedades de pessoa ($set / $set_once)', eventos.every(e => !e.$set && !e.$set_once && !e.properties?.$set && !e.properties?.$set_once))
    confere('nenhum cookie do PostHog (guarda só no localStorage)', (await ctx.cookies()).every(c => !/ph_|posthog/i.test(c.name)))
    confere('nenhum erro de página nem de console', erros.length === 0, erros.slice(0, 3).join(' | '))
    console.log(`\n(resumo: ${eventos.length} eventos: ${JSON.stringify(Object.fromEntries(nomes.map(n => [n, doTipo(n).length])))})`)
    await ctx.close()
  } finally {
    await nav.close().catch(() => {})
    spawnSync('taskkill', ['/PID', String(servidor.pid), '/T', '/F'])
  }
  console.log(falhas === 0 ? '\nTudo certo. Rode "npm run build" de novo para tirar a chave de mentira do build.' : `\n${falhas} verificação(ões) falharam.`)
  process.exit(falhas === 0 ? 0 : 1)
}

principal().catch(e => { console.error('parou por erro:', e.message); process.exit(1) })
