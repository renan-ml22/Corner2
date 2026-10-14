import { describe, expect, it, vi } from 'vitest'
import { criarRepositorioLocal, type ArmazenamentoLike, type EventosLike } from '@/lib/dados/repositorio-local'
import { ENTIDADES, NOMES_ENTIDADES } from '@/lib/dados/entidades'
import type { Migracao } from '@/lib/dados/esquema'

// ── Armazenamento falso ──────────────────────────────────────

class Memoria implements ArmazenamentoLike {
  dados = new Map<string, string>()
  falharLeitura = false
  falharGravacao = false
  getItem(k: string) {
    if (this.falharLeitura) throw new Error('bloqueado')
    return this.dados.get(k) ?? null
  }
  setItem(k: string, v: string) {
    if (this.falharGravacao) throw new Error('sem espaço')
    this.dados.set(k, v)
  }
}

class Eventos implements EventosLike {
  ouvintes = new Set<() => void>()
  addEventListener(_t: 'storage', cb: () => void) { this.ouvintes.add(cb) }
  removeEventListener(_t: 'storage', cb: () => void) { this.ouvintes.delete(cb) }
  disparar() { this.ouvintes.forEach(cb => cb()) }
}

function criar(parcial: Partial<Parameters<typeof criarRepositorioLocal>[0]> = {}) {
  const storage = new Memoria()
  const eventos = new Eventos()
  const repo = criarRepositorioLocal({ usuarioId: 'u1', storage, eventos, ...parcial })
  return { repo, storage, eventos }
}

const treino = (id = 't1') => ({ id, data: '2026-10-14T12:00:00.000Z', tipo: 'tec' as const, rounds: 4, minPorRound: 3, rpe: 7, duracaoSegundos: 900 })
const peso = (id = 'p1') => ({ id, data: '2026-10-14', kg: 70 })

describe('leitura', () => {
  it('sem nada salvo, devolve o valor inicial (mesma referência, para o snapshot ficar estável)', () => {
    const { repo } = criar()
    for (const nome of NOMES_ENTIDADES) expect(repo.obter(nome), nome).toBe(ENTIDADES[nome].inicial)
  })

  it('lê dados no formato que a versão anterior do app gravou (mesmas chaves, JSON puro, sem versão)', () => {
    const { repo, storage } = criar()
    const legado = {
      historico: [treino()],
      plano: { planoId: 'fundamentos', inicio: '2026-10-05' },
      config: { metaSemanal: 4 },
      checklist: { data: '2026-10-14', itens: { 'a:0': true } },
      checkins: [{ data: '2026-10-14', sono: 4, dor: 2, energia: 3 }],
      lesoes: [{ id: 'l1', regiao: 'punhos', intensidade: 2, inicio: '2026-10-01' }],
      pesos: [peso()],
      ajuste: { data: '2026-10-14', aplicado: true },
      reag: { '1:fund-seg': 2 },
      lembrete: '2026-10-14',
    }
    for (const [nome, valor] of Object.entries(legado)) {
      storage.dados.set(`corner:u1:${nome}`, JSON.stringify(valor))
    }
    for (const nome of NOMES_ENTIDADES) expect(repo.obter(nome), nome).toEqual(legado[nome])
  })

  it('devolve a mesma referência enquanto nada muda e uma nova quando o dado muda', () => {
    const { repo } = criar()
    repo.gravar('pesos', [peso()])
    const a = repo.obter('pesos')
    expect(repo.obter('pesos')).toBe(a)
    repo.gravar('pesos', [peso(), peso('p2')])
    expect(repo.obter('pesos')).not.toBe(a)
    expect(repo.obter('pesos')).toHaveLength(2)
  })

  it('gravar uma entidade não muda a referência das outras', () => {
    const { repo } = criar()
    repo.gravar('pesos', [peso()])
    const historico = repo.obter('historico')
    const checkins = repo.obter('checkins')
    repo.gravar('pesos', [])
    expect(repo.obter('historico')).toBe(historico)
    expect(repo.obter('checkins')).toBe(checkins)
  })

  it('cada usuário enxerga só os próprios dados', () => {
    const storage = new Memoria()
    const a = criarRepositorioLocal({ usuarioId: 'u1', storage, eventos: new Eventos() })
    const b = criarRepositorioLocal({ usuarioId: 'u2', storage, eventos: new Eventos() })
    a.gravar('pesos', [peso()])
    expect(b.obter('pesos')).toEqual([])
    expect(a.obter('pesos')).toHaveLength(1)
  })

  it('JSON corrompido vira o valor inicial, sem lançar', () => {
    const { repo, storage } = criar()
    storage.dados.set('corner:u1:historico', '{isto não é json')
    expect(repo.obter('historico')).toBe(ENTIDADES.historico.inicial)
  })

  it('valor de tipo errado e irrecuperável vira o valor inicial', () => {
    const { repo, storage } = criar()
    storage.dados.set('corner:u1:plano', '123')
    storage.dados.set('corner:u1:reag', '{"x":99}')
    expect(repo.obter('plano')).toBeNull()
    expect(repo.obter('reag')).toEqual({})
  })

  it('lista com um item ruim aproveita os bons (um registro corrompido não esconde o histórico inteiro)', () => {
    const { repo, storage } = criar()
    storage.dados.set('corner:u1:historico', JSON.stringify([treino('a'), { lixo: true }, treino('b')]))
    expect(repo.obter('historico').map(t => t.id)).toEqual(['a', 'b'])
  })

  it('configuração com um campo inválido mantém os outros', () => {
    const { repo, storage } = criar()
    storage.dados.set('corner:u1:config', JSON.stringify({ metaSemanal: 5, postura: 'southpaw' }))
    expect(repo.obter('config')).toEqual({ metaSemanal: 5 })
  })

  it('ler não altera o que está salvo', () => {
    const { repo, storage } = criar()
    const bruto = JSON.stringify([treino('a'), { lixo: true }])
    storage.dados.set('corner:u1:historico', bruto)
    repo.obter('historico')
    expect(storage.dados.get('corner:u1:historico')).toBe(bruto)
  })

  it('armazenamento bloqueado na leitura devolve o valor inicial, sem lançar', () => {
    const { repo, storage } = criar()
    storage.falharLeitura = true
    expect(repo.obter('historico')).toBe(ENTIDADES.historico.inicial)
  })

  it('sem armazenamento disponível (servidor), devolve o valor inicial e aceita gravar sem lançar', () => {
    const repo = criarRepositorioLocal({ usuarioId: 'u1', storage: null })
    expect(repo.obter('pesos')).toEqual([])
    expect(() => repo.gravar('pesos', [peso()])).not.toThrow()
    expect(repo.obter('pesos')).toHaveLength(1)
  })
})

