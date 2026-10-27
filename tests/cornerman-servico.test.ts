import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { AlunosBancoLike, LinhaDeAluno } from '@/lib/cornerman/banco'
import { LIMITE_DE_ALUNOS, type DadosDaFicha } from '@/lib/cornerman/ficha'
import { ErroCornerman, apagarAluno, atualizarAluno, criarAluno, lerAluno, listarAlunos } from '@/lib/cornerman/servico'

/**
 * Banco em memória com a semântica do real: cada treinador só enxerga as próprias linhas, e o limite de 20 é aplicado
 * como o gatilho do SQL faz (ao inserir ou atualizar uma linha que não esteja encerrada).
 */
class BancoDeAlunosFalso implements AlunosBancoLike {
  linhas = new Map<string, LinhaDeAluno>()
  falhaDoBanco: Error | null = null
  escritas = 0
  relogio = 0

  private tick() { return new Date(Date.UTC(2026, 9, 27, 12, 0, this.relogio++)).toISOString() }
  private checar() { if (this.falhaDoBanco) throw this.falhaDoBanco }
  private ativas(coachId: string, exceto?: string) {
    return [...this.linhas.values()].filter(l => l.coach_id === coachId && l.id !== exceto && l.status !== 'encerrado').length
  }

  async listar(coachId: string) { this.checar(); return [...this.linhas.values()].filter(l => l.coach_id === coachId).map(l => ({ ...l })) }
  async obter(coachId: string, id: string) {
    this.checar()
    const l = this.linhas.get(id)
    return l && l.coach_id === coachId ? { ...l } : null
  }
  async inserir(coachId: string, dados: DadosDaFicha) {
    this.checar()
    if (this.ativas(coachId) >= LIMITE_DE_ALUNOS) throw new Error('limite_de_alunos')
    const agora = this.tick()
    const linha: LinhaDeAluno = { id: randomUUID(), coach_id: coachId, ...dados, aluno_user_id: null, status: 'ativo', created_at: agora, updated_at: agora }
    this.escritas++
    this.linhas.set(linha.id, linha)
    return { ...linha }
  }
  async atualizar(coachId: string, id: string, campos: Record<string, unknown>) {
    this.checar()
    const atual = this.linhas.get(id)
    if (!atual || atual.coach_id !== coachId) return null
    if (campos.status && campos.status !== 'encerrado' && this.ativas(coachId, id) >= LIMITE_DE_ALUNOS) throw new Error('limite_de_alunos')
    const nova = { ...atual, ...campos, updated_at: this.tick() } as LinhaDeAluno
    this.escritas++
    this.linhas.set(id, nova)
    return { ...nova }
  }
  async apagar(coachId: string, id: string) {
    this.checar()
    const l = this.linhas.get(id)
    if (!l || l.coach_id !== coachId) return false
    this.escritas++
    return this.linhas.delete(id)
  }
}

const ANA = 'u_ana'
const BIA = 'u_bia'
const naoEncontrado = { codigo: 'nao_encontrado', status: 404, message: 'Aluno não encontrado.' }
const COLUNAS_DA_FICHA = ['atualizadoEm', 'comConta', 'criadoEm', 'email', 'estilo', 'foto', 'id', 'nivel', 'nome', 'notas', 'status', 'telefone']

const erroDe = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e)

