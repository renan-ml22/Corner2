import 'server-only'
import { createHash, randomBytes } from 'node:crypto'

/** SHA-256 do token em hex minúsculo: é o que o banco guarda (o token em si nunca é gravado). */
export const hashDoToken = (token: string): string => createHash('sha256').update(token).digest('hex')

/** Token novo (32 bytes aleatórios em base64url, 43 caracteres) e o hash que vai para o banco. */
export function novoToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashDoToken(token) }
}
