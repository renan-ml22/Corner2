import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let instancia: SupabaseClient | null = null

const OPCOES = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }

function configuracao(): { url: string; chave: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  return url && chave ? { url, chave } : null
}

function criar(c: { url: string; chave: string }): SupabaseClient | null {
  try {
    return createClient(c.url, c.chave, OPCOES)
  } catch (e) {
    // Só o tipo do erro: a mensagem poderia citar a configuração.
    console.error(`[supabase] configuração inválida (${e instanceof Error ? e.name : 'erro'}): confira NEXT_PUBLIC_SUPABASE_URL.`)
    return null
  }
}

/**
 * Cliente COMPARTILHADO do Supabase, SÓ no servidor, para dados e para criar contas. Usa a chave secreta
 * (`service_role`), que ignora as regras de linha do banco: por isso ela nunca pode ir ao navegador, e é o servidor
 * (a partir da sessão do login) que decide de quem são os dados.
 *
 * NUNCA entre por ele (`signInWithPassword`): entrar guarda a sessão da pessoa no cliente, e todas as consultas
 * seguintes passam a rodar com o papel dela, e não com o da chave de serviço. Para entrar, use `criarClienteParaEntrar`.
 *
 * `null` quando falta a URL ou a chave: o app segue só com o armazenamento do aparelho, como antes do Supabase.
 */
export function getSupabase(): SupabaseClient | null {
  const c = configuracao()
  if (!c) return null
  if (!instancia) {
    const novo = criar(c)
    if (novo) instancia = proibirEntrada(novo)
  }
  return instancia
}

/** Tudo o que faria o cliente guardar a sessão de uma pessoa. */
const FORMAS_DE_ENTRAR = ['signInWithPassword', 'signInWithOtp', 'signInWithOAuth', 'signInWithIdToken', 'signInWithSSO', 'signInAnonymously', 'setSession', 'exchangeCodeForSession', 'verifyOtp'] as const

/**
 * O cliente compartilhado recusa qualquer forma de entrar: assim o erro (ficar com a sessão de uma pessoa e rodar todas
 * as consultas com o papel dela) não depende de ninguém lembrar da regra. Já aconteceu: o teste de fumaça contra o
 * Supabase real pegou o salvamento de dados falhando com "permission denied" logo depois de um login.
 */
function proibirEntrada(cliente: SupabaseClient): SupabaseClient {
  const auth = cliente.auth as unknown as Record<string, unknown>
  for (const nome of FORMAS_DE_ENTRAR) {
    auth[nome] = () => { throw new Error(`Não entre pelo cliente compartilhado do Supabase (${nome}): ele ficaria com a sessão da pessoa e as consultas passariam a rodar com o papel dela. Use criarClienteParaEntrar.`) }
  }
  return cliente
}

/**
 * Um cliente NOVO e descartável, só para conferir e-mail e senha de uma pessoa. Cada login recebe o seu, que é
 * jogado fora em seguida: assim a sessão de quem entrou nunca contamina o cliente compartilhado nem outras pessoas.
 */
export function criarClienteParaEntrar(): SupabaseClient | null {
  const c = configuracao()
  return c ? criar(c) : null
}
