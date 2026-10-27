import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { criarDadosDoAlunoBancoSupabase } from '@/lib/cornerman/aluno-dados-banco'

interface Chamada { tabela: string; filtros: [string, string, unknown][]; colunas?: string; ordem?: string; limite?: number }

/** Cliente do Supabase de mentira: registra cada pedido e devolve o resultado programado. */
class ClienteFalso {
  chamadas: Chamada[] = []
  resultado: { data?: unknown; error?: { message: string } | null } = { data: [], error: null }

  from(tabela: string) {
    const chamada: Chamada = { tabela, filtros: [] }
    this.chamadas.push(chamada)
    const resultado = () => Promise.resolve({ data: null, error: null, ...this.resultado })
    const c: Record<string, unknown> = {
      select: (colunas: string) => { chamada.colunas = colunas; return c },
      eq: (col: string, v: unknown) => { chamada.filtros.push([col, 'eq', v]); return c },
      gte: (col: string, v: unknown) => { chamada.filtros.push([col, 'gte', v]); return c },
      in: (col: string, v: unknown) => { chamada.filtros.push([col, 'in', v]); return c },
      order: (col: string) => { chamada.ordem = col; return c },
      limit: (n: number) => { chamada.limite = n; return c },
      maybeSingle: () => resultado(),
      then: (ok: (v: unknown) => unknown, falha: (e: unknown) => unknown) => resultado().then(ok, falha),
    }
    return c
  }
}

const ALUNO = 'u_aluno'
const montar = () => {
  const falso = new ClienteFalso()
  return { falso, banco: criarDadosDoAlunoBancoSupabase(falso as never) }
}

describe('o banco do aluno só seleciona colunas permitidas e sempre filtra pela conta do aluno', () => {
  it('treinos: só data, tipo, rounds, minutos, esforço e duração; da conta, a partir da data, os mais novos primeiro, com teto', async () => {
    const { falso, banco } = montar()
    falso.resultado = { data: [{ date: 'x' }] }
    expect(await banco.treinosRecentes(ALUNO, '2026-09-27T15:00:00.000Z')).toEqual([{ date: 'x' }])
    expect(falso.chamadas[0]).toMatchObject({
      tabela: 'workouts',
      colunas: 'date,type,rounds,round_min,rpe,duration_seconds',
      filtros: [['user_id', 'eq', ALUNO], ['date', 'gte', '2026-09-27T15:00:00.000Z']],
      ordem: 'date',
    })
    expect(falso.chamadas[0].limite).toBeGreaterThanOrEqual(100)
    expect(falso.chamadas[0].colunas).not.toMatch(/note|sparring|session|\*/)
  })

  it('plano: plan_id e started_at da conta; sem plano, null', async () => {
    const { falso, banco } = montar()
    falso.resultado = { data: { plan_id: 'fundamentos', started_at: '2026-10-12' } }
    expect(await banco.plano(ALUNO)).toEqual({ plan_id: 'fundamentos', started_at: '2026-10-12' })
    falso.resultado = { data: null }
    expect(await banco.plano(ALUNO)).toBeNull()
    expect(falso.chamadas[0]).toMatchObject({ tabela: 'active_plans', colunas: 'plan_id,started_at', filtros: [['user_id', 'eq', ALUNO]] })
  })

  it('nível: só a coluna level do perfil da conta; sem perfil, null', async () => {
    const { falso, banco } = montar()
    falso.resultado = { data: { level: 'avancado' } }
    expect(await banco.nivel(ALUNO)).toBe('avancado')
    falso.resultado = { data: null }
    expect(await banco.nivel(ALUNO)).toBeNull()
    expect(falso.chamadas[0]).toMatchObject({ tabela: 'profiles', colunas: 'level', filtros: [['id', 'eq', ALUNO]] })
  })

  it('dados: só as entidades quiz e foto da conta (lesões, peso e check-ins ficam no banco)', async () => {
    const { falso, banco } = montar()
    falso.resultado = { data: [{ entity: 'quiz', value: '00020' }] }
    expect(await banco.dados(ALUNO)).toEqual([{ entity: 'quiz', value: '00020' }])
    expect(falso.chamadas[0]).toMatchObject({ tabela: 'user_data', colunas: 'entity,value', filtros: [['user_id', 'eq', ALUNO], ['entity', 'in', ['quiz', 'foto']]] })
  })

  it('sem dados, listas vazias', async () => {
    const { falso, banco } = montar()
    falso.resultado = { data: null }
    expect(await banco.treinosRecentes(ALUNO, '2026-09-27T15:00:00.000Z')).toEqual([])
    expect(await banco.dados(ALUNO)).toEqual([])
  })

  it('erro do banco: sobe só "Supabase (onde)" e o texto do Postgres, sem dados de ninguém', async () => {
    const { falso, banco } = montar()
    falso.resultado = { error: { message: 'connection reset' } }
    await expect(banco.treinosRecentes(ALUNO, 'x')).rejects.toThrow('Supabase (ler treinos do aluno): connection reset')
    await expect(banco.plano(ALUNO)).rejects.toThrow('Supabase (ler plano do aluno)')
    await expect(banco.nivel(ALUNO)).rejects.toThrow('Supabase (ler nível do aluno)')
    await expect(banco.dados(ALUNO)).rejects.toThrow('Supabase (ler dados do aluno)')
  })
})