describe('criarAluno', () => {
  it('cria a ficha como ativa, sem conta, e devolve só os campos da ficha (nada de coach_id)', async () => {
    const banco = new BancoDeAlunosFalso()
    const f = await criarAluno(banco, ANA, { nome: '  Beto ', email: 'beto@exemplo.com', nivel: 'avancado', notas: 'canhoto' })
    expect(Object.keys(f).sort()).toEqual(COLUNAS_DA_FICHA)
    expect(f).toMatchObject({ nome: 'Beto', email: 'beto@exemplo.com', nivel: 'avancado', notas: 'canhoto', status: 'ativo', comConta: false, telefone: null, estilo: null, foto: '' })
    expect(f.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(Date.parse(f.criadoEm)).not.toBeNaN()
    expect(banco.linhas.get(f.id)!.coach_id).toBe(ANA)
  })

  it('corpo inválido: 400, "dado_invalido", e nada é gravado', async () => {
    const banco = new BancoDeAlunosFalso()
    for (const corpo of [{}, { nome: '' }, { nome: 'A', coach_id: BIA }, { nome: 'A', status: 'convidado' }, null, 'x']) {
      const e = await erroDe(criarAluno(banco, ANA, corpo))
      expect(e, JSON.stringify(corpo)).toBeInstanceOf(ErroCornerman)
      expect(e).toMatchObject({ codigo: 'dado_invalido', status: 400 })
    }
    expect(banco.escritas).toBe(0)
  })

  it('a 21ª ficha é recusada com 409 e texto próprio; a lista continua com 20', async () => {
    const banco = new BancoDeAlunosFalso()
    for (let i = 0; i < 20; i++) await criarAluno(banco, ANA, { nome: `Aluno ${i}` })
    const e = await erroDe(criarAluno(banco, ANA, { nome: 'Aluno 21' }))
    expect(e).toBeInstanceOf(ErroCornerman)
    expect(e).toMatchObject({ codigo: 'limite_de_alunos', status: 409, message: 'Você já tem 20 alunos. Encerre ou apague uma ficha para cadastrar outro.' })
    expect((await listarAlunos(banco, ANA)).alunos).toHaveLength(20)
  })

  it('o limite é por treinador: outro treinador cadastra normalmente', async () => {
    const banco = new BancoDeAlunosFalso()
    for (let i = 0; i < 20; i++) await criarAluno(banco, ANA, { nome: `Aluno ${i}` })
    await expect(criarAluno(banco, BIA, { nome: 'Do outro treinador' })).resolves.toMatchObject({ status: 'ativo' })
  })

  it('ficha encerrada não conta no limite', async () => {
    const banco = new BancoDeAlunosFalso()
    const fichas = []
    for (let i = 0; i < 20; i++) fichas.push(await criarAluno(banco, ANA, { nome: `Aluno ${i}` }))
    await atualizarAluno(banco, ANA, fichas[0].id, { status: 'encerrado' })
    await expect(criarAluno(banco, ANA, { nome: 'Cabe agora' })).resolves.toBeDefined()
  })

  it('erro do banco que não é o limite sobe sem os dados da ficha', async () => {
    const banco = new BancoDeAlunosFalso()
    banco.falhaDoBanco = new Error('Supabase (gravar aluno): indisponível')
    const e = await erroDe(criarAluno(banco, ANA, { nome: 'Nome Identificável', email: 'segredo@exemplo.com', telefone: '11 99999-0000', notas: 'nota secreta' })) as Error
    expect(e).not.toBeInstanceOf(ErroCornerman)
    for (const dado of ['Nome Identificável', 'segredo@exemplo.com', '99999-0000', 'nota secreta']) expect(e.message).not.toContain(dado)
  })
})

describe('listarAlunos', () => {
  it('treinador sem fichas: lista vazia, 0 de 20', async () => {
    expect(await listarAlunos(new BancoDeAlunosFalso(), ANA)).toEqual({ alunos: [], ativos: 0, limite: 20 })
  })

  it('ativos primeiro, em ordem alfabética sem diferenciar maiúsculas e acentos; depois os encerrados', async () => {
    const banco = new BancoDeAlunosFalso()
    const nomes = ['beto', 'Ávila', 'carlos', 'Zeca', 'Abel']
    const fichas = []
    for (const nome of nomes) fichas.push(await criarAluno(banco, ANA, { nome }))
    await atualizarAluno(banco, ANA, fichas[0].id, { status: 'encerrado' }) // beto
    await atualizarAluno(banco, ANA, fichas[4].id, { status: 'encerrado' }) // Abel
    const r = await listarAlunos(banco, ANA)
    expect(r.alunos.map(a => a.nome)).toEqual(['Ávila', 'carlos', 'Zeca', 'Abel', 'beto'])
    expect(r.ativos).toBe(3)
  })

  it('um treinador não enxerga as fichas do outro', async () => {
    const banco = new BancoDeAlunosFalso()
    await criarAluno(banco, ANA, { nome: 'Da Ana' })
    await criarAluno(banco, BIA, { nome: 'Da Bia' })
    expect((await listarAlunos(banco, ANA)).alunos.map(a => a.nome)).toEqual(['Da Ana'])
    expect((await listarAlunos(banco, BIA)).alunos.map(a => a.nome)).toEqual(['Da Bia'])
  })

  it('linha com status ou nível fora do esperado não quebra a lista (vira ativo e sem nível)', async () => {
    const banco = new BancoDeAlunosFalso()
    const f = await criarAluno(banco, ANA, { nome: 'Estranho' })
    Object.assign(banco.linhas.get(f.id)!, { status: 'lixo', nivel: 'campeao' })
    const [a] = (await listarAlunos(banco, ANA)).alunos
    expect(a).toMatchObject({ status: 'ativo', nivel: null })
  })
})

describe('isolamento: a ficha de outro treinador, um id que não existe e um id malformado respondem igual', () => {
  const casos = async () => {
    const banco = new BancoDeAlunosFalso()
    const daBia = await criarAluno(banco, BIA, { nome: 'Da Bia', notas: 'privado' })
    return { banco, ids: [daBia.id, randomUUID(), 'abc', '../x', '', "x'; drop table coach_alunos;--"] }
  }

  it('ler', async () => {
    const { banco, ids } = await casos()
    for (const id of ids) expect(await erroDe(lerAluno(banco, ANA, id)), id).toMatchObject(naoEncontrado)
  })

  it('atualizar não altera nada', async () => {
    const { banco, ids } = await casos()
    const antes = JSON.stringify([...banco.linhas.values()])
    for (const id of ids) expect(await erroDe(atualizarAluno(banco, ANA, id, { notas: 'invasão' })), id).toMatchObject(naoEncontrado)
    expect(JSON.stringify([...banco.linhas.values()])).toBe(antes)
  })

  it('apagar não apaga', async () => {
    const { banco, ids } = await casos()
    for (const id of ids) expect(await erroDe(apagarAluno(banco, ANA, id)), id).toMatchObject(naoEncontrado)
    expect(banco.linhas.size).toBe(1)
  })

  it('a ficha continua inteira para o dono', async () => {
    const { banco, ids } = await casos()
    expect(await lerAluno(banco, BIA, ids[0])).toMatchObject({ nome: 'Da Bia', notas: 'privado' })
  })

  it('o erro de "não encontrado" não revela se o id existe: é o mesmo objeto de erro, com a mesma mensagem', async () => {
    const { banco, ids } = await casos()
    const [dele, inexistente] = [await erroDe(lerAluno(banco, ANA, ids[0])), await erroDe(lerAluno(banco, ANA, ids[1]))]
    expect(dele).toMatchObject({ codigo: (inexistente as ErroCornerman).codigo, status: (inexistente as ErroCornerman).status, message: (inexistente as ErroCornerman).message })
  })
})

describe('atualizarAluno', () => {
  it('muda só os campos enviados e avança a data de atualização', async () => {
    const banco = new BancoDeAlunosFalso()
    const f = await criarAluno(banco, ANA, { nome: 'Beto', email: 'beto@exemplo.com', notas: 'antes' })
    const depois = await atualizarAluno(banco, ANA, f.id, { notas: 'depois' })
    expect(depois).toMatchObject({ nome: 'Beto', email: 'beto@exemplo.com', notas: 'depois' })
    expect(Date.parse(depois.atualizadoEm)).toBeGreaterThan(Date.parse(f.atualizadoEm))
    expect(depois.criadoEm).toBe(f.criadoEm)
  })

  it('limpar um campo opcional manda nulo', async () => {
    const banco = new BancoDeAlunosFalso()
    const f = await criarAluno(banco, ANA, { nome: 'Beto', email: 'beto@exemplo.com' })
    expect((await atualizarAluno(banco, ANA, f.id, { email: '' })).email).toBeNull()
  })

  it('encerrar e reabrir', async () => {
    const banco = new BancoDeAlunosFalso()
    const f = await criarAluno(banco, ANA, { nome: 'Beto' })
    expect((await atualizarAluno(banco, ANA, f.id, { status: 'encerrado' })).status).toBe('encerrado')
    expect((await atualizarAluno(banco, ANA, f.id, { status: 'ativo' })).status).toBe('ativo')
  })

  it('reabrir com 20 ativas é recusado (409) e a ficha continua encerrada', async () => {
    const banco = new BancoDeAlunosFalso()
    const encerrada = await criarAluno(banco, ANA, { nome: 'Encerrada' })
    await atualizarAluno(banco, ANA, encerrada.id, { status: 'encerrado' })
    for (let i = 0; i < 20; i++) await criarAluno(banco, ANA, { nome: `Aluno ${i}` })
    const e = await erroDe(atualizarAluno(banco, ANA, encerrada.id, { status: 'ativo' }))
    expect(e).toMatchObject({ codigo: 'limite_de_alunos', status: 409 })
    expect((await lerAluno(banco, ANA, encerrada.id)).status).toBe('encerrado')
  })

  it('editar os dados de uma ficha ativa com 20 ativas continua permitido', async () => {
    const banco = new BancoDeAlunosFalso()
    const fichas = []
    for (let i = 0; i < 20; i++) fichas.push(await criarAluno(banco, ANA, { nome: `Aluno ${i}` }))
    await expect(atualizarAluno(banco, ANA, fichas[3].id, { notas: 'ok' })).resolves.toMatchObject({ notas: 'ok' })
  })

  it('campos que não podem vir do navegador e status "convidado" são recusados sem gravar', async () => {
    const banco = new BancoDeAlunosFalso()
    const f = await criarAluno(banco, ANA, { nome: 'Beto' })
    const escritas = banco.escritas
    for (const corpo of [{ coach_id: BIA }, { aluno_user_id: 'x' }, { status: 'convidado' }, { id: 'x' }, {}, { notas: 'a', extra: 1 }]) {
      expect(await erroDe(atualizarAluno(banco, ANA, f.id, corpo)), JSON.stringify(corpo)).toMatchObject({ codigo: 'dado_invalido', status: 400 })
    }
    expect(banco.escritas).toBe(escritas)
    expect(banco.linhas.get(f.id)!.coach_id).toBe(ANA)
  })
})

describe('status com convite e vínculo (etapa 3a)', () => {
  const comEstado = async (banco: BancoDeAlunosFalso, extra: Partial<LinhaDeAluno>) => {
    const f = await criarAluno(banco, ANA, { nome: 'Beto' })
    Object.assign(banco.linhas.get(f.id)!, extra)
    return f
  }

  it('ficha em "convidado": mudar o status é recusado (409, "convite_pendente") e nada é gravado', async () => {
    const banco = new BancoDeAlunosFalso()
    const f = await comEstado(banco, { status: 'convidado' })
    const escritas = banco.escritas
    for (const status of ['ativo', 'encerrado']) {
      const e = await erroDe(atualizarAluno(banco, ANA, f.id, { status }))
      expect(e, status).toBeInstanceOf(ErroCornerman)
      expect(e).toMatchObject({ codigo: 'convite_pendente', status: 409, message: 'Cancele o convite antes de mudar o status da ficha.' })
    }
    expect(banco.escritas).toBe(escritas)
    expect(banco.linhas.get(f.id)!.status).toBe('convidado')
  })

  it('ficha em "convidado" aceita editar os outros campos, e as notas', async () => {
    const banco = new BancoDeAlunosFalso()
    const f = await comEstado(banco, { status: 'convidado' })
    expect(await atualizarAluno(banco, ANA, f.id, { notas: 'x', estilo: 'Pressão' })).toMatchObject({ notas: 'x', estilo: 'Pressão', status: 'convidado' })
  })

  it('encerrar uma ficha com conta limpa o vínculo (o treinador perde o acesso)', async () => {
    const banco = new BancoDeAlunosFalso()
    const f = await comEstado(banco, { aluno_user_id: 'u_aluno' })
    expect(f.comConta).toBe(false) // a ficha criada antes de fabricar a linha
    expect((await lerAluno(banco, ANA, f.id)).comConta).toBe(true)
    const encerrada = await atualizarAluno(banco, ANA, f.id, { status: 'encerrado' })
    expect(encerrada).toMatchObject({ status: 'encerrado', comConta: false })
    expect(banco.linhas.get(f.id)!.aluno_user_id).toBeNull()
  })

  it('reabrir uma ficha que já teve conta NÃO restaura o vínculo', async () => {
    const banco = new BancoDeAlunosFalso()
    const f = await comEstado(banco, { aluno_user_id: 'u_aluno' })
    await atualizarAluno(banco, ANA, f.id, { status: 'encerrado' })
    const reaberta = await atualizarAluno(banco, ANA, f.id, { status: 'ativo' })
    expect(reaberta).toMatchObject({ status: 'ativo', comConta: false })
    expect(banco.linhas.get(f.id)!.aluno_user_id).toBeNull()
  })

  it('encerrar uma ficha sem conta continua como antes (não manda aluno_user_id)', async () => {
    const banco = new BancoDeAlunosFalso()
    const f = await criarAluno(banco, ANA, { nome: 'Beto' })
    const camposEnviados: Record<string, unknown>[] = []
    const original = banco.atualizar.bind(banco)
    banco.atualizar = async (c, id, campos) => { camposEnviados.push(campos); return original(c, id, campos) }
    await atualizarAluno(banco, ANA, f.id, { status: 'encerrado' })
    expect(camposEnviados).toEqual([{ status: 'encerrado' }])
  })

  it('o bloqueio vale só para quem é dono: ficha de outro treinador continua dando "não encontrado"', async () => {
    const banco = new BancoDeAlunosFalso()
    const daBia = await criarAluno(banco, BIA, { nome: 'Da Bia' })
    Object.assign(banco.linhas.get(daBia.id)!, { status: 'convidado' })
    expect(await erroDe(atualizarAluno(banco, ANA, daBia.id, { status: 'ativo' }))).toMatchObject(naoEncontrado)
  })
})

describe('apagarAluno', () => {
  it('apaga de verdade; ler depois e apagar de novo dão "não encontrado"', async () => {
    const banco = new BancoDeAlunosFalso()
    const f = await criarAluno(banco, ANA, { nome: 'Beto' })
    await apagarAluno(banco, ANA, f.id)
    expect(await erroDe(lerAluno(banco, ANA, f.id))).toMatchObject(naoEncontrado)
    expect(await erroDe(apagarAluno(banco, ANA, f.id))).toMatchObject(naoEncontrado)
  })

  it('apagar libera a vaga', async () => {
    const banco = new BancoDeAlunosFalso()
    const fichas = []
    for (let i = 0; i < 20; i++) fichas.push(await criarAluno(banco, ANA, { nome: `Aluno ${i}` }))
    await apagarAluno(banco, ANA, fichas[0].id)
    await expect(criarAluno(banco, ANA, { nome: 'Novo' })).resolves.toBeDefined()
  })
})
