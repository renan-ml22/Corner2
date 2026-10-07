import 'server-only'
import { scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>

export interface User {
  id: string
  email: string
  name: string
}

interface StoredUser extends User {
  passwordHash: string // "salt:hash", ambos em base64url
}

// Por enquanto só existe o usuário de teste, definido em .env.local.
// Quando houver banco de dados, troque esta função por uma consulta.
function loadUsers(): StoredUser[] {
  const { AUTH_TEST_EMAIL, AUTH_TEST_NAME, AUTH_TEST_PASSWORD_HASH } = process.env
  if (!AUTH_TEST_EMAIL || !AUTH_TEST_PASSWORD_HASH) {
    console.error('[auth] AUTH_TEST_EMAIL/AUTH_TEST_PASSWORD_HASH não definidos — nenhum usuário pode entrar. Configure as variáveis de ambiente (veja .env.local).')
    return []
  }
  return [{
    id: 'u_test',
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

export async function verifyCredentials(email: string, password: string): Promise<User | null> {
  const user = loadUsers().find(u => u.email === email.trim().toLowerCase())
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH)
  if (!user || !ok) return null
  return { id: user.id, email: user.email, name: user.name }
}

export function getUserById(id: string): User | null {
  const user = loadUsers().find(u => u.id === id)
  return user ? { id: user.id, email: user.email, name: user.name } : null
}
