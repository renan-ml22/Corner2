import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { criarSugestoesBancoSupabase } from '@/lib/cornerman/sugestao-banco'

interface Chamada { tabela?: string; rpc?: string; args?: Record<string, unknown>; filtros: [string, unknown][]; colunas?: string; ordem?: string; limite?: number }

/** Cliente do Supabase de mentira: registra cada pedido e devolve o resultado programado. */
class ClienteFalso {
  chamadas: Chamada[] = []
  resultado: { data?: unknown; error?: { message: string } | null } = { data: null, error: null }

  private pronto() { return Promise.resolve({ data: null, error: null, ...this.resultado }) }

  rpc(nome: string, args: Record<string, unknown>) {
    this.chamadas.push({ rpc: nome, args, filtros: [] })
    return this.pronto()
  }

  from(tabela: string) {
    const chamada: Chamada = { tabela, filtros: [] }
    this.chamadas.push(chamada)
    const c: Record<string, unknown> = {
      select: (colunas: string) => { chamada.colunas = colunas; return c },
      eq: (col: string, v: unknown) => { chamada.filtros.push([col, v]); return c },
      order: (col: string) => { chamada.ordem = col; return c },
      limit: (n: number) => { chamada.limite = n; return c },
      maybeSingle: () => this.pronto(),
      then: (ok: (v: unknown) => unknown, falha: (e: unknown) => unknown) => this.pronto().then(ok, falha),
    }
    return c
  }
}

const montar = () => {
  const falso = new ClienteFalso()
  return { falso, banco: criarSugestoesBancoSupabase(falso as never) }
}

describe('o banco das sugestões', () => {
  it('sugerir: chama a função SQL com o treinador, a ficha, o plano e a mensagem; devolve o status', async () => {
    const { falso, banco } = montar()
    falso.resultado = { data: 'pendente' }
    expect(await banco.sugerir('u_t', 'ficha-1', 'fundamentos', 'oi')).toBe('pendente')
    falso.resultado = { data: 'registrada' }
    expect(await banco.sugerir('u_t', 'ficha-1', 'fundamentos', '')).toBe('registrada')
    expect(falso.chamadas[0]).toMatchObject({ rpc: 'sugerir_plano', args: { p_coach: 'u_t', p_aluno: 'ficha-1', p_plano: 'fundamentos', p_mensagem: 'oi' } })
  })

  it('sugerir: os erros que a função levanta de propósito passam com o texto exato', async () => {
    const { falso, banco } = montar()
    for (const motivo of ['nao_encontrado', 'ficha_encerrada']) {
      falso.resultado = { error: { message: `${motivo}` } }
      await expect(banco.sugerir('u_t', 'f', 'fundamentos', '')).rejects.toThrow(new RegExp(`^${motivo}$`))
    }
  })

  it('outro erro vira "Supabase (onde): texto do banco", sem a mensagem do treinador', async () => {
    const { falso, banco } = montar()
    falso.resultado = { error: { message: 'connection reset' } }
    await expect(banco.sugerir('u_t', 'f', 'fundamentos', 'SEGREDO DO TREINADOR')).rejects.toThrow('Supabase (sugerir plano): connection reset')
    await expect(banco.sugerir('u_t', 'f', 'fundamentos', 'SEGREDO DO TREINADOR')).rejects.not.toThrow(/SEGREDO/)
  })

  it('histórico: só as colunas da sugestão, SEMPRE filtrado por treinador E ficha, mais novas primeiro, com teto de 20', async () => {
    const { falso, banco } = montar()
    falso.resultado = { data: [{ id: 'x' }] }
    expect(await banco.historico('u_t', 'ficha-1')).toEqual([{ id: 'x' }])
    expect(falso.chamadas[0]).toMatchObject({
      tabela: 'coach_suggestions',
      colunas: 'id,plano_id,mensagem,status,created_at,answered_at',
      filtros: [['coach_id', 'u_t'], ['aluno_id', 'ficha-1']],
      ordem: 'created_at',
      limite: 20,
    })
    expect(falso.chamadas[0].colunas).not.toMatch(/coach_id|aluno_id|\*/)
  })

  it('do aluno: chama a função com a conta; resposta fora do formato vira lista vazia', async () => {
    const { falso, banco } = montar()
    falso.resultado = { data: [{ id: 'a', coach_id: 'u_t' }] }
    expect(await banco.doAluno('u_aluna')).toEqual([{ id: 'a', coach_id: 'u_t' }])
    expect(falso.chamadas[0]).toMatchObject({ rpc: 'sugestoes_do_aluno', args: { p_user: 'u_aluna' } })
    falso.resultado = { data: { nao: 'lista' } }
    expect(await banco.doAluno('u_aluna')).toEqual([])
    falso.resultado = { data: null }
    expect(await banco.doAluno('u_aluna')).toEqual([])
  })

  it('responder: só devolve true se a função devolveu true', async () => {
    const { falso, banco } = montar()
    falso.resultado = { data: true }
    expect(await banco.responder('u_aluna', 'id-1', true)).toBe(true)
    expect(falso.chamadas[0]).toMatchObject({ rpc: 'responder_sugestao', args: { p_user: 'u_aluna', p_id: 'id-1', p_aceitar: true } })
    for (const data of [false, null, 'true', 1]) {
      falso.resultado = { data }
      expect(await banco.responder('u_aluna', 'id-1', false)).toBe(false)
    }
  })

  it('nome do treinador: só a coluna name do perfil dele; vazio ou ausente vira null', async () => {
    const { falso, banco } = montar()
    falso.resultado = { data: { name: 'Marcos Silva' } }
    expect(await banco.nomeDoTreinador('u_t')).toBe('Marcos Silva')
    expect(falso.chamadas[0]).toMatchObject({ tabela: 'profiles', colunas: 'name', filtros: [['id', 'u_t']] })
    for (const data of [{ name: '  ' }, { name: 3 }, null]) {
      falso.resultado = { data }
      expect(await banco.nomeDoTreinador('u_t')).toBeNull()
    }
  })
})
