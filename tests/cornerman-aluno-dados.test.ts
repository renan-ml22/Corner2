import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { AlunosBancoLike, LinhaDeAluno } from '@/lib/cornerman/banco'
import { dadosDoAluno } from '@/lib/cornerman/aluno-dados'
import type { DadosDoAlunoBancoLike } from '@/lib/cornerman/aluno-dados-banco'

const AGORA = new Date('2026-10-27T15:00:00.000Z')
const FICHA = '3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0c'
const COACH = 'u_ana'
const OUTRO_COACH = 'u_bia'
const ALUNO = 'u_aluno'
const FOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='

const linhaDeFicha = (extra: Partial<LinhaDeAluno> = {}): LinhaDeAluno => ({
  id: FICHA, coach_id: COACH, nome: 'Beto', email: 'beto@exemplo.com', telefone: '11 99999-0000', nivel: null, estilo: null, notas: 'NOTA-DO-TREINADOR',
  foto: '', aluno_user_id: ALUNO, status: 'ativo', created_at: '2026-10-01T12:00:00Z', updated_at: '2026-10-01T12:00:00Z', ...extra,
})

class FichasFalso implements AlunosBancoLike {
  constructor(public linhas: LinhaDeAluno[]) {}
  async listar(): Promise<LinhaDeAluno[]> { throw new Error('não usado') }
  async obter(coachId: string, id: string) { return this.linhas.find(l => l.coach_id === coachId && l.id === id) ?? null }
  async inserir(): Promise<LinhaDeAluno> { throw new Error('não usado') }
  async atualizar(): Promise<LinhaDeAluno | null> { throw new Error('não usado') }
  async apagar(): Promise<boolean> { throw new Error('não usado') }
  async ultimosTreinos(): Promise<Record<string, string>> { throw new Error('não usado') }
}

const treinoNoBanco = (date: string, extra: Record<string, unknown> = {}) => ({ date, type: 'tec', rounds: 5, round_min: 3, rpe: 6, duration_seconds: 900, ...extra })

/** Banco do aluno de mentira: guarda quais usuários foram consultados e devolve o que foi programado. */
class DadosFalso implements DadosDoAlunoBancoLike {
  consultados: string[] = []
  desdeRecebido: string | null = null
  treinos: unknown[] = []
  planoDoAluno: unknown = null
  nivelDoAluno: unknown = null
  linhasDeDados: { entity: string; value: unknown }[] = []

  async treinosRecentes(alunoId: string, desdeIso: string) {
    this.consultados.push(alunoId)
    this.desdeRecebido = desdeIso
    return this.treinos
  }
  async plano(alunoId: string) { this.consultados.push(alunoId); return this.planoDoAluno }
  async nivel(alunoId: string) { this.consultados.push(alunoId); return this.nivelDoAluno }
  async dados(alunoId: string) { this.consultados.push(alunoId); return this.linhasDeDados }
}

const ler = (fichas: LinhaDeAluno[], dados: DadosFalso, coach = COACH, id = FICHA) => dadosDoAluno(new FichasFalso(fichas), dados, coach, id, AGORA)
const erroDe = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e)

