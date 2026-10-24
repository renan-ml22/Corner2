// Confere se as variáveis de ambiente de que o login depende existem e têm o formato certo.
// Imprime só os NOMES das variáveis, nunca os valores.
//
// Uso:  npm run verificar-env
// Lê o .env.local (se existir); variáveis já definidas no ambiente têm prioridade.
// Para conferir o que está na Vercel, compare os nomes lá com a lista impressa por este script.

import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const OBRIGATORIAS = ['SESSION_SECRET', 'AUTH_TEST_EMAIL', 'AUTH_TEST_PASSWORD_HASH']
const OPCIONAIS = ['AUTH_TEST_NAME', 'STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_POSTHOG_KEY', 'NEXT_PUBLIC_POSTHOG_HOST']
const SEGREDO_MIN = 32
const HASH_MIN_BYTES = 32
const BASE64URL = /^[A-Za-z0-9_-]+$/

/** Lê o texto de um arquivo .env: CHAVE=valor, ignorando comentários e linhas em branco. */
export function lerArquivoEnv(texto) {
  const env = {}
  for (const linha of texto.split(/\r?\n/)) {
    const l = linha.trim()
    if (!l || l.startsWith('#')) continue
    const i = l.indexOf('=')
    if (i < 1) continue
    let valor = l.slice(i + 1).trim()
    if (/^(".*"|'.*')$/.test(valor)) valor = valor.slice(1, -1)
    env[l.slice(0, i).trim()] = valor
  }
  return env
}

/**
 * Confere a chave SECRETA do Supabase sem nunca mostrar o valor. Devolve o problema em texto, ou `null` se estiver certa.
 * Aceita o formato novo (sb_secret_...) e o antigo (três partes, com o papel "service_role" dentro).
 */
function problemaDaChaveSupabase(chave, refDaUrl) {
  if (chave.startsWith('sb_publishable_')) return 'é a chave pública (publishable); use a secreta (sb_secret_...)'
  if (/^sb_secret_[A-Za-z0-9_-]{20,}$/.test(chave)) return null

  const formato = 'está mal formada (esperado a chave "service_role" inteira, em três partes separadas por ponto, sem espaços, aspas nem reticências; ou sb_secret_...)'
  const partes = chave.split('.')
  if (partes.length !== 3 || !partes.every(p => BASE64URL.test(p))) return formato

  let dados
  try { dados = JSON.parse(Buffer.from(partes[1], 'base64url').toString()) } catch { return formato }
  if (dados?.role === 'anon') return 'é a chave pública (anon), não a secreta: use a chave "service_role"'
  if (dados?.role !== 'service_role') return 'não é uma chave "service_role"'
  if (refDaUrl && dados.ref !== refDaUrl) return 'é de outro projeto: a referência dentro da chave não bate com a da URL'
  return null
}

