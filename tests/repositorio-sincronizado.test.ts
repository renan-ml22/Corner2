import { describe, expect, it, vi } from 'vitest'
import { criarRepositorioLocal, type ArmazenamentoLike } from '@/lib/dados/repositorio-local'
import { criarRepositorioSincronizado, type EstadoDaSincronia, type RemotoLike } from '@/lib/dados/repositorio-sincronizado'
import type { DadosDoApp } from '@/lib/dados/entidades'

// ── Peças falsas ─────────────────────────────────────────────

class Memoria implements ArmazenamentoLike {
  dados = new Map<string, string>()
  getItem(k: string) { return this.dados.get(k) ?? null }
  setItem(k: string, v: string) { this.dados.set(k, v) }
}

/** Relógio manual: guarda o que foi agendado e só roda quando o teste manda. */
class Agenda {
  tarefas: { fn: () => void; ms: number; ativa: boolean }[] = []
  agendar = (fn: () => void, ms: number) => {
    const t = { fn, ms, ativa: true }
    this.tarefas.push(t)
    return () => { t.ativa = false }
  }
  pendentes() { return this.tarefas.filter(t => t.ativa) }
  async disparar() {
    const lista = this.pendentes()
    lista.forEach(t => { t.ativa = false })
    lista.forEach(t => t.fn())
    await soltar()
  }
}

const soltar = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); await new Promise(r => setTimeout(r, 0)) }

class RemotoFalso implements RemotoLike {
  dados: Partial<DadosDoApp> | null = {}
  envios: Partial<DadosDoApp>[] = []
  cargas = 0
  falhaCarga = false
  falhaEnvio = 0
  travaCarga: Promise<void> | null = null
  travaEnvio: Promise<void> | null = null

  async carregar() {
    this.cargas++
    if (this.travaCarga) await this.travaCarga
    if (this.falhaCarga) throw new Error('sem rede')
    return this.dados === null ? null : structuredClone(this.dados)
  }
  opcoesDosEnvios: ({ keepalive?: boolean } | undefined)[] = []
  async enviar(dados: Partial<DadosDoApp>, opcoes?: { keepalive?: boolean }) {
    this.opcoesDosEnvios.push(opcoes)
    if (this.travaEnvio) await this.travaEnvio
    if (this.falhaEnvio > 0) { this.falhaEnvio--; throw new Error('sem rede') }
    this.envios.push(structuredClone(dados))
    this.dados = { ...this.dados, ...structuredClone(dados) }
  }
}

const treino = (id: string, extra: object = {}) => ({ id, data: '2026-10-10T12:00:00.000Z', tipo: 'tec' as const, rounds: 5, minPorRound: 3, rpe: 6, duracaoSegundos: 900, ...extra })
const peso = (id = 'p1', data = '2026-10-13', kg = 70) => ({ id, data, kg })

function criar(opcoes: { storage?: Memoria; remoto?: RemotoFalso; agenda?: Agenda; usuarioId?: string } = {}) {
  const storage = opcoes.storage ?? new Memoria()
  const remoto = opcoes.remoto ?? new RemotoFalso()
  const agenda = opcoes.agenda ?? new Agenda()
  const usuarioId = opcoes.usuarioId ?? 'u1'
  const local = criarRepositorioLocal({ usuarioId, storage, eventos: null })
  const repo = criarRepositorioSincronizado({ usuarioId, local, remoto, storage, agendar: agenda.agendar })
  const meta = () => JSON.parse(storage.dados.get(`corner:${usuarioId}:sync`) ?? '{"pendentes":[],"ligado":false}') as { pendentes: string[]; ligado: boolean }
  return { repo, local, remoto, agenda, storage, meta }
}

// ── Conta na nuvem desligada ─────────────────────────────────

describe('conta na nuvem desligada (o servidor não tem Supabase configurado)', () => {
  it('o app funciona só com o aparelho: nada é enviado e nada fica pendente', async () => {
    const { repo, remoto, agenda, meta } = criar()
    remoto.dados = null
    await repo.iniciar()
    expect(repo.estadoDaSincronia()).toBe('desligada')
    repo.gravar('pesos', [peso()])
    expect(agenda.pendentes()).toHaveLength(0)
    await agenda.disparar()
    expect(remoto.envios).toEqual([])
    expect(meta().pendentes).toEqual([])
    expect(repo.obter('pesos')).toEqual([peso()])
  })
})

