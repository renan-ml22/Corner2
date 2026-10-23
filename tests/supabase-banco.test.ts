import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { criarBancoSupabase } from '@/lib/dados/servidor/banco-supabase'
import { getSupabase } from '@/lib/supabase'

interface Chamada { tabela: string; operacao: string; args: unknown[]; filtros: [string, unknown][]; ordem?: [string, unknown] }

/** Cliente do Supabase de mentira: registra cada pedido e devolve o resultado programado. */
class ClienteFalso {
  chamadas: Chamada[] = []
  resultado: { data?: unknown; error?: { message: string } | null } = { data: [], error: null }

  from(tabela: string) {
    const chamada: Chamada = { tabela, operacao: '', args: [], filtros: [] }
    this.chamadas.push(chamada)
    const resultado = () => Promise.resolve({ data: null, error: null, ...this.resultado })
    const construtor: Record<string, unknown> = {
      select: (...args: unknown[]) => { chamada.operacao ||= 'select'; chamada.args = args; return construtor },
      eq: (coluna: string, valor: unknown) => { chamada.filtros.push([coluna, valor]); return construtor },
      order: (coluna: string, opcoes: unknown) => { chamada.ordem = [coluna, opcoes]; return construtor },
      upsert: (...args: unknown[]) => { chamada.operacao = 'upsert'; chamada.args = args; return resultado() },
      delete: () => { chamada.operacao = 'delete'; return construtor },
      maybeSingle: () => resultado(),
      then: (ok: (v: unknown) => unknown, falha: (e: unknown) => unknown) => resultado().then(ok, falha),
    }
    return construtor
  }

  rpc(nome: string, args: unknown) {
    this.chamadas.push({ tabela: `rpc:${nome}`, operacao: 'rpc', args: [args], filtros: [] })
    return Promise.resolve({ data: null, error: null, ...this.resultado })
  }
}

const USUARIO = 'u_test'
const linhaTreino = { id: 'a', date: '2026-10-10T12:00:00.000Z', type: 'tec', rounds: 5, round_min: 3, rpe: 6, duration_seconds: 900, session_id: null, note: null, sparring_intensity: null, sparring_head: null, sparring_partner: null }

function montar() {
  const falso = new ClienteFalso()
  return { falso, banco: criarBancoSupabase(falso as never) }
}

describe('leitura', () => {
  it('treinos: tabela workouts, só do usuário, na ordem da lista do app', async () => {
    const { falso, banco } = montar()
    falso.resultado = { data: [linhaTreino] }
    expect(await banco.lerTreinos(USUARIO)).toEqual([linhaTreino])
    expect(falso.chamadas[0]).toMatchObject({ tabela: 'workouts', operacao: 'select', filtros: [['user_id', USUARIO]], ordem: ['position', { ascending: true }] })
  })

  it('treinos: sem dados vira lista vazia', async () => {
    const { falso, banco } = montar()
    falso.resultado = { data: null }
    expect(await banco.lerTreinos(USUARIO)).toEqual([])
  })

  it('plano e perfil: uma linha ou null', async () => {
    const { falso, banco } = montar()
    falso.resultado = { data: { plan_id: 'fundamentos', started_at: '2026-10-12' } }
    expect(await banco.lerPlano(USUARIO)).toEqual({ plan_id: 'fundamentos', started_at: '2026-10-12' })
    falso.resultado = { data: null }
    expect(await banco.lerPlano(USUARIO)).toBeNull()
    expect(await banco.lerPerfil(USUARIO)).toBeNull()
    expect(falso.chamadas.map(c => [c.tabela, c.filtros])).toEqual([
      ['active_plans', [['user_id', USUARIO]]], ['active_plans', [['user_id', USUARIO]]], ['profiles', [['id', USUARIO]]],
    ])
  })

  it('demais dados: lista de { entity, value } do usuário', async () => {
    const { falso, banco } = montar()
    falso.resultado = { data: [{ entity: 'pesos', value: [] }] }
    expect(await banco.lerDados(USUARIO)).toEqual([{ entity: 'pesos', value: [] }])
    expect(falso.chamadas[0]).toMatchObject({ tabela: 'user_data', filtros: [['user_id', USUARIO]] })
  })
})

