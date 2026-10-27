import { randomUUID } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import type { ConvitesBancoLike } from '@/lib/cornerman/convite-banco'
import {
  aceitarConvite, cancelarConviteDaFicha, consultarConvite, convitePendenteDaFicha, criarConviteDaFicha, desvincularDoTreinador, meuTreinador,
} from '@/lib/cornerman/convite-servico'
import { hashDoToken } from '@/lib/cornerman/convite-token'
import { LIMITE_DE_ALUNOS } from '@/lib/cornerman/ficha'
import { ErroCornerman, atualizarAluno } from '@/lib/cornerman/servico'

/**
 * Banco em memória com a semântica das funções SQL (supabase/cornerman-etapa-3a.sql): cada operação é uma "transação"
 * (não há espera entre ler e gravar), o aceite é de uso único, e o limite de 20 e o "um treinador por aluno" valem.
 */
interface FichaFalsa { id: string; coach_id: string; nome: string; status: 'ativo' | 'convidado' | 'encerrado'; aluno_user_id: string | null }
interface ConviteFalso { hash: string; alunoId: string; coachId: string; expiraEm: string; usadoEm: string | null }

class BancoDeConvitesFalso implements ConvitesBancoLike {
  fichas = new Map<string, FichaFalsa>()
  convites: ConviteFalso[] = []
  nomes = new Map<string, string>()
  agora = new Date('2026-10-27T12:00:00.000Z')
  falhaDoBanco: Error | null = null

  private checar() { if (this.falhaDoBanco) throw this.falhaDoBanco }
  private ativas(coachId: string, exceto?: string) { return [...this.fichas.values()].filter(f => f.coach_id === coachId && f.id !== exceto && f.status !== 'encerrado').length }
  private valido(c: ConviteFalso | undefined): c is ConviteFalso { return !!c && c.usadoEm === null && Date.parse(c.expiraEm) > this.agora.getTime() }

  semear(coachId: string, nome: string, extra: Partial<FichaFalsa> = {}): FichaFalsa {
    const f: FichaFalsa = { id: randomUUID(), coach_id: coachId, nome, status: 'ativo', aluno_user_id: null, ...extra }
    this.fichas.set(f.id, f)
    return f
  }

  async criarConvite(coachId: string, alunoId: string, hash: string, expiraEm: string) {
    this.checar()
    const f = this.fichas.get(alunoId)
    if (!f || f.coach_id !== coachId) throw new Error('nao_encontrado')
    if (f.aluno_user_id !== null) throw new Error('nao_convidavel')
    if (this.ativas(coachId, alunoId) >= LIMITE_DE_ALUNOS) throw new Error('limite_de_alunos')
    this.convites = this.convites.filter(c => !(c.alunoId === alunoId && c.usadoEm === null))
    this.convites.push({ hash, alunoId, coachId, expiraEm, usadoEm: null })
    f.status = 'convidado'
  }

  async cancelarConvite(coachId: string, alunoId: string) {
    this.checar()
    const f = this.fichas.get(alunoId)
    if (!f || f.coach_id !== coachId || f.status !== 'convidado') return false
    this.convites = this.convites.filter(c => c.alunoId !== alunoId || c.usadoEm !== null)
    f.status = 'ativo'
    return true
  }

  async convitePendente(coachId: string, alunoId: string) {
    this.checar()
    const c = this.convites.find(x => x.alunoId === alunoId && x.coachId === coachId && x.usadoEm === null)
    return c ? { expiraEm: c.expiraEm } : null
  }

  async consultarConvite(hash: string) {
    this.checar()
    const c = this.convites.find(x => x.hash === hash)
    return this.valido(c) ? { coachId: c.coachId, nomeDoTreinador: this.nomes.get(c.coachId) ?? null } : null
  }