// ── Primeira vez neste aparelho ──────────────────────────────

describe('primeira vez que este aparelho encontra a conta', () => {
  it('conta vazia e aparelho com dados: os dados do aparelho sobem (só as entidades que têm algo)', async () => {
    const { repo, local, remoto, meta } = criar()
    local.gravar('historico', [treino('a')])
    local.gravar('pesos', [peso()])
    await repo.iniciar()
    expect(remoto.envios).toHaveLength(1)
    expect(Object.keys(remoto.envios[0]).sort()).toEqual(['historico', 'pesos'])
    expect(remoto.dados).toMatchObject({ historico: [treino('a')], pesos: [peso()] })
    expect(repo.estadoDaSincronia()).toBe('ok')
    expect(meta()).toEqual({ pendentes: [], ligado: true })
  })

  it('aparelho vazio e conta com dados: os dados da conta descem e nada é enviado', async () => {
    const { repo, local, remoto } = criar()
    remoto.dados = { historico: [treino('a')], config: { metaSemanal: 4 }, plano: { planoId: 'fundamentos', inicio: '2026-10-12' } }
    await repo.iniciar()
    expect(local.obter('historico')).toEqual([treino('a')])
    expect(local.obter('config')).toEqual({ metaSemanal: 4 })
    expect(local.obter('plano')).toEqual({ planoId: 'fundamentos', inicio: '2026-10-12' })
    expect(remoto.envios).toEqual([])
  })

  it('os dois com dados diferentes: funde sem perder nada, guarda o original do aparelho e envia a fusão', async () => {
    const { repo, local, remoto } = criar()
    local.gravar('historico', [treino('local1', { data: '2026-10-12T10:00:00.000Z' })])
    local.gravar('plano', { planoId: 'fundamentos', inicio: '2026-10-05' })
    local.gravar('config', { postura: 'canhoto' })
    remoto.dados = {
      historico: [treino('conta1', { data: '2026-10-11T10:00:00.000Z' })],
      plano: { planoId: 'base-aerobica', inicio: '2026-10-12' },
      config: { metaSemanal: 4 },
    }
    await repo.iniciar()

    expect(local.obter('historico').map(t => t.id)).toEqual(['local1', 'conta1'])
    expect(local.obter('plano')).toEqual({ planoId: 'base-aerobica', inicio: '2026-10-12' })
    expect(local.obter('config')).toEqual({ postura: 'canhoto', metaSemanal: 4 })
    // O que o aparelho tinha antes não se perde: fica na quarentena.
    expect(JSON.parse(local.quarentena('plano')!)).toEqual({ planoId: 'fundamentos', inicio: '2026-10-05' })
    expect(JSON.parse(local.quarentena('historico')!).map((t: { id: string }) => t.id)).toEqual(['local1'])
    expect(JSON.parse(local.quarentena('config')!)).toEqual({ postura: 'canhoto' })
    // Sobe só o que a fusão mudou em relação à conta (o plano já era o da conta).
    expect(Object.keys(remoto.envios[0]).sort()).toEqual(['config', 'historico'])
  })

  it('os dois iguais: nada é guardado na quarentena nem enviado', async () => {
    const { repo, local, remoto } = criar()
    local.gravar('pesos', [peso()])
    remoto.dados = { pesos: [peso()] }
    await repo.iniciar()
    expect(local.quarentena('pesos')).toBeNull()
    expect(remoto.envios).toEqual([])
  })
})

// ── Acessos seguintes ────────────────────────────────────────

