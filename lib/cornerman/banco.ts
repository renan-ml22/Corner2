import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { DadosDaFicha } from './ficha'

/** Linha da tabela `coach_alunos` (veja supabase/cornerman-etapa-2.sql). Nunca sai do servidor como está. */
export interface LinhaDeAluno {
  id: string
  coach_id: string
  nome: string
  email: string | null
  telefone: string | null
  nivel: string | null
  estilo: string | null
  notas: string
  foto: string
  aluno_user_id: string | null
  status: string
  created_at: string
  updated_at: string
}

/** Tudo o que o serviço precisa do banco. TODA operação recebe o treinador: é o que isola as fichas de cada um. */
export interface AlunosBancoLike {
  listar(coachId: string): Promise<LinhaDeAluno[]>
  obter(coachId: string, id: string): Promise<LinhaDeAluno | null>
  /** Lança `Error('limite_de_alunos')` quando o gatilho do banco recusa a 21ª ficha. */
  inserir(coachId: string, dados: DadosDaFicha): Promise<LinhaDeAluno>
  /** `null` quando não há ficha com esse id deste treinador. Lança `Error('limite_de_alunos')` ao reabrir com 20 ativas. */
  atualizar(coachId: string, id: string, campos: Record<string, unknown>): Promise<LinhaDeAluno | null>
  /** `true` se apagou uma ficha deste treinador. */
  apagar(coachId: string, id: string): Promise<boolean>
}

const COLUNAS = 'id,coach_id,nome,email,telefone,nivel,estilo,notas,foto,aluno_user_id,status,created_at,updated_at'

/** O gatilho do SQL levanta `limite_de_alunos`; qualquer outro erro vira uma mensagem sem dados da ficha. */
function conferir(error: { message: string } | null, onde: string): void {
  if (!error) return
  if (error.message.includes('limite_de_alunos')) throw new Error('limite_de_alunos')
  throw new Error(`Supabase (${onde}): ${error.message}`)
}

export function criarAlunosBancoSupabase(db: SupabaseClient): AlunosBancoLike {
  const tabela = () => db.from('coach_alunos')

  return {
    async listar(coachId) {
      const { data, error } = await tabela().select(COLUNAS).eq('coach_id', coachId)
      conferir(error, 'ler alunos')
      return (data ?? []) as unknown as LinhaDeAluno[]
    },

    async obter(coachId, id) {
      const { data, error } = await tabela().select(COLUNAS).eq('coach_id', coachId).eq('id', id).maybeSingle()
      conferir(error, 'ler aluno')
      return (data ?? null) as unknown as LinhaDeAluno | null
    },

    async inserir(coachId, dados) {
      // O dono vem do argumento e vai por último: nada dentro de `dados` pode trocá-lo.
      const { data, error } = await tabela().insert({ ...dados, coach_id: coachId }).select(COLUNAS).single()
      conferir(error, 'gravar aluno')
      return data as unknown as LinhaDeAluno
    },

    async atualizar(coachId, id, campos) {
      const { data, error } = await tabela()
        .update({ ...campos, updated_at: new Date().toISOString() })
        .eq('coach_id', coachId).eq('id', id)
        .select(COLUNAS).maybeSingle()
      conferir(error, 'atualizar aluno')
      return (data ?? null) as unknown as LinhaDeAluno | null
    },

    async apagar(coachId, id) {
      const { data, error } = await tabela().delete().eq('coach_id', coachId).eq('id', id).select('id')
      conferir(error, 'apagar aluno')
      return (data ?? []).length > 0
    },
  }
}
