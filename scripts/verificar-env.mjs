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
const OPCIONAIS = ['AUTH_TEST_NAME']
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

/** @param {Record<string, string | undefined>} env */
export function verificarEnv(env) {
  const erros = []
  const avisos = []
  const valor = nome => (env[nome] ?? '').trim()

  for (const nome of OBRIGATORIAS) {
    if (!valor(nome)) erros.push(`${nome} não está definida`)
  }
  for (const nome of OPCIONAIS) {
    if (!valor(nome)) avisos.push(`${nome} não está definida (o app usa o nome padrão "Atleta")`)
  }

  if (valor('SESSION_SECRET') && valor('SESSION_SECRET').length < SEGREDO_MIN) {
    erros.push(`SESSION_SECRET é curta demais (mínimo ${SEGREDO_MIN} caracteres)`)
  }
  if (valor('AUTH_TEST_EMAIL') && !valor('AUTH_TEST_EMAIL').includes('@')) {
    erros.push('AUTH_TEST_EMAIL não parece um e-mail (falta o @)')
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