describe('acessos seguintes: a conta manda no que não foi alterado neste aparelho', () => {
  it('mudança feita em outro aparelho chega, mesmo quando deixa a lista vazia', async () => {
    const primeiro = criar()
    primeiro.local.gravar('pesos', [peso()])
    await primeiro.repo.iniciar()

    primeiro.remoto.dados = { ...primeiro.remoto.dados, pesos: [] } // outro aparelho apagou tudo
    const segundo = criar({ storage: primeiro.storage, remoto: primeiro.remoto })
    await segundo.repo.iniciar()
    expect(segundo.local.obter('pesos')).toEqual([])
    expect(primeiro.remoto.envios).toHaveLength(1) // só o envio da primeira vez
  })

  it('alteração feita aqui e ainda não enviada vence a conta, e é enviada', async () => {
    const { repo, local, remoto, storage } = criar()
    storage.dados.set('corner:u1:sync', JSON.stringify({ pendentes: ['pesos'], ligado: true }))
    local.gravar('pesos', [peso('novo', '2026-10-14', 68)])
    remoto.dados = { pesos: [] }
    await repo.iniciar()
    expect(local.obter('pesos')).toEqual([peso('novo', '2026-10-14', 68)])
    expect(remoto.envios).toEqual([{ pesos: [peso('novo', '2026-10-14', 68)] }])
  })

  it('a conta sem uma entidade que o aparelho tem: o aparelho sobe a sua', async () => {
    const primeiro = criar()
    await primeiro.repo.iniciar() // marca o aparelho como já ligado à conta
    primeiro.local.gravar('lesoes', [{ id: 'l', regiao: 'ombros', intensidade: 2, inicio: '2026-10-01' }])
    const segundo = criar({ storage: primeiro.storage, remoto: primeiro.remoto })
    await segundo.repo.iniciar()
    expect(Object.keys(primeiro.remoto.envios.at(-1)!)).toEqual(['lesoes'])
  })

  it('conta igual ao aparelho: não regrava nem avisa as telas à toa', async () => {
    const { repo, local, remoto } = criar()
    local.gravar('pesos', [peso()])
    remoto.dados = { pesos: [peso()] }
    const aviso = vi.fn()
    repo.assinar(aviso)
    await repo.iniciar()
    expect(aviso).not.toHaveBeenCalled()
  })
})

// ── Gravar e enviar ──────────────────────────────────────────

describe('gravar neste aparelho', () => {
  it('marca como pendente na hora (sobrevive a fechar o app) e envia depois de uma pausa', async () => {
    const { repo, remoto, agenda, meta } = criar()
    await repo.iniciar()
    repo.gravar('pesos', [peso()])
    expect(repo.estadoDaSincronia()).toBe('pendente')
    expect(meta().pendentes).toEqual(['pesos'])
    expect(remoto.envios).toEqual([])
    expect(agenda.pendentes()).toHaveLength(1)
    expect(agenda.pendentes()[0].ms).toBe(1500)

    await agenda.disparar()
    expect(remoto.envios).toEqual([{ pesos: [peso()] }])
    expect(repo.estadoDaSincronia()).toBe('ok')
    expect(meta().pendentes).toEqual([])
  })

  it('várias gravações seguidas viram um único envio, com o valor mais recente', async () => {
    const { repo, remoto, agenda } = criar()
    await repo.iniciar()
    repo.gravar('pesos', [peso('a')])
    repo.gravar('pesos', [peso('a'), peso('b', '2026-10-14')])
    repo.gravar('config', { metaSemanal: 5 })
    expect(agenda.pendentes()).toHaveLength(1)
    await agenda.disparar()
    expect(remoto.envios).toHaveLength(1)
    expect(remoto.envios[0]).toEqual({ pesos: [peso('a'), peso('b', '2026-10-14')], config: { metaSemanal: 5 } })
  })

  it('só o que é dado do atleta vai para a conta: lembrete e assinatura ficam no aparelho', async () => {
    const { repo, agenda, meta } = criar()
    await repo.iniciar()
    repo.gravar('lembrete', '2026-10-14')
    repo.gravar('assinatura', null)
    expect(agenda.pendentes()).toHaveLength(0)
    expect(meta().pendentes).toEqual([])

    repo.gravarVarias({ lembrete: '2026-10-15', pesos: [peso()] })
    expect(meta().pendentes).toEqual(['pesos'])
  })

  it('importar backup (gravarVarias) marca cada entidade importada', async () => {
    const { repo, remoto, agenda } = criar()
    await repo.iniciar()
    repo.gravarVarias({ historico: [treino('a')], plano: null, checkins: [] })
    await agenda.disparar()
    expect(Object.keys(remoto.envios[0]).sort()).toEqual(['checkins', 'historico', 'plano'])
  })

  it('as telas continuam recebendo aviso de cada gravação', async () => {
    const { repo } = criar()
    await repo.iniciar()
    const aviso = vi.fn()
    repo.assinar(aviso)
    repo.gravar('pesos', [peso()])
    expect(aviso).toHaveBeenCalledTimes(1)
    expect(repo.obter('pesos')).toEqual([peso()])
  })

  it('pendências sobrevivem a fechar e abrir o app: o próximo acesso envia', async () => {
    const primeiro = criar()
    await primeiro.repo.iniciar()
    primeiro.repo.gravar('pesos', [peso()]) // o app fecha antes do envio
    expect(primeiro.remoto.envios).toEqual([])

    const segundo = criar({ storage: primeiro.storage, remoto: primeiro.remoto })
    await segundo.repo.iniciar()
    expect(primeiro.remoto.envios).toEqual([{ pesos: [peso()] }])
  })

  it('gravar enquanto a conta ainda está carregando (primeira vez neste aparelho) funde com a conta: nada se perde', async () => {
    const { repo, local, remoto } = criar()
    let liberar!: () => void
    remoto.travaCarga = new Promise<void>(r => { liberar = r })
    remoto.dados = { pesos: [peso('da-conta', '2026-10-01', 80)] }
    const iniciando = repo.iniciar()
    repo.gravar('pesos', [peso('nova', '2026-10-14', 68)])
    liberar()
    await iniciando
    const esperado = [peso('da-conta', '2026-10-01', 80), peso('nova', '2026-10-14', 68)]
    expect(local.obter('pesos')).toEqual(esperado)
    expect(remoto.dados.pesos).toEqual(esperado)
  })

  it('gravar enquanto a conta carrega, em aparelho já ligado à conta: a alteração local vence e é enviada', async () => {
    const { repo, local, remoto, storage } = criar()
    storage.dados.set('corner:u1:sync', JSON.stringify({ pendentes: [], ligado: true }))
    let liberar!: () => void
    remoto.travaCarga = new Promise<void>(r => { liberar = r })
    remoto.dados = { pesos: [peso('da-conta', '2026-10-01', 80)] }
    const iniciando = repo.iniciar()
    repo.gravar('pesos', [peso('nova', '2026-10-14', 68)])
    liberar()
    await iniciando
    expect(local.obter('pesos')).toEqual([peso('nova', '2026-10-14', 68)])
    expect(remoto.dados.pesos).toEqual([peso('nova', '2026-10-14', 68)])
  })
})

