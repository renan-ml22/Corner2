import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { criarConvitesBancoSupabase } from '@/lib/cornerman/convite-banco'

interface Chamada { tipo: 'from' | 'rpc'; nome: string; operacao?: string; args?: Record<string, unknown>; filtros: [string, string, unknown][]; colunas?: string }

/** Cliente do Supabase de mentira: registra cada pedido e devolve resultados programados, um por pedido (o último se repete). */
class ClienteFalso {
  chamadas: Chamada[] = []
  fila: { data?: unknown; error?: { message: string } | null }[] = [{ data: null, error: null }]

  private proximo() { return this.fila.length > 1 ? this.fila.shift()! : this.fila[0] }

  from(nome: string) {
    const chamada: Chamada = { tipo: 'from', nome, filtros: [] }
    this.chamadas.push(chamada)
    const resultado = () => Promise.resolve({ data: null, error: null, ...this.proximo() })
    const c: Record<string, unknown> = {
      select: (colunas: string) => { chamada.operacao ||= 'select'; chamada.colunas = colunas; return c },
      eq: (col: string, v: unknown) => { chamada.filtros.push([col, 'eq', v]); return c },
      neq: (col: string, v: unknown) => { chamada.filtros.push([col, 'neq', v]); return c },
      is: (col: string, v: unknown) => { chamada.filtros.push([col, 'is', v]); return c },
      gt: (col: string, v: unknown) => { chamada.filtros.push([col, 'gt', v]); return c },
      order: () => c,
      limit: () => c,
      maybeSingle: () => resultado(),
    }
    return c
  }

  rpc(nome: string, args: Record<string, unknown>) {
    this.chamadas.push({ tipo: 'rpc', nome, args, filtros: [] })
    return Promise.resolve({ data: null, error: null, ...this.proximo() })
  }
}

const COACH = 'u_marcos'
const ALUNO_ID = '3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0c'
const HASH = 'a'.repeat(64)

function montar() {
  const falso = new ClienteFalso()
  return { falso, banco: criarConvitesBancoSupabase(falso as never) }
}

describe('funções SQL (RPC): atômicas, com os nomes de parâmetro do SQL', () => {
  it('criarConvite → criar_convite com o hash (nunca o token)', async () => {
    const { falso, banco } = montar()
    await banco.criarConvite(COACH, ALUNO_ID, HASH, '2026-11-10T12:00:00.000Z')
    expect(falso.chamadas[0]).toMatchObject({ tipo: 'rpc', nome: 'criar_convite', args: { p_coach: COACH, p_aluno: ALUNO_ID, p_hash: HASH, p_expira: '2026-11-10T12:00:00.000Z' } })
  })

  it('cancelarConvite → cancelar_convite; devolve o boolean', async () => {
    const { falso, banco } = montar()
    falso.fila = [{ data: true }]
    expect(await banco.cancelarConvite(COACH, ALUNO_ID)).toBe(true)
    falso.fila = [{ data: false }]
    expect(await banco.cancelarConvite(COACH, ALUNO_ID)).toBe(false)
    falso.fila = [{ data: null }]
    expect(await banco.cancelarConvite(COACH, ALUNO_ID)).toBe(false)
    expect(falso.chamadas[0]).toMatchObject({ nome: 'cancelar_convite', args: { p_coach: COACH, p_aluno: ALUNO_ID } })
  })

  it('aceitarConvite → aceitar_convite; devolve o coach_id', async () => {
    const { falso, banco } = montar()
    falso.fila = [{ data: COACH }]
    expect(await banco.aceitarConvite(HASH, 'u_aluno')).toEqual({ coachId: COACH })
    expect(falso.chamadas[0]).toMatchObject({ nome: 'aceitar_convite', args: { p_hash: HASH, p_user: 'u_aluno' } })
  })

  it('aceitarConvite: resposta que não é um id vira erro "convite_invalido"', async () => {
    const { falso, banco } = montar()
    falso.fila = [{ data: null }]
    await expect(banco.aceitarConvite(HASH, 'u_aluno')).rejects.toThrow(/^convite_invalido$/)
  })

  it('desvincular → desvincular_aluno; devolve quantas fichas', async () => {
    const { falso, banco } = montar()
    falso.fila = [{ data: 2 }]
    expect(await banco.desvincular('u_aluno')).toBe(2)
    falso.fila = [{ data: null }]
    expect(await banco.desvincular('u_aluno')).toBe(0)
    expect(falso.chamadas[0]).toMatchObject({ nome: 'desvincular_aluno', args: { p_user: 'u_aluno' } })
  })
})

