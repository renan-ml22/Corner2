import 'server-only'
import { scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { entrarNoSupabase, type AuthLike } from './contas'
import { criarClienteParaEntrar, getSupabase } from './supabase'

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>

export interface User {
  id: string
  email: string
  name: string
}

interface StoredUser extends User {
  passwordHash: string // "salt:hash", ambos em base64url
}

/** Id do usuário de teste, definido pelas variáveis de ambiente. As contas do Supabase têm id uuid, então nunca colidem. */
const ID_DO_USUARIO_DE_TESTE = 'u_test'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// O usuário de teste vem de .env.local (e da Vercel). As demais contas ficam no Supabase Auth (veja lib/contas.ts).
function loadUsers(): StoredUser[] {
  const { AUTH_TEST_EMAIL, AUTH_TEST_NAME, AUTH_TEST_PASSWORD_HASH } = process.env
  if (!AUTH_TEST_EMAIL || !AUTH_TEST_PASSWORD_HASH) {
    // Com o Supabase ligado, não ter usuário de teste é normal: as contas moram lá.
    if (!getSupabase()) console.error('[auth] AUTH_TEST_EMAIL/AUTH_TEST_PASSWORD_HASH não definidos — nenhum usuário pode entrar. Configure as variáveis de ambiente (veja .env.local).')
    return []
  }
  return [{
    id: ID_DO_USUARIO_DE_TESTE,
    email: AUTH_TEST_EMAIL.trim().toLowerCase(),
    name: AUTH_TEST_NAME || 'Atleta',
    passwordHash: AUTH_TEST_PASSWORD_HASH,
  }]
}

// Hash descartável para que e-mails inexistentes levem o mesmo tempo que senhas erradas.
const DUMMY_HASH = 'AAAAAAAAAAAAAAAAAAAAAA:' + 'A'.repeat(86)

async function verifyPassword(password: string, stored: string) {
  const [saltB64, hashB64] = stored.split(':')
  if (!saltB64 || !hashB64) return false
  const expected = Buffer.from(hashB64, 'base64url')
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64url'), expected.length || 64)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

const semSegredo = ({ id, email, name }: StoredUser): User => ({ id, email, name })

/**
 * Confere e-mail e senha. O usuário de teste é conferido só pelo hash do ambiente (nunca vai ao Supabase);
 * qualquer outro e-mail é conferido no Supabase Auth, se estiver ligado. `null` = e-mail ou senha incorretos.
 * Pode lançar `ErroConta` (código `indisponivel`) quando o Supabase não responde: isso não é "senha incorreta".
 */
export async function verifyCredentials(email: string, password: string): Promise<User | null> {
  const normalizado = email.trim().toLowerCase()
  const teste = loadUsers().find(u => u.email === normalizado)
  if (teste) {
    return (await verifyPassword(password, teste.passwordHash)) ? semSegredo(teste) : null
  }

  // Cliente próprio de cada login: entrar guarda a sessão da pessoa no cliente, que não pode ser o compartilhado.
  const paraEntrar = criarClienteParaEntrar()
  if (paraEntrar) return entrarNoSupabase(paraEntrar.auth as unknown as AuthLike, normalizado, password)

  await verifyPassword(password, DUMMY_HASH) // mesmo tempo de uma senha errada
  return null
}

export function getUserById(id: string): User | null {
  const user = loadUsers().find(u => u.id === id)
  return user ? semSegredo(user) : null
}

/**
 * O usuário logado, a partir da sessão (cookie assinado, então ninguém forja o conteúdo):
 * o usuário de teste vem do ambiente; uma conta do Supabase vem do e-mail e do nome gravados na sessão ao entrar.
 * Sessão incompleta ou com id estranho vale como "não logado".
 */
export function usuarioDaSessao(sessao: { userId?: unknown; email?: unknown; nome?: unknown; [campo: string]: unknown } | null): User | null {
  if (!sessao || typeof sessao.userId !== 'string') return null
  if (sessao.userId === ID_DO_USUARIO_DE_TESTE) return getUserById(sessao.userId)
  if (!UUID.test(sessao.userId)) return null

  const { email, nome } = sessao
  if (typeof email !== 'string' || !email.includes('@') || typeof nome !== 'string' || nome.trim() === '') return null
  return { id: sessao.userId.toLowerCase(), email, name: nome }
}