// ── Falhas ───────────────────────────────────────────────────

describe('quando o envio falha', () => {
  it('as pendências ficam guardadas e o app tenta de novo, esperando cada vez mais', async () => {
    const { repo, remoto, agenda, meta } = criar()
    await repo.iniciar()
    remoto.falhaEnvio = 2
    repo.gravar('pesos', [peso()])

    await agenda.disparar()
    expect(repo.estadoDaSincronia()).toBe('pendente')
    expect(meta().pendentes).toEqual(['pesos'])
    expect(agenda.pendentes().map(t => t.ms)).toEqual([5000])

    await agenda.disparar()
    expect(agenda.pendentes().map(t => t.ms)).toEqual([15000])

    await agenda.disparar()
    expect(remoto.envios).toEqual([{ pesos: [peso()] }])
    expect(repo.estadoDaSincronia()).toBe('ok')
    expect(meta().pendentes).toEqual([])
  })

  it('"reenviar agora" (a rede voltou) envia sem esperar o relógio', async () => {
    const { repo, remoto, agenda } = criar()
    await repo.iniciar()
    remoto.falhaEnvio = 1
    repo.gravar('pesos', [peso()])
    await agenda.disparar()
    expect(remoto.envios).toEqual([])

    await repo.reenviarAgora()
    expect(remoto.envios).toEqual([{ pesos: [peso()] }])
    expect(repo.estadoDaSincronia()).toBe('ok')
  })

  it('"reenviar agora" ao fechar a página envia com keepalive (a requisição termina mesmo com a aba sumindo)', async () => {
    const { repo, remoto } = criar()
    await repo.iniciar()
    repo.gravar('pesos', [peso()])
    await repo.reenviarAgora({ aoFechar: true })
    expect(remoto.envios).toEqual([{ pesos: [peso()] }])
    expect(remoto.opcoesDosEnvios.at(-1)).toEqual({ keepalive: true })
  })

  it('o envio normal não usa keepalive', async () => {
    const { repo, remoto, agenda } = criar()
    await repo.iniciar()
    repo.gravar('pesos', [peso()])
    await agenda.disparar()
    expect(remoto.opcoesDosEnvios.at(-1)?.keepalive).toBeFalsy()
  })

  it('gravar durante um envio em andamento não se perde: sai logo depois, com o valor novo', async () => {
    const { repo, remoto, agenda, meta } = criar()
    await repo.iniciar()
    let liberar!: () => void
    remoto.travaEnvio = new Promise<void>(r => { liberar = r })

    repo.gravar('pesos', [peso('a')])
    await agenda.disparar() // o envio começa e fica preso
    repo.gravar('pesos', [peso('a'), peso('b', '2026-10-14')]) // o atleta grava de novo no meio do envio
    liberar()
    await soltar()
    await agenda.disparar()

    expect(remoto.envios.map(e => e.pesos)).toEqual([[peso('a')], [peso('a'), peso('b', '2026-10-14')]])
    expect(meta().pendentes).toEqual([])
    expect(repo.estadoDaSincronia()).toBe('ok')
  })

  it('falha ao carregar a conta: nada do aparelho é tocado, fica pendente e tenta de novo', async () => {
    const { repo, local, remoto, agenda } = criar()
    local.gravar('pesos', [peso()])
    remoto.falhaCarga = true
    remoto.dados = { pesos: [] }
    await repo.iniciar()
    expect(repo.estadoDaSincronia()).toBe('pendente')
    expect(local.obter('pesos')).toEqual([peso()])
    expect(agenda.pendentes().map(t => t.ms)).toEqual([5000])

    remoto.falhaCarga = false
    await agenda.disparar()
    expect(remoto.cargas).toBe(2)
    expect(repo.estadoDaSincronia()).toBe('ok')
  })

  it('o que o servidor devolve é validado: item inválido é descartado e valor irrecuperável é ignorado', async () => {
    const { repo, local, remoto } = criar()
    remoto.dados = { historico: [treino('a'), { lixo: true }], pesos: 'quebrado' } as never
    await repo.iniciar()
    expect(local.obter('historico')).toEqual([treino('a')])
    expect(local.obter('pesos')).toEqual([])
  })
})