describe('gravação', () => {
  it('treinos: uma chamada à função substituir_treinos, com o usuário e a lista', async () => {
    const { falso, banco } = montar()
    await banco.substituirTreinos(USUARIO, [linhaTreino])
    expect(falso.chamadas).toEqual([{ tabela: 'rpc:substituir_treinos', operacao: 'rpc', args: [{ p_user: USUARIO, p_linhas: [linhaTreino] }], filtros: [] }])
  })

  it('plano: upsert por user_id; null apaga só o plano deste usuário', async () => {
    const { falso, banco } = montar()
    await banco.salvarPlano(USUARIO, { plan_id: 'fundamentos', started_at: '2026-10-12' })
    await banco.salvarPlano(USUARIO, null)
    expect(falso.chamadas[0]).toMatchObject({ tabela: 'active_plans', operacao: 'upsert' })
    expect(falso.chamadas[0].args[0]).toMatchObject({ user_id: USUARIO, plan_id: 'fundamentos', started_at: '2026-10-12' })
    expect(falso.chamadas[0].args[1]).toEqual({ onConflict: 'user_id' })
    expect(falso.chamadas[1]).toMatchObject({ tabela: 'active_plans', operacao: 'delete', filtros: [['user_id', USUARIO]] })
  })

  it('perfil: upsert com o id do usuário e o nome', async () => {
    const { falso, banco } = montar()
    await banco.salvarPerfil(USUARIO, { name: 'Renan', level: '1a3', days_per_week: 4, settings: { metaSemanal: 4 } })
    expect(falso.chamadas[0].args[0]).toMatchObject({ id: USUARIO, name: 'Renan', level: '1a3', days_per_week: 4, settings: { metaSemanal: 4 } })
    expect(falso.chamadas[0].args[1]).toEqual({ onConflict: 'id' })
  })

  it('demais dados: upsert por (user_id, entity)', async () => {
    const { falso, banco } = montar()
    await banco.salvarDado(USUARIO, 'pesos', [{ id: 'p', data: '2026-10-13', kg: 66 }])
    expect(falso.chamadas[0].args[0]).toMatchObject({ user_id: USUARIO, entity: 'pesos' })
    expect(falso.chamadas[0].args[1]).toEqual({ onConflict: 'user_id,entity' })
  })
})

describe('isolamento entre usuários', () => {
  it('toda leitura e todo apagamento filtram pelo usuário; toda gravação grava o dono da linha', async () => {
    const { falso, banco } = montar()
    falso.resultado = { data: [] }
    await banco.lerTreinos(USUARIO); await banco.lerPlano(USUARIO); await banco.lerPerfil(USUARIO); await banco.lerDados(USUARIO)
    await banco.salvarPlano(USUARIO, null)
    await banco.salvarPlano(USUARIO, { plan_id: 'fundamentos', started_at: '2026-10-12' })
    await banco.salvarPerfil(USUARIO, { name: null, level: null, days_per_week: null, settings: {} })
    await banco.salvarDado(USUARIO, 'pesos', [])
    await banco.substituirTreinos(USUARIO, [])

    for (const c of falso.chamadas) {
      const donoNaLinha = c.operacao === 'upsert' && ['user_id', 'id'].some(k => (c.args[0] as Record<string, unknown>)[k] === USUARIO)
      const donoNoRpc = c.operacao === 'rpc' && (c.args[0] as { p_user: string }).p_user === USUARIO
      const filtrou = c.filtros.some(([, v]) => v === USUARIO)
      expect(filtrou || donoNaLinha || donoNoRpc, `${c.tabela} ${c.operacao} sem dono`).toBe(true)
    }
  })
})

describe('falhas', () => {
  it('um erro do Supabase vira exceção, em qualquer operação', async () => {
    const { falso, banco } = montar()
    falso.resultado = { data: null, error: { message: 'falhou de propósito' } }
    const operacoes = [
      () => banco.lerTreinos(USUARIO), () => banco.substituirTreinos(USUARIO, []), () => banco.lerPlano(USUARIO),
      () => banco.salvarPlano(USUARIO, null), () => banco.salvarPlano(USUARIO, { plan_id: 'x', started_at: '2026-10-12' }),
      () => banco.lerPerfil(USUARIO), () => banco.salvarPerfil(USUARIO, { name: null, level: null, days_per_week: null, settings: {} }),
      () => banco.lerDados(USUARIO), () => banco.salvarDado(USUARIO, 'pesos', []),
    ]
    for (const op of operacoes) await expect(op()).rejects.toThrow('falhou de propósito')
  })
})

describe('getSupabase: o cliente só existe no servidor e só com as duas variáveis', () => {
  const guardado = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, chave: process.env.SUPABASE_SERVICE_ROLE_KEY }
  afterEach(() => {
    if (guardado.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = guardado.url
    if (guardado.chave === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = guardado.chave
    vi.restoreAllMocks()
  })

  it('sem variáveis: null (o app segue só com o armazenamento do aparelho)', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY
    expect(getSupabase()).toBeNull()
  })

  it('só com a URL, ou só com a chave, ou com valores vazios: null', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcdefghijklmnopqrst.supabase.co'; delete process.env.SUPABASE_SERVICE_ROLE_KEY
    expect(getSupabase()).toBeNull()
    delete process.env.NEXT_PUBLIC_SUPABASE_URL; process.env.SUPABASE_SERVICE_ROLE_KEY = 'x'.repeat(40)
    expect(getSupabase()).toBeNull()
    process.env.NEXT_PUBLIC_SUPABASE_URL = '  '; process.env.SUPABASE_SERVICE_ROLE_KEY = ''
    expect(getSupabase()).toBeNull()
  })

  it('URL que não é uma URL: null, sem derrubar o servidor e sem imprimir a chave', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'isso não é url'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'segredo-que-nao-pode-vazar'
    expect(getSupabase()).toBeNull()
    expect(erro).toHaveBeenCalled()
    expect(JSON.stringify(erro.mock.calls)).not.toContain('segredo-que-nao-pode-vazar')
  })

  it('com as duas: um cliente, sempre o mesmo', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abcdefghijklmnopqrst.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'x'.repeat(40)
    const a = getSupabase()
    expect(a).not.toBeNull()
    expect(getSupabase()).toBe(a)
  })
})
