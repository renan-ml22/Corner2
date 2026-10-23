import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ErroConta, criarConta, type AuthLike } from './contas'
import { validarCadastro, type CampoDoCadastro } from './onboarding'
import type { User } from './users'

export type ResultadoDoCadastro =
  | { tipo: 'criado'; usuario: User }
  /** Algum campo não passou na conferência: um texto por campo, para a tela mostrar ao lado dele. */
  | { tipo: 'erros'; erros: Partial<Record<CampoDoCadastro, string>> }
  /** A conta não foi criada por um motivo que a pessoa precisa saber (e-mail repetido, serviço com problema). */
  | { tipo: 'erro'; mensagem: string }
  /** Este ambiente não tem Supabase configurado. */
  | { tipo: 'indisponivel'; mensagem: string }

/**
 * Regra do cadastro, separada da ação do servidor para poder ser testada: confere os dados, cria a conta no Supabase
 * Auth e devolve o que aconteceu. Quem chama grava a sessão e redireciona.
 * Os dados inválidos são apontados mesmo com o cadastro desligado, para a tela mostrar o que corrigir.
 */
export async function cadastrar(
  bruto: Partial<Record<CampoDoCadastro, unknown>>,
  db: Pick<SupabaseClient, 'auth'> | null,
  emailsReservados: string[],
): Promise<ResultadoDoCadastro> {
  const conferido = validarCadastro(bruto)
  if (!conferido.ok) return { tipo: 'erros', erros: conferido.erros }
  if (!db) return { tipo: 'indisponivel', mensagem: 'O cadastro ainda não está disponível neste ambiente.' }

  try {
    return { tipo: 'criado', usuario: await criarConta(db.auth as unknown as AuthLike, conferido.valores, { emailsReservados }) }
  } catch (e) {
    if (e instanceof ErroConta) return { tipo: 'erro', mensagem: e.message }
    throw e
  }
}
