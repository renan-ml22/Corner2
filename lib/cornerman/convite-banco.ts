import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Tudo o que o serviço do convite precisa do banco (veja supabase/cornerman-etapa-3a.sql). */
export interface ConvitesBancoLike {
  /** Cria o convite da ficha (apaga os anteriores não usados) e a põe em "convidado", numa transação só. */
  criarConvite(coachId: string, alunoId: string, hash: string, expiraEm: string): Promise<void>
  /** `true` se havia convite pendente da ficha deste treinador; a ficha volta a "ativo". */
  cancelarConvite(coachId: string, alunoId: string): Promise<boolean>
  /** O convite não usado da ficha (mesmo expirado), para a tela do treinador. */
  convitePendente(coachId: string, alunoId: string): Promise<{ expiraEm: string } | null>
  /** Só se o convite existe, não foi usado e não expirou. */
  consultarConvite(hash: string): Promise<{ coachId: string; nomeDoTreinador: string | null } | null>
  /** Atômico e de uso único. Lança `Error` com `convite_invalido`, `proprio_convite` ou `ja_tem_treinador`. */
  aceitarConvite(hash: string, alunoUserId: string): Promise<{ coachId: string }>
  /** Encerra as fichas ligadas a esta conta e limpa o vínculo. Devolve quantas. */
  desvincular(alunoUserId: string): Promise<number>
  treinadorDoAluno(alunoUserId: string): Promise<{ nome: string | null } | null>
}

/** Mensagens que as funções SQL levantam de propósito: passam adiante com o texto exato. */
const DO_SQL = ['limite_de_alunos', 'nao_convidavel', 'nao_encontrado', 'convite_invalido', 'proprio_convite', 'ja_tem_treinador'] as const

function conferir(error: { message: string } | null, onde: string): void {
  if (!error) return
  const conhecida = DO_SQL.find(m => error.message.includes(m))
  if (conhecida) throw new Error(conhecida)
  // Só o "onde" e o texto do Postgres: nunca o hash, o token nem dados de ninguém.
  throw new Error(`Supabase (${onde}): ${error.message}`)
}

export function criarConvitesBancoSupabase(db: SupabaseClient): ConvitesBancoLike {
  const nomeDe = async (usuarioId: string, onde: string): Promise<string | null> => {
    const { data, error } = await db.from('profiles').select('name').eq('id', usuarioId).maybeSingle()
    conferir(error, onde)
    const nome = (data as { name?: unknown } | null)?.name
    return typeof nome === 'string' && nome.trim() !== '' ? nome : null
  }

  return {
    async criarConvite(coachId, alunoId, hash, expiraEm) {
      const { error } = await db.rpc('criar_convite', { p_coach: coachId, p_aluno: alunoId, p_hash: hash, p_expira: expiraEm })
      conferir(error, 'criar convite')
    },

    async cancelarConvite(coachId, alunoId) {
      const { data, error } = await db.rpc('cancelar_convite', { p_coach: coachId, p_aluno: alunoId })
      conferir(error, 'cancelar convite')
      return data === true
    },

    async convitePendente(coachId, alunoId) {
      const { data, error } = await db.from('coach_invites').select('expires_at')
        .eq('coach_id', coachId).eq('aluno_id', alunoId).is('used_at', null)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      conferir(error, 'ler convite')
      const quando = (data as { expires_at?: unknown } | null)?.expires_at
      return typeof quando === 'string' ? { expiraEm: new Date(quando).toISOString() } : null
    },

    async consultarConvite(hash) {
      const { data, error } = await db.from('coach_invites').select('coach_id')
        .eq('token_hash', hash).is('used_at', null).gt('expires_at', new Date().toISOString()).maybeSingle()
      conferir(error, 'consultar convite')
      const coachId = (data as { coach_id?: unknown } | null)?.coach_id
      if (typeof coachId !== 'string') return null
      return { coachId, nomeDoTreinador: await nomeDe(coachId, 'consultar convite') }
    },

    async aceitarConvite(hash, alunoUserId) {
      const { data, error } = await db.rpc('aceitar_convite', { p_hash: hash, p_user: alunoUserId })
      conferir(error, 'aceitar convite')
      if (typeof data !== 'string' || data === '') throw new Error('convite_invalido')
      return { coachId: data }
    },

    async desvincular(alunoUserId) {
      const { data, error } = await db.rpc('desvincular_aluno', { p_user: alunoUserId })
      conferir(error, 'desvincular')
      return typeof data === 'number' ? data : 0
    },

    async treinadorDoAluno(alunoUserId) {
      const { data, error } = await db.from('coach_alunos').select('coach_id')
        .eq('aluno_user_id', alunoUserId).neq('status', 'encerrado').maybeSingle()
      conferir(error, 'ler treinador')
      const coachId = (data as { coach_id?: unknown } | null)?.coach_id
      if (typeof coachId !== 'string') return null
      return { nome: await nomeDe(coachId, 'ler treinador') }
    },
  }
}
