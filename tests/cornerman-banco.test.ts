import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { criarAlunosBancoSupabase } from '@/lib/cornerman/banco'

interface Chamada { tabela: string; operacao: string; dados?: Record<string, unknown>; filtros: [string, unknown][]; colunas?: string }

/** Cliente do Supabase de mentira: registra cada pedido e devolve o resultado programado. */
class ClienteFalso {
  chamadas: Chamada[] = []
  resultado: { data?: unknown; error?: { message: string } | null } = { data: [], error: null }

  from(tabela: string) {
    const chamada: Chamada = { tabela, operacao: '', filtros: [] }
    this.chamadas.push(chamada)
    const resultado = () => Promise.resolve({ data: null, error: null, ...this.resultado })
    const c: Record<string, unknown> = {
      select: (colunas: string) => { chamada.operacao ||= 'select'; chamada.colunas = colunas; return c },
      insert: (dados: Record<string, unknown>) => { chamada.operacao = 'insert'; chamada.dados = dados; return c },
      update: (dados: Record<string, unknown>) => { chamada.operacao = 'update'; chamada.dados = dados; return c },
      delete: () => { chamada.operacao = 'delete'; return c },
      eq: (coluna: string, valor: unknown) => { chamada.filtros.push([coluna, valor]); return c },
      neq: (coluna: string, valor: unknown) => { chamada.filtros.push([`${coluna}!=`, valor]); return c },
      single: () => resultado(),
      maybeSingle: () => resultado(),
      then: (ok: (v: unknown) => unknown, falha: (e: unknown) => unknown) => resultado().then(ok, falha),
    }
    return c
  }
}

const COACH = 'u_ana'
const ID = '3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0c'
const linha = { id: ID, coach_id: COACH, nome: 'Beto', email: null, telefone: null, nivel: null, estilo: null, notas: '', foto: '', aluno_user_id: null, status: 'ativo', created_at: '2026-10-27T12:00:00Z', updated_at: '2026-10-27T12:00:00Z' }
const DADOS = { nome: 'Beto', email: 'beto@exemplo.com', telefone: null, nivel: null, estilo: null, notas: '', foto: '' }

function montar() {
  const falso = new ClienteFalso()
  return { falso, banco: criarAlunosBancoSupabase(falso as never) }
}

describe('toda operação filtra pelo treinador', () => {
  it('listar: tabela coach_alunos, só as linhas do treinador', async () => {
    const { falso, banco } = montar()
    falso.resultado = { data: [linha] }
    expect(await banco.listar(COACH)).toEqual([linha])
    expect(falso.chamadas[0]).toMatchObject({ tabela: 'coach_alunos', operacao: 'select', filtros: [['coach_id', COACH]] })
  })

  it('listar: sem dados vira lista vazia', async () => {
    const { falso, banco } = montar()
    falso.resultado = { data: null }
    expect(await banco.listar(COACH)).toEqual([])
  })

  it('obter: pelo treinador E pelo id; sem linha, null', async () => {
    const { falso, banco } = montar()
    falso.resultado = { data: linha }
    expect(await banco.obter(COACH, ID)).toEqual(linha)
    falso.resultado = { data: null }
    expect(await banco.obter(COACH, ID)).toBeNull()
    expect(falso.chamadas[0].filtros).toEqual([['coach_id', COACH], ['id', ID]])
  })

  it('atualizar: pelo treinador E pelo id, grava updated_at e devolve a linha; sem linha, null', async () => {
    const { falso, banco } = montar()
    falso.resultado = { data: { ...linha, notas: 'x' } }
    expect(await banco.atualizar(COACH, ID, { notas: 'x' })).toMatchObject({ notas: 'x' })
    expect(falso.chamadas[0]).toMatchObject({ operacao: 'update', filtros: [['coach_id', COACH], ['id', ID]] })
    expect(falso.chamadas[0].dados).toMatchObject({ notas: 'x' })
    expect(typeof falso.chamadas[0].dados!.updated_at).toBe('string')
    falso.resultado = { data: null }
    expect(await banco.atualizar(COACH, ID, { notas: 'x' })).toBeNull()
  })

  it('atualizar o STATUS não casa com ficha "convidada" (a troca é recusada pelo próprio banco, sem leitura prévia); outros campos casam', async () => {
    const { falso, banco } = montar()
    falso.resultado = { data: { ...linha, status: 'encerrado' } }
    await banco.atualizar(COACH, ID, { status: 'encerrado', aluno_user_id: null })
    expect(falso.chamadas[0].filtros).toEqual([['coach_id', COACH], ['id', ID], ['status!=', 'convidado']])
    await banco.atualizar(COACH, ID, { notas: 'x' })
    expect(falso.chamadas[1].filtros).toEqual([['coach_id', COACH], ['id', ID]])
  })

  it('apagar: pelo treinador E pelo id; true só se uma linha foi apagada', async () => {
    const { falso, banco } = montar()
    falso.resultado = { data: [{ id: ID }] }
    expect(await banco.apagar(COACH, ID)).toBe(true)
    expect(falso.chamadas[0]).toMatchObject({ operacao: 'delete', filtros: [['coach_id', COACH], ['id', ID]] })
    falso.resultado = { data: [] }
    expect(await banco.apagar(COACH, ID)).toBe(false)
  })
})

describe('inserir', () => {
  it('grava o dono vindo do argumento, nunca de dentro dos dados, e devolve a linha', async () => {
    const { falso, banco } = montar()
    falso.resultado = { data: linha }
    const dados = { ...DADOS, coach_id: 'u_invasor' } as unknown as typeof DADOS
    expect(await banco.inserir(COACH, dados)).toEqual(linha)
    expect(falso.chamadas[0]).toMatchObject({ tabela: 'coach_alunos', operacao: 'insert' })
    expect(falso.chamadas[0].dados).toMatchObject({ coach_id: COACH, nome: 'Beto', email: 'beto@exemplo.com' })
  })
})

describe('erros', () => {
  it('o gatilho do limite (mensagem com limite_de_alunos) vira Error("limite_de_alunos") em inserir e em atualizar', async () => {
    const { falso, banco } = montar()
    falso.resultado = { data: null, error: { message: 'limite_de_alunos' } }
    await expect(banco.inserir(COACH, DADOS)).rejects.toThrow(/^limite_de_alunos$/)
    await expect(banco.atualizar(COACH, ID, { status: 'ativo' })).rejects.toThrow(/^limite_de_alunos$/)
  })

  it('outro erro do Postgres vira "Supabase (onde): mensagem", sem os dados da ficha', async () => {
    const { falso, banco } = montar()
    falso.resultado = { data: null, error: { message: 'conexão perdida' } }
    const e = await banco.inserir(COACH, { ...DADOS, nome: 'Nome Identificável', notas: 'nota secreta' }).then(() => null, (x: Error) => x)
    expect(e?.message).toBe('Supabase (gravar aluno): conexão perdida')
    expect(e?.message).not.toContain('Nome Identificável')
    await expect(banco.listar(COACH)).rejects.toThrow('Supabase (ler alunos): conexão perdida')
    await expect(banco.obter(COACH, ID)).rejects.toThrow('Supabase (ler aluno): conexão perdida')
    await expect(banco.atualizar(COACH, ID, { notas: 'x' })).rejects.toThrow('Supabase (atualizar aluno): conexão perdida')
    await expect(banco.apagar(COACH, ID)).rejects.toThrow('Supabase (apagar aluno): conexão perdida')
  })
})
