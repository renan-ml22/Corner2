import 'server-only'
import type { Cadastro } from './onboarding'
import type { User } from './users'

// Contas de usuário no Supabase Auth. O app continua usando a SUA sessão (cookie assinado, veja lib/session.ts):
// o Supabase só guarda e confere e-mail e senha. Quem chama passa `getSupabase()!.auth`.
//
// Segurança: a senha só passa por aqui para ser entregue ao Supabase; nunca vai para log, mensagem de erro nem resposta.

interface UsuarioDoSupabase { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null }
interface ErroDoSupabase { message: string; code?: string; status?: number }
type Resposta = { data: { user: UsuarioDoSupabase | null }; error: ErroDoSupabase | null }

/** O recorte do cliente do Supabase que usamos (o cliente real tem muito mais, e assim os testes usam um de mentira). */
export interface AuthLike {
  admin: {
    createUser(atributos: { email: string; password: string; email_confirm: boolean; user_metadata: { name: string } }): Promise<Resposta>
  }
  signInWithPassword(credenciais: { email: string; password: string }): Promise<Resposta>
}

export class ErroConta extends Error {
  constructor(readonly codigo: 'email_ja_cadastrado' | 'falha_ao_criar' | 'indisponivel', message: string, readonly status: number) {
    super(message)
    this.name = 'ErroConta'
  }
}

const emailJaCadastrado = () => new ErroConta('email_ja_cadastrado', 'Este e-mail já tem uma conta. Entre com a sua senha.', 409)
const falhaAoCriar = () => new ErroConta('falha_ao_criar', 'Não foi possível criar a conta agora. Tente novamente em instantes.', 502)
const indisponivel = () => new ErroConta('indisponivel', 'Não foi possível entrar agora. Tente novamente em instantes.', 503)

/** Registra só o status e o código: a mensagem do serviço pode citar o e-mail da pessoa. */
function registrar(onde: string, erro: unknown) {
  const e = (typeof erro === 'object' && erro !== null ? erro : {}) as Partial<ErroDoSupabase>
  console.error(`[contas] ${onde} (status ${e.status ?? '?'}, código ${e.code ?? '?'})`)
}

const jaExiste = (e: ErroDoSupabase) => e.code === 'email_exists' || e.code === 'user_already_exists' || /already (been )?registered/i.test(e.message)
const credenciaisInvalidas = (e: ErroDoSupabase) => e.code === 'invalid_credentials' || e.code === 'user_not_found' || (e.status === 400 && /invalid login credentials/i.test(e.message))

function paraUsuario(u: UsuarioDoSupabase, emailPadrao: string, nomePadrao?: string): User {
  const email = (u.email ?? emailPadrao).toLowerCase()
  const doSupabase = typeof u.user_metadata?.name === 'string' ? u.user_metadata.name.trim() : ''
  return { id: u.id, email, name: doSupabase || nomePadrao || email.split('@')[0] }
}

/**
 * Cria a conta já confirmada (sem e-mail de confirmação por enquanto) e devolve o usuário do app.
 * `emailsReservados`: e-mails que não podem virar conta (o usuário de teste do app), tratados como "já cadastrado".
 */
export async function criarConta(auth: AuthLike, cadastro: Cadastro, opcoes: { emailsReservados?: string[] } = {}): Promise<User> {
  if (opcoes.emailsReservados?.includes(cadastro.email)) throw emailJaCadastrado()

  let resposta: Resposta
  try {
    resposta = await auth.admin.createUser({ email: cadastro.email, password: cadastro.senha, email_confirm: true, user_metadata: { name: cadastro.nome } })
  } catch (e) {
    registrar('exceção ao criar conta', e)
    throw falhaAoCriar()
  }

  if (resposta.error) {
    if (jaExiste(resposta.error)) throw emailJaCadastrado()
    registrar('falha ao criar conta', resposta.error)
    throw falhaAoCriar()
  }
  if (!resposta.data.user) {
    registrar('o Supabase não devolveu o usuário criado', null)
    throw falhaAoCriar()
  }
  return paraUsuario(resposta.data.user, cadastro.email, cadastro.nome)
}

/**
 * Confere e-mail e senha no Supabase. `null` = e-mail ou senha incorretos (a mesma resposta nos dois casos).
 * Serviço fora do ar sobe como `ErroConta` de indisponibilidade: nunca vira "senha incorreta".
 */
export async function entrarNoSupabase(auth: AuthLike, email: string, senha: string): Promise<User | null> {
  let resposta: Resposta
  try {
    resposta = await auth.signInWithPassword({ email, password: senha })
  } catch (e) {
    registrar('exceção ao entrar', e)
    throw indisponivel()
  }

  if (resposta.error) {
    if (credenciaisInvalidas(resposta.error)) return null
    registrar('falha ao entrar', resposta.error)
    throw indisponivel()
  }
  return resposta.data.user ? paraUsuario(resposta.data.user, email) : null
}
