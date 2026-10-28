import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Linha da tabela `coach_suggestions` (veja supabase/cornerman-etapa-4.sql), sem os ids do dono. */
export interface LinhaDeSugestao {
  id: string
  plano_id: string
  mensagem: string
  status: string
  created_at: string
  answered_at: string | null
}

/** O mesmo, com o treinador que sugeriu (para a tela do aluno mostrar o nome dele). */
export interface LinhaDaSugestaoDoAluno extends LinhaDeSugestao {
  coach_id: string
}

/** Tudo o que o serviço das sugestões precisa do banco (veja supabase/cornerman-etapa-4.sql). */
export interface SugestoesBancoLike {
  /**
   * Ficha com conta vinculada e ativa: troca a pendente por `substituida` e grava a nova como `pendente`, numa transação só.
   * Qualquer outra ficha: só grava `registrada`. Lança `Error` com `nao_encontrado` (ficha de outro treinador ou que não existe)
   * ou `ficha_encerrada`.
   */
  sugerir(coachId: string, alunoId: string, planoId: string, mensagem: string): Promise<'pendente' | 'registrada'>
  /** As 20 mais novas da ficha deste treinador, da mais nova para a mais antiga. */
  historico(coachId: string, alunoId: string): Promise<LinhaDeSugestao[]>
  /** As sugestões `pendente` e `aceita` do vínculo ATIVO desta conta, da mais nova para a mais antiga. */
  doAluno(alunoUserId: string): Promise<LinhaDaSugestaoDoAluno[]>
  /** Atômico: `true` só se a sugestão estava pendente e é do vínculo ativo desta conta. */
  responder(alunoUserId: string, id: string, aceitar: boolean): Promise<boolean>
  nomeDoTreinador(coachId: string): Promise<string | null>
}

/** Mensagens que as funções SQL levantam de propósito: passam adiante com o texto exato. */
const DO_SQL = ['nao_encontrado', 'ficha_encerrada'] as const

function conferir(error: { message: string } | null, onde: string): void {
  if (!error) return
  const conhecida = DO_SQL.find(m => error.message.includes(m))
  if (conhecida) throw new Error(conhecida)
  // Só o "onde" e o texto do Postgres: nunca o texto da mensagem do treinador.
  throw new Error(`Supabase (${onde}): ${error.message}`)
}

const COLUNAS = 'id,plano_id,mensagem,status,created_at,answered_at'

export function criarSugestoesBancoSupabase(db: SupabaseClient): SugestoesBancoLike {
  return {
    async sugerir(coachId, alunoId, planoId, mensagem) {
      const { data, error } = await db.rpc('sugerir_plano', { p_coach: coachId, p_aluno: alunoId, p_plano: planoId, p_mensagem: mensagem })
      conferir(error, 'sugerir plano')
      return data === 'pendente' ? 'pendente' : 'registrada'
    },

    async historico(coachId, alunoId) {
      const { data, error } = await db.from('coach_suggestions').select(COLUNAS)
        .eq('coach_id', coachId).eq('aluno_id', alunoId).order('created_at', { ascending: false }).limit(20)
      conferir(error, 'ler sugestões')
      return (data ?? []) as unknown as LinhaDeSugestao[]
    },

    async doAluno(alunoUserId) {
      const { data, error } = await db.rpc('sugestoes_do_aluno', { p_user: alunoUserId })
      conferir(error, 'ler sugestões do aluno')
      return (Array.isArray(data) ? data : []) as unknown as LinhaDaSugestaoDoAluno[]
    },

    async responder(alunoUserId, id, aceitar) {
      const { data, error } = await db.rpc('responder_sugestao', { p_user: alunoUserId, p_id: id, p_aceitar: aceitar })
      conferir(error, 'responder sugestão')
      return data === true
    },

    async nomeDoTreinador(coachId) {
      const { data, error } = await db.from('profiles').select('name').eq('id', coachId).maybeSingle()
      conferir(error, 'ler nome do treinador')
      const nome = (data as { name?: unknown } | null)?.name
      return typeof nome === 'string' && nome.trim() !== '' ? nome : null
    },
  }
}