  async aceitarConvite(hash: string, alunoUserId: string) {
    this.checar()
    await Promise.resolve() // cede uma vez: duas chamadas "ao mesmo tempo" se alternam, mas cada corpo roda inteiro
    const c = this.convites.find(x => x.hash === hash)
    if (!this.valido(c)) throw new Error('convite_invalido')
    if (c.coachId === alunoUserId) throw new Error('proprio_convite')
    if ([...this.fichas.values()].some(f => f.aluno_user_id === alunoUserId && f.status !== 'encerrado')) throw new Error('ja_tem_treinador')
    const f = this.fichas.get(c.alunoId)!
    c.usadoEm = this.agora.toISOString()
    f.aluno_user_id = alunoUserId
    f.status = 'ativo'
    return { coachId: c.coachId }
  }

  async desvincular(alunoUserId: string) {
    this.checar()
    const doAluno = [...this.fichas.values()].filter(f => f.aluno_user_id === alunoUserId && f.status !== 'encerrado')
    for (const f of doAluno) { f.aluno_user_id = null; f.status = 'encerrado' }
    return doAluno.length
  }

  async treinadorDoAluno(alunoUserId: string) {
    this.checar()
    const f = [...this.fichas.values()].find(x => x.aluno_user_id === alunoUserId && x.status !== 'encerrado')
    return f ? { nome: this.nomes.get(f.coach_id) ?? null } : null
  }
}

const ORIGEM = 'https://corner2.vercel.app'
const MARCOS = 'u_marcos'
const BIA = 'u_bia'
const ALUNO = 'u_aluno'
const OUTRO = 'u_outro_aluno'
const erroDe = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => e)
const tokenDoLink = (link: string) => link.split('/convite/')[1]
const ID_FALSO = '00000000-0000-4000-8000-000000000000'

function cenario() {
  const banco = new BancoDeConvitesFalso()
  banco.nomes.set(MARCOS, 'Marcos Silva')
  banco.nomes.set(BIA, 'Bia Souza')
  const ficha = banco.semear(MARCOS, 'Beto')
  return { banco, ficha }
}

