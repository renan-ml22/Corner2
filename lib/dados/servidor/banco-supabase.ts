import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { BancoLike } from './servico'
import type { LinhaPerfil, LinhaPlano, LinhaTreino } from './mapeamento'

const COLUNAS_TREINO = 'id,date,type,rounds,round_min,rpe,duration_seconds,session_id,note,sparring_intensity,sparring_head,sparring_partner'

function conferir(error: { message: string } | null, onde: string): void {
  if (error) throw new Error(`Supabase (${onde}): ${error.message}`)
}

/**
 * `BancoLike` sobre o Supabase. Regra de ouro: TODA leitura e todo apagamento filtram pelo usuário, e toda gravação
 * grava o dono da linha. Os testes (tests/supabase-banco.test.ts) conferem isso para cada operação.
 */
export function criarBancoSupabase(db: SupabaseClient): BancoLike {
  const agora = () => new Date().toISOString()

  return {
    async lerTreinos(usuarioId) {
      const { data, error } = await db.from('workouts').select(COLUNAS_TREINO).eq('user_id', usuarioId).order('position', { ascending: true })
      conferir(error, 'ler treinos')
      return (data ?? []) as unknown as LinhaTreino[]
    },

    async substituirTreinos(usuarioId, linhas) {
      const { error } = await db.rpc('substituir_treinos', { p_user: usuarioId, p_linhas: linhas })
      conferir(error, 'gravar treinos')
    },

    async lerPlano(usuarioId) {
      const { data, error } = await db.from('active_plans').select('plan_id,started_at').eq('user_id', usuarioId).maybeSingle()
      conferir(error, 'ler plano')
      return (data ?? null) as LinhaPlano | null
    },

    async salvarPlano(usuarioId, linha) {
      if (linha === null) {
        const { error } = await db.from('active_plans').delete().eq('user_id', usuarioId)
        conferir(error, 'apagar plano')
        return
      }
      const { error } = await db.from('active_plans').upsert({ user_id: usuarioId, ...linha, updated_at: agora() }, { onConflict: 'user_id' })
      conferir(error, 'gravar plano')
    },

    async lerPerfil(usuarioId) {
      const { data, error } = await db.from('profiles').select('name,level,days_per_week,settings').eq('id', usuarioId).maybeSingle()
      conferir(error, 'ler perfil')
      return (data ?? null) as LinhaPerfil | null
    },

    async salvarPerfil(usuarioId, linha) {
      const { error } = await db.from('profiles').upsert({ id: usuarioId, ...linha, updated_at: agora() }, { onConflict: 'id' })
      conferir(error, 'gravar perfil')
    },

    async lerDados(usuarioId) {
      const { data, error } = await db.from('user_data').select('entity,value').eq('user_id', usuarioId)
      conferir(error, 'ler dados')
      return (data ?? []) as { entity: string; value: unknown }[]
    },

    async salvarDado(usuarioId, entity, value) {
      const { error } = await db.from('user_data').upsert({ user_id: usuarioId, entity, value, updated_at: agora() }, { onConflict: 'user_id,entity' })
      conferir(error, `gravar ${entity}`)
    },
  }
}