describe('gravação', () => {
  it('grava JSON puro na mesma chave que o app sempre usou', () => {
    const { repo, storage } = criar()
    repo.gravar('pesos', [peso()])
    expect(JSON.parse(storage.dados.get('corner:u1:pesos')!)).toEqual([peso()])
  })

  it('o que foi gravado volta igual', () => {
    const { repo } = criar()
    repo.gravar('historico', [treino()])
    repo.gravar('plano', { planoId: 'fundamentos', inicio: '2026-10-05' })
    expect(repo.obter('historico')).toEqual([treino()])
    expect(repo.obter('plano')).toEqual({ planoId: 'fundamentos', inicio: '2026-10-05' })
  })

  it('gravarVarias grava todas as entidades de uma vez', () => {
    const { repo } = criar()
    repo.gravarVarias({ pesos: [peso()], reag: { 'a:b': 3 } })
    expect(repo.obter('pesos')).toHaveLength(1)
    expect(repo.obter('reag')).toEqual({ 'a:b': 3 })
  })

  it('sem espaço ou armazenamento bloqueado: não lança e o app segue funcionando em memória', () => {
    const { repo, storage } = criar()
    storage.falharGravacao = true
    expect(() => repo.gravar('pesos', [peso()])).not.toThrow()
    expect(repo.obter('pesos')).toHaveLength(1)
    repo.gravar('pesos', [peso(), peso('p2')])
    expect(repo.obter('pesos')).toHaveLength(2)
  })

  it('uma mudança vinda de outra aba prevalece sobre o que ficou só em memória', () => {
    const { repo, storage } = criar()
    storage.falharGravacao = true
    repo.gravar('pesos', [peso()])
    storage.falharGravacao = false
    storage.dados.set('corner:u1:pesos', JSON.stringify([peso('x'), peso('y'), peso('z')]))
    expect(repo.obter('pesos')).toHaveLength(3)
  })
})

describe('quarentena (nunca apagar dado antigo em silêncio)', () => {
  it('guarda o original antes de sobrescrever um valor que tinha itens inválidos', () => {
    const { repo, storage } = criar()
    const bruto = JSON.stringify([treino('a'), { lixo: true }])
    storage.dados.set('corner:u1:historico', bruto)
    repo.gravar('historico', [treino('a'), treino('novo')])
    expect(storage.dados.get('corner:u1:historico:quarentena')).toBe(bruto)
    expect(repo.quarentena('historico')).toBe(bruto)
  })

  it('guarda também um JSON corrompido', () => {
    const { repo, storage } = criar()
    storage.dados.set('corner:u1:pesos', '{quebrado')
    repo.gravar('pesos', [peso()])
    expect(repo.quarentena('pesos')).toBe('{quebrado')
  })

  it('não cria quarentena quando o valor anterior era válido, nem quando não havia nada', () => {
    const { repo, storage } = criar()
    repo.gravar('pesos', [peso()])
    repo.gravar('pesos', [peso(), peso('p2')])
    expect(storage.dados.has('corner:u1:pesos:quarentena')).toBe(false)
    expect(repo.quarentena('pesos')).toBeNull()
  })

  it('uma gravação válida depois não apaga a quarentena existente', () => {
    const { repo, storage } = criar()
    storage.dados.set('corner:u1:pesos', '{quebrado')
    repo.gravar('pesos', [peso()])
    repo.gravar('pesos', [peso(), peso('p2')])
    expect(repo.quarentena('pesos')).toBe('{quebrado')
  })
})