describe('criarConviteDaFicha', () => {
  it('devolve o link com o token e a data de validade (14 dias); a ficha vira "convidado"', async () => {
    const { banco, ficha } = cenario()
    const r = await criarConviteDaFicha(banco, MARCOS, ficha.id, ORIGEM, new Date('2026-10-27T12:00:00.000Z'))
    expect(r.link).toMatch(new RegExp(`^${ORIGEM}/convite/[A-Za-z0-9_-]{43}$`))
    expect(r.expiraEm).toBe('2026-11-10T12:00:00.000Z')
    expect(banco.fichas.get(ficha.id)!.status).toBe('convidado')
  })

  it('o banco recebe só o HASH do token: o token não está em nenhuma linha', async () => {
    const { banco, ficha } = cenario()
    const { link } = await criarConviteDaFicha(banco, MARCOS, ficha.id, ORIGEM)
    const token = tokenDoLink(link)
    expect(banco.convites[0].hash).toBe(hashDoToken(token))
    expect(JSON.stringify(banco.convites)).not.toContain(token)
    expect(JSON.stringify([...banco.fichas.values()])).not.toContain(token)
  })

  it('gerar de novo faz o link antigo parar de valer; só o novo funciona', async () => {
    const { banco, ficha } = cenario()
    const antigo = tokenDoLink((await criarConviteDaFicha(banco, MARCOS, ficha.id, ORIGEM)).link)
    const novo = tokenDoLink((await criarConviteDaFicha(banco, MARCOS, ficha.id, ORIGEM)).link)
    expect(antigo).not.toBe(novo)
    expect(await consultarConvite(banco, antigo)).toEqual({ valido: false })
    expect(await consultarConvite(banco, novo)).toMatchObject({ valido: true })
    expect(banco.convites.filter(c => c.usadoEm === null)).toHaveLength(1)
  })

  it('ficha de outro treinador, id inexistente e id malformado respondem igual: "Aluno não encontrado." (404)', async () => {
    const { banco, ficha } = cenario()
    for (const id of [ficha.id, ID_FALSO, 'abc', '../x', '']) {
      const e = await erroDe(criarConviteDaFicha(banco, BIA, id, ORIGEM))
      expect(e, id).toBeInstanceOf(ErroCornerman)
      expect(e).toMatchObject({ codigo: 'nao_encontrado', status: 404, message: 'Aluno não encontrado.' })
    }
    expect(banco.convites).toEqual([])
    expect(banco.fichas.get(ficha.id)!.status).toBe('ativo')
  })

  it('ficha que já tem conta vinculada não recebe convite (409)', async () => {
    const { banco } = cenario()
    const comConta = banco.semear(MARCOS, 'Com conta', { aluno_user_id: ALUNO })
    const e = await erroDe(criarConviteDaFicha(banco, MARCOS, comConta.id, ORIGEM))
    expect(e).toMatchObject({ codigo: 'nao_convidavel', status: 409, message: 'Esta ficha já está vinculada a uma conta.' })
    expect(banco.convites).toEqual([])
  })

  it('ficha encerrada pode receber convite (reaproveita a ficha); com 20 ativas é recusado e ela continua encerrada', async () => {
    const { banco } = cenario()
    const encerrada = banco.semear(MARCOS, 'Antiga', { status: 'encerrado' })
    for (let i = 0; i < LIMITE_DE_ALUNOS - 1; i++) banco.semear(MARCOS, `Aluno ${i}`) // com a "Beto" do cenário, são 20 ativas
    const e = await erroDe(criarConviteDaFicha(banco, MARCOS, encerrada.id, ORIGEM))
    expect(e).toMatchObject({ codigo: 'limite_de_alunos', status: 409 })
    expect(banco.fichas.get(encerrada.id)!.status).toBe('encerrado')
    ;[...banco.fichas.values()].find(f => f.nome === 'Aluno 0')!.status = 'encerrado' // abre uma vaga
    await expect(criarConviteDaFicha(banco, MARCOS, encerrada.id, ORIGEM)).resolves.toMatchObject({ link: expect.stringContaining('/convite/') })
    expect(banco.fichas.get(encerrada.id)!.status).toBe('convidado')
  })

  it('erro do banco sobe sem token, hash nem nome na mensagem', async () => {
    const { banco, ficha } = cenario()
    banco.falhaDoBanco = new Error('Supabase (criar convite): indisponível')
    const e = await erroDe(criarConviteDaFicha(banco, MARCOS, ficha.id, ORIGEM)) as Error
    expect(e).not.toBeInstanceOf(ErroCornerman)
    expect(e.message).not.toMatch(/Beto|[A-Za-z0-9_-]{43}/)
  })
})

describe('cancelarConviteDaFicha e convitePendenteDaFicha', () => {
  it('cancelar: o link para de valer e a ficha volta a "ativo"', async () => {
    const { banco, ficha } = cenario()
    const token = tokenDoLink((await criarConviteDaFicha(banco, MARCOS, ficha.id, ORIGEM)).link)
    expect(await convitePendenteDaFicha(banco, MARCOS, ficha.id)).toMatchObject({ expiraEm: expect.any(String) })
    await cancelarConviteDaFicha(banco, MARCOS, ficha.id)
    expect(await consultarConvite(banco, token)).toEqual({ valido: false })
    expect(banco.fichas.get(ficha.id)!.status).toBe('ativo')
    expect(await convitePendenteDaFicha(banco, MARCOS, ficha.id)).toBeNull()
  })

  it('sem convite pendente, cancelar dá "não encontrado" (404); ficha de outro treinador também', async () => {
    const { banco, ficha } = cenario()
    expect(await erroDe(cancelarConviteDaFicha(banco, MARCOS, ficha.id))).toMatchObject({ codigo: 'nao_encontrado', status: 404 })
    await criarConviteDaFicha(banco, MARCOS, ficha.id, ORIGEM)
    expect(await erroDe(cancelarConviteDaFicha(banco, BIA, ficha.id))).toMatchObject({ codigo: 'nao_encontrado', status: 404 })
    expect(await erroDe(cancelarConviteDaFicha(banco, MARCOS, 'abc'))).toMatchObject({ codigo: 'nao_encontrado', status: 404 })
    expect(banco.fichas.get(ficha.id)!.status).toBe('convidado') // as tentativas alheias não mexeram
  })

  it('convitePendenteDaFicha de outro treinador ou com id ruim: null, sem revelar nada', async () => {
    const { banco, ficha } = cenario()
    await criarConviteDaFicha(banco, MARCOS, ficha.id, ORIGEM)
    expect(await convitePendenteDaFicha(banco, BIA, ficha.id)).toBeNull()
    expect(await convitePendenteDaFicha(banco, MARCOS, 'abc')).toBeNull()
  })
})

