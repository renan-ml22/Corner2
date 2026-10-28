import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { AlunosBancoLike, LinhaDeAluno } from '@/lib/cornerman/banco'
import type { LinhaDaSugestaoDoAluno, LinhaDeSugestao, SugestoesBancoLike } from '@/lib/cornerman/sugestao-banco'
import { ErroCornerman, contarAlunosVermelhos } from '@/lib/cornerman/servico'
import { historicoDeSugestoes, responderSugestao, sugerirPlano, sugestoesDoAluno } from '@/lib/cornerman/sugestao-servico'

interface Ficha { id: string; coach_id: string; status: 'ativo' | 'convidado' | 'encerrado'; aluno_user_id: string | null }
interface Sugestao extends LinhaDaSugestaoDoAluno { aluno_id: string }

/**
 * Banco em memória com a semântica das funções SQL da etapa 4: o treinador só mexe nas próprias fichas, uma pendente por
 * aluno (a nova troca a antiga por `substituida`), ficha sem conta só registra, e o aluno só enxerga e responde o que é do
 * vínculo ativo dele.
 */
class BancoDeSugestoesFalso implements SugestoesBancoLike {
  fichas = new Map<string, Ficha>()
  sugestoes: Sugestao[] = []
  nomes = new Map<string, string | null>()
  falha: Error | null = null
  chamadas = 0
  relogio = 0

  private tick() { return new Date(Date.UTC(2026, 9, 28, 12, 0, this.relogio++)).toISOString() }
  private entrar() { this.chamadas++; if (this.falha) throw this.falha }

  ficha(coachId: string, status: Ficha['status'] = 'ativo', alunoUserId: string | null = null): Ficha {
    const f: Ficha = { id: randomUUID(), coach_id: coachId, status, aluno_user_id: alunoUserId }
    this.fichas.set(f.id, f)
    return f
  }

  async sugerir(coachId: string, alunoId: string, planoId: string, mensagem: string) {
    this.entrar()
    const f = this.fichas.get(alunoId)
    if (!f || f.coach_id !== coachId) throw new Error('nao_encontrado')
    if (f.status === 'encerrado') throw new Error('ficha_encerrada')
    const comConta = f.aluno_user_id !== null && f.status === 'ativo'
    if (comConta) for (const s of this.sugestoes) if (s.aluno_id === alunoId && s.status === 'pendente') { s.status = 'substituida'; s.answered_at = this.tick() }
    this.sugestoes.push({ id: randomUUID(), aluno_id: alunoId, coach_id: coachId, plano_id: planoId, mensagem, status: comConta ? 'pendente' : 'registrada', created_at: this.tick(), answered_at: null })
    return comConta ? 'pendente' as const : 'registrada' as const
  }