describe('dadosDoAluno: o que o treinador vê de um aluno vinculado', () => {
  it('monta a resposta campo a campo: nível, foto, estilo do quiz, plano e treinos', async () => {
    const d = new DadosFalso()
    d.nivelDoAluno = 'avancado'
    d.planoDoAluno = { plan_id: 'fundamentos', started_at: '2026-10-12' }
    d.treinos = [treinoNoBanco('2026-10-26T20:00:00+00:00', { type: 'spa', rounds: 6, round_min: 2, rpe: 8, duration_seconds: 1500 })]
    d.linhasDeDados = [{ entity: 'quiz', value: '00020' }, { entity: 'foto', value: FOTO }]

    const r = await ler([linhaDeFicha()], d)

    expect(r).toEqual({
      nivel: 'avancado',
      foto: FOTO,
      estilo: { atletaId: 'ali', nome: 'Muhammad Ali', estilo: expect.any(String), percentual: expect.any(Number) },
      plano: { nome: expect.any(String), semana: 3, semanas: 4 },
      treinos: [{ data: '2026-10-26T20:00:00.000Z', tipo: 'spa', rounds: 6, minPorRound: 2, rpe: 8, duracaoSegundos: 1500 }],
    })
    expect(r.estilo!.percentual).toBeGreaterThan(0)
    expect(r.estilo!.percentual).toBeLessThanOrEqual(100)
  })

  it('sem quiz, sem plano, sem foto e sem treino: campos vazios, sem erro', async () => {
    const r = await ler([linhaDeFicha()], new DadosFalso())
    expect(r).toEqual({ nivel: null, foto: '', estilo: null, plano: null, treinos: [] })
  })

  it('só pede ao banco os treinos dos últimos 30 dias', async () => {
    const d = new DadosFalso()
    await ler([linhaDeFicha()], d)
    expect(d.desdeRecebido).toBe('2026-09-27T15:00:00.000Z')
  })

  it('treinos: o mais novo primeiro; o do limite de 30 dias entra e o de antes sai', async () => {
    const d = new DadosFalso()
    d.treinos = [
      treinoNoBanco('2026-09-27T14:59:59.000Z'), // um segundo antes do limite: fora
      treinoNoBanco('2026-09-27T15:00:00.000Z'), // exatamente 30 dias: dentro
      treinoNoBanco('2026-10-20T10:00:00.000Z'),
      treinoNoBanco('2026-10-26T10:00:00.000Z'),
    ]
    const r = await ler([linhaDeFicha()], d)
    expect(r.treinos.map(t => t.data)).toEqual(['2026-10-26T10:00:00.000Z', '2026-10-20T10:00:00.000Z', '2026-09-27T15:00:00.000Z'])
  })

  it('linha de treino corrompida (nota 11, tipo inventado, data ilegível) é descartada, as boas ficam', async () => {
    const d = new DadosFalso()
    d.treinos = [treinoNoBanco('2026-10-26T10:00:00Z', { rpe: 11 }), treinoNoBanco('2026-10-26T11:00:00Z', { type: 'xyz' }), treinoNoBanco('lixo'), treinoNoBanco('2026-10-25T10:00:00Z')]
    expect((await ler([linhaDeFicha()], d)).treinos).toHaveLength(1)
  })

  it('o banco devolve números como texto (numeric): ainda assim vira número', async () => {
    const d = new DadosFalso()
    d.treinos = [treinoNoBanco('2026-10-26T10:00:00Z', { rounds: '5', round_min: '3.5', rpe: '7', duration_seconds: '900' })]
    expect((await ler([linhaDeFicha()], d)).treinos[0]).toMatchObject({ rounds: 5, minPorRound: 3.5, rpe: 7, duracaoSegundos: 900 })
  })
})

describe('dadosDoAluno: nada de saúde nem de anotações sai, mesmo que o banco devolva a mais', () => {
  it('a resposta não contém nota, parceiro, pancadas na cabeça, sessão, lesões, peso, check-ins nem as notas do treinador', async () => {
    const d = new DadosFalso()
    d.treinos = [treinoNoBanco('2026-10-26T10:00:00Z', {
      id: 'ID-DO-TREINO', note: 'NOTA-DO-ALUNO', session_id: 'SESSAO-X', sparring_intensity: 'forte', sparring_head: 'CABECA-FORTE', sparring_partner: 'PARCEIRO-X',
    })]
    d.nivelDoAluno = 'iniciante'
    d.linhasDeDados = [
      { entity: 'quiz', value: '00020' },
      { entity: 'foto', value: FOTO },
      { entity: 'lesoes', value: [{ id: 'l1', regiao: 'ombros', nota: 'LESAO-X' }] },
      { entity: 'pesos', value: [{ id: 'p1', kg: 123.4 }] },
      { entity: 'checkins', value: [{ data: '2026-10-26', sono: 1, dor: 5, energia: 1 }] },
      { entity: 'config', value: { pesoCategoria: 77 } },
    ]
    const json = JSON.stringify(await ler([linhaDeFicha()], d))
    for (const proibido of ['NOTA-DO-ALUNO', 'SESSAO-X', 'CABECA-FORTE', 'PARCEIRO-X', 'ID-DO-TREINO', 'LESAO-X', '123.4', 'checkins', 'sono', 'cabeca', 'NOTA-DO-TREINADOR', 'beto@exemplo.com', '99999']) {
      expect(json, proibido).not.toContain(proibido)
    }
  })

  it('só consulta o banco com o id da conta que está na ficha do treinador', async () => {
    const d = new DadosFalso()
    await ler([linhaDeFicha()], d)
    expect(d.consultados.length).toBeGreaterThan(0)
    expect(new Set(d.consultados)).toEqual(new Set([ALUNO]))
  })
})