describe('leituras: sempre filtradas', () => {
  it('convitePendente: do treinador E da ficha, só não usado', async () => {
    const { falso, banco } = montar()
    falso.fila = [{ data: { expires_at: '2026-11-10T12:00:00+00:00' } }]
    expect(await banco.convitePendente(COACH, ALUNO_ID)).toEqual({ expiraEm: '2026-11-10T12:00:00.000Z' })
    expect(falso.chamadas[0]).toMatchObject({ nome: 'coach_invites', filtros: [['coach_id', 'eq', COACH], ['aluno_id', 'eq', ALUNO_ID], ['used_at', 'is', null]] })
    falso.fila = [{ data: null }]
    expect(await banco.convitePendente(COACH, ALUNO_ID)).toBeNull()
  })

  it('consultarConvite: pelo hash, não usado e não expirado; junta o nome do treinador (profiles)', async () => {
    const { falso, banco } = montar()
    falso.fila = [{ data: { coach_id: COACH } }, { data: { name: 'Marcos Silva' } }]
    expect(await banco.consultarConvite(HASH)).toEqual({ coachId: COACH, nomeDoTreinador: 'Marcos Silva' })
    const [convite, perfil] = falso.chamadas
    expect(convite).toMatchObject({ nome: 'coach_invites' })
    expect(convite.filtros).toEqual(expect.arrayContaining([['token_hash', 'eq', HASH], ['used_at', 'is', null]]))
    expect(convite.filtros.some(([col, op]) => col === 'expires_at' && op === 'gt')).toBe(true)
    expect(perfil).toMatchObject({ nome: 'profiles', filtros: [['id', 'eq', COACH]] })
  })

  it('consultarConvite: sem convite válido, null (e nem consulta o perfil); sem perfil, nome nulo', async () => {
    const { falso, banco } = montar()
    falso.fila = [{ data: null }]
    expect(await banco.consultarConvite(HASH)).toBeNull()
    expect(falso.chamadas).toHaveLength(1)
    falso.chamadas = []
    falso.fila = [{ data: { coach_id: COACH } }, { data: null }]
    expect(await banco.consultarConvite(HASH)).toEqual({ coachId: COACH, nomeDoTreinador: null })
  })

  it('treinadorDoAluno: ficha da conta que não está encerrada, e o nome do perfil do treinador', async () => {
    const { falso, banco } = montar()
    falso.fila = [{ data: { coach_id: COACH } }, { data: { name: 'Marcos Silva' } }]
    expect(await banco.treinadorDoAluno('u_aluno')).toEqual({ nome: 'Marcos Silva' })
    expect(falso.chamadas[0]).toMatchObject({ nome: 'coach_alunos', filtros: [['aluno_user_id', 'eq', 'u_aluno'], ['status', 'neq', 'encerrado']] })
    falso.chamadas = []
    falso.fila = [{ data: null }]
    expect(await banco.treinadorDoAluno('u_aluno')).toBeNull()
  })
})

describe('erros do SQL viram Error com a mensagem exata; qualquer outro, só o "onde"', () => {
  it.each(['limite_de_alunos', 'nao_convidavel', 'nao_encontrado'])('criar_convite: %s', async mensagem => {
    const { falso, banco } = montar()
    falso.fila = [{ data: null, error: { message: mensagem } }]
    await expect(banco.criarConvite(COACH, ALUNO_ID, HASH, 'x')).rejects.toThrow(new RegExp(`^${mensagem}$`))
  })

  it.each(['convite_invalido', 'proprio_convite', 'ja_tem_treinador'])('aceitar_convite: %s', async mensagem => {
    const { falso, banco } = montar()
    falso.fila = [{ data: null, error: { message: mensagem } }]
    await expect(banco.aceitarConvite(HASH, 'u_aluno')).rejects.toThrow(new RegExp(`^${mensagem}$`))
  })

  it('mensagem desconhecida vira "Supabase (onde): …" e não leva hash nem ids', async () => {
    const { falso, banco } = montar()
    falso.fila = [{ data: null, error: { message: 'conexão perdida' } }]
    const e = await banco.criarConvite(COACH, ALUNO_ID, HASH, 'x').then(() => null, (x: Error) => x)
    expect(e?.message).toBe('Supabase (criar convite): conexão perdida')
    expect(e?.message).not.toContain(HASH)
    await expect(banco.cancelarConvite(COACH, ALUNO_ID)).rejects.toThrow('Supabase (cancelar convite): conexão perdida')
    await expect(banco.aceitarConvite(HASH, 'u')).rejects.toThrow('Supabase (aceitar convite): conexão perdida')
    await expect(banco.desvincular('u')).rejects.toThrow('Supabase (desvincular): conexão perdida')
    await expect(banco.convitePendente(COACH, ALUNO_ID)).rejects.toThrow('Supabase (ler convite): conexão perdida')
    await expect(banco.consultarConvite(HASH)).rejects.toThrow('Supabase (consultar convite): conexão perdida')
    await expect(banco.treinadorDoAluno('u')).rejects.toThrow('Supabase (ler treinador): conexão perdida')
  })
})