  async historico(coachId: string, alunoId: string): Promise<LinhaDeSugestao[]> {
    this.entrar()
    return this.sugestoes.filter(s => s.coach_id === coachId && s.aluno_id === alunoId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(({ id, plano_id, mensagem, status, created_at, answered_at }) => ({ id, plano_id, mensagem, status, created_at, answered_at }))
  }

  async doAluno(alunoUserId: string): Promise<LinhaDaSugestaoDoAluno[]> {
    this.entrar()
    return this.sugestoes
      .filter(s => (s.status === 'pendente' || s.status === 'aceita') && this.fichas.get(s.aluno_id)?.aluno_user_id === alunoUserId && this.fichas.get(s.aluno_id)?.status === 'ativo')
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(s => ({ id: s.id, plano_id: s.plano_id, mensagem: s.mensagem, status: s.status, created_at: s.created_at, answered_at: s.answered_at, coach_id: s.coach_id }))
  }

  async responder(alunoUserId: string, id: string, aceitar: boolean) {
    this.entrar()
    const s = this.sugestoes.find(x => x.id === id)
    const f = s ? this.fichas.get(s.aluno_id) : undefined
    if (!s || s.status !== 'pendente' || !f || f.aluno_user_id !== alunoUserId || f.status !== 'ativo') return false
    s.status = aceitar ? 'aceita' : 'recusada'
    s.answered_at = this.tick()
    return true
  }

  async nomeDoTreinador(coachId: string) { this.entrar(); return this.nomes.get(coachId) ?? null }
}

const TREINADOR = 'u_treinador'
const OUTRO = 'u_outro_treinador'
const ALUNA = 'u_aluna'

function cenario() {
  const banco = new BancoDeSugestoesFalso()
  const ficha = banco.ficha(TREINADOR, 'ativo', ALUNA)
  banco.nomes.set(TREINADOR, 'Marcos Silva')
  return { banco, ficha }
}

const codigoDe = async (p: Promise<unknown>) => {
  try { await p } catch (e) { return e instanceof ErroCornerman ? `${e.codigo}:${e.status}` : `outro:${e instanceof Error ? e.message : String(e)}` }
  return 'sem erro'
}

describe('sugerirPlano', () => {
  it('aluno com conta: grava a sugestão como pendente', async () => {
    const { banco, ficha } = cenario()
    expect(await sugerirPlano(banco, TREINADOR, ficha.id, { planoId: 'fundamentos', mensagem: 'Foque na guarda.' })).toEqual({ status: 'pendente' })
    const [s] = await banco.historico(TREINADOR, ficha.id)
    expect(s).toMatchObject({ plano_id: 'fundamentos', mensagem: 'Foque na guarda.', status: 'pendente' })
  })

  it('uma nova sugestão substitui a pendente: nunca há duas', async () => {
    const { banco, ficha } = cenario()
    await sugerirPlano(banco, TREINADOR, ficha.id, { planoId: 'fundamentos' })
    await sugerirPlano(banco, TREINADOR, ficha.id, { planoId: 'base-aerobica' })
    const historico = await banco.historico(TREINADOR, ficha.id)
    expect(historico.map(s => [s.plano_id, s.status])).toEqual([['base-aerobica', 'pendente'], ['fundamentos', 'substituida']])
  })

  it('ficha sem conta (manual ou convidada): fica só como registro, o aluno não recebe nada', async () => {
    const banco = new BancoDeSugestoesFalso()
    const manual = banco.ficha(TREINADOR)
    const convidada = banco.ficha(TREINADOR, 'convidado')
    expect(await sugerirPlano(banco, TREINADOR, manual.id, { planoId: 'fundamentos' })).toEqual({ status: 'registrada' })
    expect(await sugerirPlano(banco, TREINADOR, convidada.id, { planoId: 'fundamentos' })).toEqual({ status: 'registrada' })
    // Duas registradas na mesma ficha convivem (não substituem).
    await sugerirPlano(banco, TREINADOR, manual.id, { planoId: 'base-aerobica' })
    expect((await banco.historico(TREINADOR, manual.id)).map(s => s.status)).toEqual(['registrada', 'registrada'])
  })

  it('ficha encerrada: 409, e nada é gravado', async () => {
    const banco = new BancoDeSugestoesFalso()
    const f = banco.ficha(TREINADOR, 'encerrado')
    expect(await codigoDe(sugerirPlano(banco, TREINADOR, f.id, { planoId: 'fundamentos' }))).toBe('ficha_encerrada:409')
    expect(banco.sugestoes).toHaveLength(0)
  })

  it('ficha de outro treinador, inexistente ou id malformado: a mesma resposta 404, sem gravar', async () => {
    const { banco, ficha } = cenario()
    const alvos = [ficha.id, randomUUID(), 'nao-e-uuid', '', "1' or '1'='1"]
    for (const alvo of alvos) {
      expect(await codigoDe(sugerirPlano(banco, OUTRO, alvo, { planoId: 'fundamentos' }))).toBe('nao_encontrado:404')
    }
    expect(banco.sugestoes).toHaveLength(0)
  })

  it('id malformado nem chega ao banco', async () => {
    const { banco } = cenario()
    await codigoDe(sugerirPlano(banco, TREINADOR, 'nao-e-uuid', { planoId: 'fundamentos' }))
    expect(banco.chamadas).toBe(0)
  })

  it('corpo inválido: 400 com texto para a pessoa, sem tocar no banco', async () => {
    const { banco, ficha } = cenario()
    for (const corpo of [null, {}, { planoId: 'nao-existe' }, { planoId: 'fundamentos', mensagem: 'a'.repeat(501) }, { planoId: 'fundamentos', status: 'aceita' }]) {
      expect(await codigoDe(sugerirPlano(banco, TREINADOR, ficha.id, corpo))).toBe('dado_invalido:400')
    }
    expect(banco.chamadas).toBe(0)
  })

  it('falha do banco sobe como está (a rota a transforma em 502 genérico)', async () => {
    const { banco, ficha } = cenario()
    banco.falha = new Error('Supabase (sugerir plano): connection reset')
    expect(await codigoDe(sugerirPlano(banco, TREINADOR, ficha.id, { planoId: 'fundamentos' }))).toBe('outro:Supabase (sugerir plano): connection reset')
  })
})

describe('historicoDeSugestoes', () => {
  const alunos = (fichas: Map<string, Ficha>): AlunosBancoLike => ({
    async obter(coachId: string, id: string) {
      const f = fichas.get(id)
      return f && f.coach_id === coachId ? ({ id: f.id, coach_id: f.coach_id } as LinhaDeAluno) : null
    },
  } as unknown as AlunosBancoLike)

  it('devolve da mais nova para a mais antiga, com o nome do plano, campo a campo', async () => {
    const { banco, ficha } = cenario()
    await sugerirPlano(banco, TREINADOR, ficha.id, { planoId: 'fundamentos', mensagem: 'a' })
    await sugerirPlano(banco, TREINADOR, ficha.id, { planoId: 'base-aerobica', mensagem: 'b' })
    const h = await historicoDeSugestoes(alunos(banco.fichas), banco, TREINADOR, ficha.id)
    expect(h.map(s => s.planoId)).toEqual(['base-aerobica', 'fundamentos'])
    expect(h[0].planoNome).toBe('Base Aeróbica')
    expect(h[0].respondidaEm).toBeNull()
    expect(h[1].respondidaEm).not.toBeNull()
    // Só os campos permitidos: nada de coach_id, aluno_id nem do que o banco tiver a mais.
    expect(Object.keys(h[0]).sort()).toEqual(['criadaEm', 'id', 'mensagem', 'planoId', 'planoNome', 'respondidaEm', 'status'])
  })

  it('plano que saiu dos dados do app aparece com um nome seguro, não quebra', async () => {
    const { banco, ficha } = cenario()
    banco.sugestoes.push({ id: randomUUID(), aluno_id: ficha.id, coach_id: TREINADOR, plano_id: 'plano-que-saiu', mensagem: '', status: 'pendente', created_at: '2026-10-28T10:00:00.000Z', answered_at: null })
    const [s] = await historicoDeSugestoes(alunos(banco.fichas), banco, TREINADOR, ficha.id)
    expect(s.planoNome).toBe('Plano removido')
  })

  it('linha com status desconhecido é descartada em vez de mostrada com texto errado', async () => {
    const { banco, ficha } = cenario()
    banco.sugestoes.push({ id: randomUUID(), aluno_id: ficha.id, coach_id: TREINADOR, plano_id: 'fundamentos', mensagem: '', status: 'inventado', created_at: '2026-10-28T10:00:00.000Z', answered_at: null })
    expect(await historicoDeSugestoes(alunos(banco.fichas), banco, TREINADOR, ficha.id)).toEqual([])
  })

  it('ficha de outro treinador, inexistente ou malformada: 404 igual, e as sugestões do outro não vazam', async () => {
    const { banco, ficha } = cenario()
    await sugerirPlano(banco, TREINADOR, ficha.id, { planoId: 'fundamentos' })
    for (const alvo of [ficha.id, randomUUID(), 'nao-e-uuid']) {
      expect(await codigoDe(historicoDeSugestoes(alunos(banco.fichas), banco, OUTRO, alvo))).toBe('nao_encontrado:404')
    }
  })
})

describe('sugestoesDoAluno', () => {
  it('sem nada: pendente e aceita vazias', async () => {
    const { banco } = cenario()
    expect(await sugestoesDoAluno(banco, ALUNA)).toEqual({ pendente: null, aceita: null })
  })

  it('devolve a pendente com o primeiro nome do treinador, sem ids internos', async () => {
    const { banco, ficha } = cenario()
    await sugerirPlano(banco, TREINADOR, ficha.id, { planoId: 'fundamentos', mensagem: 'Vamos nessa.' })
    const { pendente, aceita } = await sugestoesDoAluno(banco, ALUNA)
    expect(aceita).toBeNull()
    expect(pendente).toMatchObject({ planoId: 'fundamentos', planoNome: 'Fundamentos', mensagem: 'Vamos nessa.', treinador: 'Marcos' })
    expect(Object.keys(pendente!).sort()).toEqual(['criadaEm', 'id', 'mensagem', 'planoId', 'planoNome', 'respondidaEm', 'treinador'])
  })

  it('treinador sem nome cadastrado: "Um treinador"', async () => {
    const { banco, ficha } = cenario()
    banco.nomes.set(TREINADOR, null)
    await sugerirPlano(banco, TREINADOR, ficha.id, { planoId: 'fundamentos' })
    expect((await sugestoesDoAluno(banco, ALUNA)).pendente?.treinador).toBe('Um treinador')
  })

  it('depois de aceitar, a sugestão vira "aceita" (para o selo) e não há mais pendente', async () => {
    const { banco, ficha } = cenario()
    await sugerirPlano(banco, TREINADOR, ficha.id, { planoId: 'fundamentos' })
    const { pendente } = await sugestoesDoAluno(banco, ALUNA)
    await responderSugestao(banco, ALUNA, pendente!.id, true)
    const depois = await sugestoesDoAluno(banco, ALUNA)
    expect(depois.pendente).toBeNull()
    expect(depois.aceita).toMatchObject({ planoId: 'fundamentos', treinador: 'Marcos' })
    expect(depois.aceita?.respondidaEm).not.toBeNull()
  })

  it('recusada não aparece em lugar nenhum', async () => {
    const { banco, ficha } = cenario()
    await sugerirPlano(banco, TREINADOR, ficha.id, { planoId: 'fundamentos' })
    const { pendente } = await sugestoesDoAluno(banco, ALUNA)
    await responderSugestao(banco, ALUNA, pendente!.id, false)
    expect(await sugestoesDoAluno(banco, ALUNA)).toEqual({ pendente: null, aceita: null })
  })

  it('só enxerga as sugestões da própria conta e do vínculo ativo', async () => {
    const { banco, ficha } = cenario()
    await sugerirPlano(banco, TREINADOR, ficha.id, { planoId: 'fundamentos' })
    expect(await sugestoesDoAluno(banco, 'u_outra_conta')).toEqual({ pendente: null, aceita: null })
    ficha.status = 'encerrado'
    ficha.aluno_user_id = null
    expect(await sugestoesDoAluno(banco, ALUNA)).toEqual({ pendente: null, aceita: null })
  })

  it('falha do banco sobe como está', async () => {
    const { banco } = cenario()
    banco.falha = new Error('Supabase (ler sugestões): caiu')
    expect(await codigoDe(sugestoesDoAluno(banco, ALUNA))).toBe('outro:Supabase (ler sugestões): caiu')
  })
})

describe('responderSugestao', () => {
  it('aceitar e recusar mudam o status; responder de novo dá 404', async () => {
    const { banco, ficha } = cenario()
    await sugerirPlano(banco, TREINADOR, ficha.id, { planoId: 'fundamentos' })
    const id = (await banco.historico(TREINADOR, ficha.id))[0].id
    await responderSugestao(banco, ALUNA, id, true)
    expect((await banco.historico(TREINADOR, ficha.id))[0].status).toBe('aceita')
    expect(await codigoDe(responderSugestao(banco, ALUNA, id, false))).toBe('nao_encontrado:404')
    expect((await banco.historico(TREINADOR, ficha.id))[0].status).toBe('aceita')
  })

  it('sugestão de outro aluno, inexistente, substituída ou malformada: a mesma resposta 404', async () => {
    const { banco, ficha } = cenario()
    await sugerirPlano(banco, TREINADOR, ficha.id, { planoId: 'fundamentos' })
    const velha = (await banco.historico(TREINADOR, ficha.id))[0].id
    await sugerirPlano(banco, TREINADOR, ficha.id, { planoId: 'base-aerobica' })
    for (const alvo of [velha, randomUUID(), 'nao-e-uuid', '']) {
      expect(await codigoDe(responderSugestao(banco, ALUNA, alvo, true))).toBe('nao_encontrado:404')
    }
    const nova = (await banco.historico(TREINADOR, ficha.id))[0].id
    expect(await codigoDe(responderSugestao(banco, 'u_outra_conta', nova, true))).toBe('nao_encontrado:404')
    expect((await banco.historico(TREINADOR, ficha.id))[0].status).toBe('pendente')
  })

  it('o treinador não responde pelo aluno: a conta do treinador não é a do vínculo', async () => {
    const { banco, ficha } = cenario()
    await sugerirPlano(banco, TREINADOR, ficha.id, { planoId: 'fundamentos' })
    const id = (await banco.historico(TREINADOR, ficha.id))[0].id
    expect(await codigoDe(responderSugestao(banco, TREINADOR, id, true))).toBe('nao_encontrado:404')
  })

  it('id malformado nem chega ao banco', async () => {
    const { banco } = cenario()
    await codigoDe(responderSugestao(banco, ALUNA, 'nao-e-uuid', true))
    expect(banco.chamadas).toBe(0)
  })
})

describe('contarAlunosVermelhos', () => {
  // Meio-dia em São Paulo (UTC-3) de 28/10/2026.
  const agora = new Date('2026-10-28T15:00:00.000Z')
  const diasAtras = (n: number) => new Date(agora.getTime() - n * 24 * 60 * 60 * 1000).toISOString()
  const banco = (ultimos: Record<string, string> | Error) => ({
    async ultimosTreinos() { if (ultimos instanceof Error) throw ultimos; return ultimos },
  }) as unknown as AlunosBancoLike

  it('conta quem está há 7 dias ou mais sem treinar', async () => {
    const b = banco({ a: diasAtras(7), b: diasAtras(30), c: diasAtras(6), d: diasAtras(0), e: diasAtras(2) })
    expect(await contarAlunosVermelhos(b, TREINADOR, agora)).toBe(2)
  })

  it('sem nenhum treino registrado: zero (cinza não é vermelho)', async () => {
    expect(await contarAlunosVermelhos(banco({}), TREINADOR, agora)).toBe(0)
  })

  it('a regra é por dia de calendário em São Paulo, a mesma do status da lista', async () => {
    // Treino em 21/10 às 23:30 em SP (02:30Z de 22/10). Às 00:10 de 28/10 em SP (03:10Z) são 7 dias de calendário: vermelho.
    const treino = banco({ a: '2026-10-22T02:30:00.000Z' })
    expect(await contarAlunosVermelhos(treino, TREINADOR, new Date('2026-10-28T03:10:00.000Z'))).toBe(1)
    // Um pouco antes (23:59 de 27/10 em SP, 02:59Z) ainda são 6 dias: amarelo.
    expect(await contarAlunosVermelhos(treino, TREINADOR, new Date('2026-10-28T02:59:00.000Z'))).toBe(0)
    // Treino em 22/10 às 00:30 em SP (03:30Z), consultado em 28/10 às 09:00 em SP: 6 dias.
    expect(await contarAlunosVermelhos(banco({ a: '2026-10-22T03:30:00.000Z' }), TREINADOR, new Date('2026-10-28T12:00:00.000Z'))).toBe(0)
  })

  it('falha do banco sobe: o selo some, mas nunca mostra "0" no lugar de "não sei"', async () => {
    await expect(contarAlunosVermelhos(banco(new Error('Supabase (ler últimos treinos): caiu')), TREINADOR, agora)).rejects.toThrow('caiu')
  })
})