/** @param {Record<string, string | undefined>} env */
export function verificarEnv(env) {
  const erros = []
  const avisos = []
  const valor = nome => (env[nome] ?? '').trim()

  for (const nome of OBRIGATORIAS) {
    if (!valor(nome)) erros.push(`${nome} não está definida`)
  }
  for (const nome of OPCIONAIS) {
    if (valor(nome)) continue
    avisos.push(
      nome === 'AUTH_TEST_NAME' ? `${nome} não está definida (o app usa o nome padrão "Atleta")`
        : nome.includes('SUPABASE') ? `${nome} não está definida (a conta na nuvem fica desligada: os dados ficam só no aparelho)`
          : nome.includes('POSTHOG') ? `${nome} não está definida (as métricas de produto ficam desligadas)`
          : `${nome} não está definida (o pagamento fica desativado)`,
    )
  }

  // Conta na nuvem (Supabase): opcional, mas as duas variáveis andam juntas e têm de estar certas.
  const urlSupabase = valor('NEXT_PUBLIC_SUPABASE_URL')
  const chaveSupabase = valor('SUPABASE_SERVICE_ROLE_KEY')
  let refDaUrl = null
  if (urlSupabase) {
    const m = /^https:\/\/([a-z0-9]{20})\.supabase\.co$/.exec(urlSupabase)
    if (m) refDaUrl = m[1]
    else erros.push('NEXT_PUBLIC_SUPABASE_URL está mal formada (esperado https://<20 letras e números minúsculos>.supabase.co, sem aspas nem caminho)')
  }
  if (urlSupabase && !chaveSupabase) erros.push('SUPABASE_SERVICE_ROLE_KEY não está definida (a URL sozinha não serve: defina as duas ou nenhuma)')
  if (chaveSupabase && !urlSupabase) erros.push('NEXT_PUBLIC_SUPABASE_URL não está definida (a chave sozinha não serve: defina as duas ou nenhuma)')
  if (chaveSupabase) {
    const problema = problemaDaChaveSupabase(chaveSupabase, refDaUrl)
    if (problema) erros.push(`SUPABASE_SERVICE_ROLE_KEY ${problema}`)
  }

  if (valor('SESSION_SECRET') && valor('SESSION_SECRET').length < SEGREDO_MIN) {
    erros.push(`SESSION_SECRET é curta demais (mínimo ${SEGREDO_MIN} caracteres)`)
  }
  if (valor('AUTH_TEST_EMAIL') && !valor('AUTH_TEST_EMAIL').includes('@')) {
    erros.push('AUTH_TEST_EMAIL não parece um e-mail (falta o @)')
  }

  // Pagamento: opcional (sem a chave secreta o app roda e o pagamento fica desativado), mas, se vier, tem de estar certa.
  if (valor('STRIPE_SECRET_KEY') && !/^(sk|rk)_(test|live)_[A-Za-z0-9]{16,}$/.test(valor('STRIPE_SECRET_KEY'))) {
    erros.push('STRIPE_SECRET_KEY está mal formada (esperado sk_test_... ou sk_live_..., sem aspas)')
  }
  if (valor('STRIPE_PUBLISHABLE_KEY') && !/^pk_(test|live)_[A-Za-z0-9]{16,}$/.test(valor('STRIPE_PUBLISHABLE_KEY'))) {
    erros.push('STRIPE_PUBLISHABLE_KEY está mal formada (esperado pk_test_... ou pk_live_...)')
  }

  // Métricas (PostHog): opcionais. A chave do PROJETO (phc_) é pública e vai para o navegador; a pessoal (phx_) e a secreta
  // do projeto (phs_) dão acesso à conta e jamais podem ser colocadas numa variável NEXT_PUBLIC_.
  const chavePostHog = valor('NEXT_PUBLIC_POSTHOG_KEY')
  if (chavePostHog) {
    if (/^ph[xs]_/.test(chavePostHog)) erros.push('NEXT_PUBLIC_POSTHOG_KEY é uma chave pessoal ou secreta (phx_/phs_), e esta variável vai para o navegador de todo mundo: use a chave do projeto, que começa com phc_')
    else if (!/^phc_[A-Za-z0-9]{20,}$/.test(chavePostHog)) erros.push('NEXT_PUBLIC_POSTHOG_KEY está mal formada (esperado a chave do projeto, phc_..., inteira, sem aspas, espaços nem reticências)')
  }
  const enderecoPostHog = valor('NEXT_PUBLIC_POSTHOG_HOST')
  if (enderecoPostHog && !/^https:\/\/[a-z0-9.-]+$/i.test(enderecoPostHog)) {
    erros.push('NEXT_PUBLIC_POSTHOG_HOST está mal formado (esperado https://us.i.posthog.com ou https://eu.i.posthog.com, sem aspas, caminho nem barra no fim)')
  }

  const hash = valor('AUTH_TEST_PASSWORD_HASH')
  if (hash) {
    const [sal, resumo, resto] = hash.split(':')
    if (!sal || !resumo || resto !== undefined || !BASE64URL.test(sal) || !BASE64URL.test(resumo)) {
      erros.push('AUTH_TEST_PASSWORD_HASH está mal formado (esperado "sal:hash" em base64url)')
    } else if (Buffer.from(resumo, 'base64url').length < HASH_MIN_BYTES) {
      erros.push(`AUTH_TEST_PASSWORD_HASH tem hash curto (menos de ${HASH_MIN_BYTES} bytes): a verificação da senha ficaria fraca`)
    }
  }

  return { ok: erros.length === 0, erros, avisos }
}

function principal() {
  const arquivo = path.resolve(process.cwd(), '.env.local')
  const doArquivo = existsSync(arquivo) ? lerArquivoEnv(readFileSync(arquivo, 'utf8')) : {}
  const env = { ...doArquivo, ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined)) }

  console.log(existsSync(arquivo) ? 'Lendo .env.local e o ambiente.' : 'Sem .env.local; lendo só o ambiente.')
  for (const nome of [...OBRIGATORIAS, ...OPCIONAIS]) {
    console.log(`  ${(env[nome] ?? '').trim() ? '✓' : '✗'} ${nome}`)
  }

  const { ok, erros, avisos } = verificarEnv(env)
  for (const a of avisos) console.warn(`aviso: ${a}`)
  for (const e of erros) console.error(`erro: ${e}`)
  if (!ok) {
    console.error('\nConfigure as variáveis (veja .env.local e, em produção, a Vercel) antes de publicar.')
    process.exit(1)
  }
  console.log('\nVariáveis de ambiente OK. Na Vercel, confira que estes mesmos nomes existem em Production.')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) principal()
