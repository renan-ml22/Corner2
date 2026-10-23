import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let instancia: SupabaseClient | null = null

/**
 * Cliente do Supabase, SÓ no servidor. Usa a chave secreta (`service_role`), que ignora as regras de linha do banco:
 * por isso ela nunca pode ir ao navegador, e é o servidor (a partir da sessão do login) que decide de quem são os dados.
 *
 * `null` quando falta a URL ou a chave: o app segue só com o armazenamento do aparelho, como antes do Supabase.
 */
export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !chave) return null
  if (instancia) return instancia
  try {
    instancia = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  } catch (e) {
    // Só o tipo do erro: a mensagem poderia citar a configuração.
    console.error(`[supabase] configuração inválida (${e instanceof Error ? e.name : 'erro'}): confira NEXT_PUBLIC_SUPABASE_URL.`)
    return null
  }
  return instancia
}