describe('assinatura', () => {
  it('avisa quem assinou quando uma entidade é gravada, e para depois de cancelar', () => {
    const { repo } = criar()
    const cb = vi.fn()
    const cancelar = repo.assinar(cb)
    repo.gravar('pesos', [peso()])
    expect(cb).toHaveBeenCalledTimes(1)
    cancelar()
    repo.gravar('pesos', [])
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('gravarVarias avisa uma única vez', () => {
    const { repo } = criar()
    const cb = vi.fn()
    repo.assinar(cb)
    repo.gravarVarias({ pesos: [peso()], reag: {}, config: {} })
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('avisa quando outra aba muda o armazenamento (evento storage)', () => {
    const { repo, eventos } = criar()
    const cb = vi.fn()
    repo.assinar(cb)
    eventos.disparar()
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('cancelar a última assinatura remove o ouvinte de eventos', () => {
    const { repo, eventos } = criar()
    const cancelar = repo.assinar(() => {})
    expect(eventos.ouvintes.size).toBe(1)
    cancelar()
    expect(eventos.ouvintes.size).toBe(0)
  })

  it('vários assinantes recebem o aviso', () => {
    const { repo } = criar()
    const a = vi.fn(); const b = vi.fn()
    repo.assinar(a); repo.assinar(b)
    repo.gravar('reag', {})
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })
})

describe('versão do esquema', () => {
  // Versão 2 fictícia: pesos passam a ser guardados em gramas.
  const emGramas: Migracao = {
    de: 1,
    migrar: dados => ({ ...dados, pesos: (dados.pesos as { kg: number }[] | undefined)?.map(p => ({ ...p, kg: p.kg * 1000 })) }),
  }

  it('grava a versão atual na primeira gravação', () => {
    const { repo, storage } = criar()
    repo.gravar('pesos', [])
    expect(storage.dados.get('corner:u1:esquema')).toBe('1')
  })

  it('dados antigos, sem versão gravada, são tratados como versão 1 e migrados ao ler', () => {
    const { repo, storage } = criar({ alvo: 2, migracoes: [emGramas] })
    storage.dados.set('corner:u1:pesos', JSON.stringify([{ id: 'p1', data: '2026-10-14', kg: 0.07 }]))
    expect(repo.obter('pesos')).toEqual([{ id: 'p1', data: '2026-10-14', kg: 70 }])
    expect(storage.dados.get('corner:u1:esquema')).toBe('2')
    expect(JSON.parse(storage.dados.get('corner:u1:pesos')!)[0].kg).toBe(70)
  })

  it('migra uma única vez: ao reabrir já está na versão nova', () => {
    const storage = new Memoria()
    storage.dados.set('corner:u1:pesos', JSON.stringify([{ id: 'p1', data: '2026-10-14', kg: 0.07 }]))
    const opcoes = { usuarioId: 'u1', storage, eventos: new Eventos(), alvo: 2, migracoes: [emGramas] }
    criarRepositorioLocal(opcoes).obter('pesos')
    expect(criarRepositorioLocal(opcoes).obter('pesos')[0].kg).toBe(70) // não virou 70000
  })

  it('migração que falha deixa os dados como estavam e não marca a versão nova', () => {
    const quebra: Migracao = { de: 1, migrar: () => { throw new Error('boom') } }
    const { repo, storage } = criar({ alvo: 2, migracoes: [quebra] })
    const bruto = JSON.stringify([peso()])
    storage.dados.set('corner:u1:pesos', bruto)
    expect(() => repo.obter('pesos')).not.toThrow()
    expect(storage.dados.get('corner:u1:pesos')).toBe(bruto)
    expect(storage.dados.has('corner:u1:esquema')).toBe(false)
  })

  it('dados de uma versão mais nova que o app não são migrados nem rebaixados', () => {
    const { repo, storage } = criar()
    storage.dados.set('corner:u1:esquema', '99')
    repo.gravar('pesos', [peso()])
    expect(storage.dados.get('corner:u1:esquema')).toBe('99')
  })

  it('versão gravada ilegível é tratada como versão 1', () => {
    const { repo, storage } = criar()
    storage.dados.set('corner:u1:esquema', 'abc')
    repo.gravar('pesos', [peso()])
    expect(storage.dados.get('corner:u1:esquema')).toBe('1')
  })
})