// ── Estado e ciclo de vida ───────────────────────────────────

describe('estado da sincronização e ciclo de vida', () => {
  it('quem assina é avisado a cada mudança de estado, e para depois de cancelar', async () => {
    const { repo, agenda } = criar()
    const estados: EstadoDaSincronia[] = []
    const cancelar = repo.assinarSincronia(() => estados.push(repo.estadoDaSincronia()))
    await repo.iniciar()
    repo.gravar('pesos', [peso()])
    await agenda.disparar()
    expect(estados).toEqual(['sincronizando', 'ok', 'pendente', 'sincronizando', 'ok'])

    cancelar()
    repo.gravar('pesos', [])
    expect(estados).toHaveLength(5)
  })

  it('iniciar duas vezes carrega a conta uma vez só', async () => {
    const { repo, remoto } = criar()
    await Promise.all([repo.iniciar(), repo.iniciar()])
    await repo.iniciar()
    expect(remoto.cargas).toBe(1)
  })

  it('parar cancela os relógios, mas as pendências continuam guardadas para o próximo acesso', async () => {
    const { repo, agenda, meta } = criar()
    await repo.iniciar()
    repo.gravar('pesos', [peso()])
    repo.parar()
    expect(agenda.pendentes()).toHaveLength(0)
    expect(meta().pendentes).toEqual(['pesos'])
  })

  it('cada usuário tem a sua própria marcação de pendências', async () => {
    const storage = new Memoria()
    const a = criar({ storage, usuarioId: 'ana' })
    const b = criar({ storage, usuarioId: 'bia' })
    await a.repo.iniciar()
    a.repo.gravar('pesos', [peso()])
    expect(a.meta().pendentes).toEqual(['pesos'])
    expect(b.meta().pendentes).toEqual([])
  })

  it('marcação de pendências corrompida no armazenamento é ignorada, sem derrubar o app', async () => {
    const { repo, storage, remoto } = criar()
    storage.dados.set('corner:u1:sync', '{quebrado')
    await repo.iniciar()
    expect(repo.estadoDaSincronia()).toBe('ok')
    expect(remoto.cargas).toBe(1)
  })

  it('sem armazenamento (navegador bloqueado): a sincronização segue funcionando em memória', async () => {
    const remoto = new RemotoFalso()
    const agenda = new Agenda()
    const local = criarRepositorioLocal({ usuarioId: 'u1', storage: null, eventos: null })
    const repo = criarRepositorioSincronizado({ usuarioId: 'u1', local, remoto, storage: null, agendar: agenda.agendar })
    await repo.iniciar()
    repo.gravar('pesos', [peso()])
    await agenda.disparar()
    expect(remoto.envios).toEqual([{ pesos: [peso()] }])
  })
})