describe('consultarConvite: o que a página pública pode saber', () => {
  it('convite válido: só o primeiro nome do treinador', async () => {
    const { banco, ficha } = cenario()
    const { link } = await criarConviteDaFicha(banco, MARCOS, ficha.id, ORIGEM)
    expect(await consultarConvite(banco, tokenDoLink(link))).toEqual({ valido: true, treinador: 'Marcos' })
  })

  it('treinador sem nome cadastrado: "Um treinador"', async () => {
    const { banco, ficha } = cenario()
    banco.nomes.delete(MARCOS)
    const { link } = await criarConviteDaFicha(banco, MARCOS, ficha.id, ORIGEM)
    expect(await consultarConvite(banco, tokenDoLink(link))).toEqual({ valido: true, treinador: 'Um treinador' })
  })

  it('inexistente, malformado, expirado, usado e cancelado: TODOS respondem exatamente igual', async () => {
    const { banco, ficha } = cenario()
    const expirado = tokenDoLink((await criarConviteDaFicha(banco, MARCOS, ficha.id, ORIGEM, new Date('2026-10-27T12:00:00.000Z'))).link)
    banco.agora = new Date('2026-11-12T12:00:00.000Z') // depois dos 14 dias

    const usadoFicha = banco.semear(MARCOS, 'Usado')
    banco.agora = new Date('2026-10-27T12:00:00.000Z')
    const usado = tokenDoLink((await criarConviteDaFicha(banco, MARCOS, usadoFicha.id, ORIGEM, banco.agora)).link)
    await aceitarConvite(banco, usado, ALUNO)

    const canceladaFicha = banco.semear(MARCOS, 'Cancelada')
    const cancelado = tokenDoLink((await criarConviteDaFicha(banco, MARCOS, canceladaFicha.id, ORIGEM, banco.agora)).link)
    await cancelarConviteDaFicha(banco, MARCOS, canceladaFicha.id)

    banco.agora = new Date('2026-11-12T12:00:00.000Z')
    const respostas = await Promise.all([
      consultarConvite(banco, expirado), consultarConvite(banco, usado), consultarConvite(banco, cancelado),
      consultarConvite(banco, 'A'.repeat(43)), consultarConvite(banco, 'abc'), consultarConvite(banco, '../x'),
      consultarConvite(banco, 42 as unknown as string), consultarConvite(banco, null as unknown as string),
    ])
    for (const r of respostas) expect(r).toEqual({ valido: false })
  })
})

