import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * O que o treinador pode ler do banco sobre um aluno vinculado. Quem chama (aluno-dados.ts) já conferiu a ficha e
 * passa o id da CONTA do aluno que está na ficha; nada aqui vem do pedido. As colunas são uma lista de permitidos
 * escrita à mão: lesões, peso, check-ins, anotações e sparring ficam no banco. O que volta é "cru" (unknown) e
 * o serviço valida tudo antes de usar.
 */
export interface DadosDoAlunoBancoLike {
  /** Treinos da conta a partir de `desdeIso`, só com data, tipo, rounds, minutos por round, esforço e duração. */
  treinosRecentes(alunoId: string, desdeIso: string): Promise<unknown[]>
  plano(alunoId: string): Promise<unknown>
  /** O nível do perfil (`iniciante`, `intermediario` ou `avancado`). */
  nivel(alunoId: string): Promise<unknown>
  /** Só as entidades `quiz` e `foto` de `user_data`. */
  dados(alunoId: string): Promise<{ entity: string; value: unknown }[]>
}

/** Teto de linhas lidas: 30 dias de treino são poucas dezenas; isto só protege contra uma conta com lixo demais. */
const MAXIMO_DE_TREINOS = 500

const COLUNAS_DO_TREINO = 'date,type,rounds,round_min,rpe,duration_seconds'

function conferir(error: { message: string } | null, onde: string): void {
  if (error) throw new Error(`Supabase (${onde}): ${error.message}`)
}

export function criarDadosDoAlunoBancoSupabase(db: SupabaseClient): DadosDoAlunoBancoLike {
  return {
    async treinosRecentes(alunoId, desdeIso) {
      const { data, error } = await db.from('workouts').select(COLUNAS_DO_TREINO)
        .eq('user_id', alunoId).gte('date', desdeIso).order('date', { ascending: false }).limit(MAXIMO_DE_TREINOS)
      conferir(error, 'ler treinos do aluno')
      return (data ?? []) as unknown[]
    },

    async plano(alunoId) {
      const { data, error } = await db.from('active_plans').select('plan_id,started_at').eq('user_id', alunoId).maybeSingle()
      conferir(error, 'ler plano do aluno')
      return data ?? null
    },

    async nivel(alunoId) {
      const { data, error } = await db.from('profiles').select('level').eq('id', alunoId).maybeSingle()
      conferir(error, 'ler nível do aluno')
      return (data as { level?: unknown } | null)?.level ?? null
    },

    async dados(alunoId) {
      const { data, error } = await db.from('user_data').select('entity,value').eq('user_id', alunoId).in('entity', ['quiz', 'foto'])
      conferir(error, 'ler dados do aluno')
      return (data ?? []) as { entity: string; value: unknown }[]
    },
  }
}