describe('dadosDoAluno: quem pode ver', () => {
  const naoEncontrado = { codigo: 'nao_encontrado', status: 404, message: 'Aluno não encontrado.' }

  it('ficha de outro treinador, id inexistente e id malformado: o mesmo 404, e o banco do aluno nem é tocado', async () => {
    for (const [coach, id] of [[OUTRO_COACH, FICHA], [COACH, '11111111-2222-4333-8444-555555555555'], [COACH, 'nao-e-uuid'], [COACH, '']] as const) {
      const d = new DadosFalso()
      expect(await erroDe(ler([linhaDeFicha()], d, coach, id)), `${coach} ${id}`).toMatchObject(naoEncontrado)
      expect(d.consultados).toEqual([])
    }
  })

  it.each([
    ['ficha manual, sem conta', { aluno_user_id: null }],
    ['ficha com convite pendente', { aluno_user_id: null, status: 'convidado' }],
    ['ficha encerrada', { aluno_user_id: null, status: 'encerrado' }],
    ['ficha encerrada que ainda guarda um vínculo antigo', { status: 'encerrado' }],
    ['ficha convidada que ainda guarda um vínculo antigo', { status: 'convidado' }],
  ] as const)('%s: 409 "sem_vinculo", sem consultar o aluno', async (_nome, extra) => {
    const d = new DadosFalso()
    expect(await erroDe(ler([linhaDeFicha(extra)], d))).toMatchObject({ codigo: 'sem_vinculo', status: 409, name: 'ErroCornerman' })
    expect(d.consultados).toEqual([])
  })
})

describe('dadosDoAluno: dados guardados que estão ruins viram "sem dado", nunca erro', () => {
  it.each([['vazio', ''], ['resposta fora do intervalo', '99999'], ['curto', '000'], ['não é texto', [0, 0, 0, 2, 0]], ['nulo', null]])('quiz %s: sem estilo', async (_nome, valor) => {
    const d = new DadosFalso()
    d.linhasDeDados = [{ entity: 'quiz', value: valor }]
    expect((await ler([linhaDeFicha()], d)).estilo).toBeNull()
  })

  it('foto que não é JPEG em data URI não é repassada', async () => {
    const d = new DadosFalso()
    d.linhasDeDados = [{ entity: 'foto', value: 'javascript:alert(1)' }]
    expect((await ler([linhaDeFicha()], d)).foto).toBe('')
  })

  it('nível desconhecido vira sem nível', async () => {
    const d = new DadosFalso()
    d.nivelDoAluno = 'campeao'
    expect((await ler([linhaDeFicha()], d)).nivel).toBeNull()
  })

  it('plano que o app não conhece vira sem plano', async () => {
    const d = new DadosFalso()
    d.planoDoAluno = { plan_id: 'plano-que-sumiu', started_at: '2026-10-12' }
    expect((await ler([linhaDeFicha()], d)).plano).toBeNull()
  })

  it('semana do plano: antes do início é 1; depois do fim fica no total', async () => {
    const d = new DadosFalso()
    d.planoDoAluno = { plan_id: 'fundamentos', started_at: '2026-11-02' }
    expect((await ler([linhaDeFicha()], d)).plano).toMatchObject({ semana: 1, semanas: 4 })
    d.planoDoAluno = { plan_id: 'fundamentos', started_at: '2026-08-03' }
    expect((await ler([linhaDeFicha()], d)).plano).toMatchObject({ semana: 4, semanas: 4 })
  })
})