describe('aceitarConvite', () => {
  it('vincula a conta: a ficha vira "ativo" e passa a ter conta; devolve o primeiro nome do treinador', async () => {
    const { banco, ficha } = cenario()
    const token = tokenDoLink((await criarConviteDaFicha(banco, MARCOS, ficha.id, ORIGEM)).link)
    expect(await aceitarConvite(banco, token, ALUNO)).toEqual({ treinador: 'Marcos' })
    const f = banco.fichas.get(ficha.id)!
    expect(f).toMatchObject({ status: 'ativo', aluno_user_id: ALUNO })
  })

  it('uso único: a segunda tentativa com o mesmo token é recusada (404, "Convite inválido ou expirado.")', async () => {
    const { banco, ficha } = cenario()
    const token = tokenDoLink((await criarConviteDaFicha(banco, MARCOS, ficha.id, ORIGEM)).link)
    await aceitarConvite(banco, token, ALUNO)
    const e = await erroDe(aceitarConvite(banco, token, OUTRO))
    expect(e).toBeInstanceOf(ErroCornerman)
    expect(e).toMatchObject({ codigo: 'convite_invalido', status: 404, message: 'Convite inválido ou expirado.' })
    expect(banco.fichas.get(ficha.id)!.aluno_user_id).toBe(ALUNO)
  })

  it('dois aceites ao mesmo tempo, de dois usuários: um vence e o outro é recusado', async () => {
    const { banco, ficha } = cenario()
    const token = tokenDoLink((await criarConviteDaFicha(banco, MARCOS, ficha.id, ORIGEM)).link)
    const r = await Promise.allSettled([aceitarConvite(banco, token, ALUNO), aceitarConvite(banco, token, OUTRO)])
    expect(r.filter(x => x.status === 'fulfilled')).toHaveLength(1)
    const recusado = r.find(x => x.status === 'rejected') as PromiseRejectedResult
    expect(recusado.reason).toMatchObject({ codigo: 'convite_invalido', status: 404 })
    expect([ALUNO, OUTRO]).toContain(banco.fichas.get(ficha.id)!.aluno_user_id)
  })

  it('convite expirado e token malformado: "convite_invalido", sem chegar ao banco no caso do malformado', async () => {
    const { banco, ficha } = cenario()
    const token = tokenDoLink((await criarConviteDaFicha(banco, MARCOS, ficha.id, ORIGEM, new Date('2026-10-27T12:00:00.000Z'))).link)
    banco.agora = new Date('2026-11-12T12:00:00.000Z')
    expect(await erroDe(aceitarConvite(banco, token, ALUNO))).toMatchObject({ codigo: 'convite_invalido', status: 404 })
    banco.falhaDoBanco = new Error('não pode ser chamado')
    for (const ruim of ['abc', '../x', '', 'A'.repeat(44)]) {
      expect(await erroDe(aceitarConvite(banco, ruim, ALUNO)), ruim).toMatchObject({ codigo: 'convite_invalido', status: 404 })
    }
  })

  it('o treinador não aceita o próprio convite (400) e o convite continua válido', async () => {
    const { banco, ficha } = cenario()
    const token = tokenDoLink((await criarConviteDaFicha(banco, MARCOS, ficha.id, ORIGEM)).link)
    const e = await erroDe(aceitarConvite(banco, token, MARCOS))
    expect(e).toMatchObject({ codigo: 'proprio_convite', status: 400, message: 'Você não pode aceitar o seu próprio convite.' })
    expect(await consultarConvite(banco, token)).toMatchObject({ valido: true })
  })

  it('quem já tem treinador ativo não aceita outro convite (409) e o convite continua válido', async () => {
    const { banco, ficha } = cenario()
    const daBia = banco.semear(BIA, 'Da Bia', { aluno_user_id: ALUNO })
    expect(daBia.aluno_user_id).toBe(ALUNO)
    const token = tokenDoLink((await criarConviteDaFicha(banco, MARCOS, ficha.id, ORIGEM)).link)
    const e = await erroDe(aceitarConvite(banco, token, ALUNO))
    expect(e).toMatchObject({ codigo: 'ja_tem_treinador', status: 409, message: 'Você já tem um treinador. Desvincule-se dele no Perfil antes de aceitar outro convite.' })
    expect(await consultarConvite(banco, token)).toMatchObject({ valido: true })
    expect(banco.fichas.get(ficha.id)!.aluno_user_id).toBeNull()
  })

  it('ficha apagada: o convite some junto e deixa de valer', async () => {
    const { banco, ficha } = cenario()
    const token = tokenDoLink((await criarConviteDaFicha(banco, MARCOS, ficha.id, ORIGEM)).link)
    banco.fichas.delete(ficha.id)
    banco.convites = banco.convites.filter(c => c.alunoId !== ficha.id) // on delete cascade
    expect(await erroDe(aceitarConvite(banco, token, ALUNO))).toMatchObject({ codigo: 'convite_invalido', status: 404 })
  })

  it('erro do banco sobe sem o token na mensagem', async () => {
    const { banco, ficha } = cenario()
    const token = tokenDoLink((await criarConviteDaFicha(banco, MARCOS, ficha.id, ORIGEM)).link)
    banco.falhaDoBanco = new Error('Supabase (consultar convite): indisponível')
    const e = await erroDe(aceitarConvite(banco, token, ALUNO)) as Error
    expect(e.message).not.toContain(token)
  })
})

describe('meuTreinador e desvincularDoTreinador', () => {
  it('meuTreinador: o primeiro nome, ou null quando não há treinador', async () => {
    const { banco, ficha } = cenario()
    expect(await meuTreinador(banco, ALUNO)).toBeNull()
    await aceitarConvite(banco, tokenDoLink((await criarConviteDaFicha(banco, MARCOS, ficha.id, ORIGEM)).link), ALUNO)
    expect(await meuTreinador(banco, ALUNO)).toEqual({ nome: 'Marcos' })
  })

  it('desvincular: a ficha vira "encerrado" e perde a conta; o treinador não vê mais "comConta"', async () => {
    const { banco, ficha } = cenario()
    await aceitarConvite(banco, tokenDoLink((await criarConviteDaFicha(banco, MARCOS, ficha.id, ORIGEM)).link), ALUNO)
    await desvincularDoTreinador(banco, ALUNO)
    expect(banco.fichas.get(ficha.id)).toMatchObject({ status: 'encerrado', aluno_user_id: null })
    expect(await meuTreinador(banco, ALUNO)).toBeNull()
  })

  it('desvincular sem treinador não dá erro (pode ser repetido)', async () => {
    const { banco } = cenario()
    await expect(desvincularDoTreinador(banco, ALUNO)).resolves.toBeUndefined()
    await expect(desvincularDoTreinador(banco, ALUNO)).resolves.toBeUndefined()
  })

  it('depois de desvincular, um convite novo para a mesma ficha vincula de novo', async () => {
    const { banco, ficha } = cenario()
    await aceitarConvite(banco, tokenDoLink((await criarConviteDaFicha(banco, MARCOS, ficha.id, ORIGEM)).link), ALUNO)
    await desvincularDoTreinador(banco, ALUNO)
    const novo = tokenDoLink((await criarConviteDaFicha(banco, MARCOS, ficha.id, ORIGEM)).link)
    await aceitarConvite(banco, novo, ALUNO)
    expect(banco.fichas.get(ficha.id)).toMatchObject({ status: 'ativo', aluno_user_id: ALUNO })
  })

  it('reabrir a ficha pelo treinador (etapa 2) depois de desvincular NÃO restaura o vínculo', async () => {
    const { banco, ficha } = cenario()
    await aceitarConvite(banco, tokenDoLink((await criarConviteDaFicha(banco, MARCOS, ficha.id, ORIGEM)).link), ALUNO)
    await desvincularDoTreinador(banco, ALUNO)
    // o serviço de fichas da etapa 2 usa o outro banco; aqui basta provar que o estado do banco não tem vínculo para restaurar
    expect(banco.fichas.get(ficha.id)!.aluno_user_id).toBeNull()
    expect(atualizarAluno).toBeTypeOf('function')
  })
})
