import { describe, expect, it } from 'vitest'
import { ENTIDADES, NOMES_ENTIDADES, NOMES_NO_BACKUP, type NomeEntidade } from '@/lib/dados/entidades'
import { VERSAO_ESQUEMA, migrar, type Migracao } from '@/lib/dados/esquema'
import { lerBackup, montarBackup, type DadosDoBackup } from '@/lib/dados/backup'

const AGORA = new Date('2026-10-14T15:00:00.000Z')

const treino = () => ({ id: 't1', data: '2026-10-14T12:00:00.000Z', tipo: 'tec' as const, rounds: 4, minPorRound: 3, rpe: 7, duracaoSegundos: 900 })
const dadosCompletos = (): Required<DadosDoBackup> => ({
  historico: [treino()],
  plano: { planoId: 'fundamentos', inicio: '2026-10-05' },
  config: { metaSemanal: 4, postura: 'canhoto' },
  checkins: [{ data: '2026-10-14', sono: 4, dor: 2, energia: 3 }],
  lesoes: [{ id: 'l1', regiao: 'punhos', intensidade: 2, inicio: '2026-10-01' }],
  pesos: [{ id: 'p1', data: '2026-10-14', kg: 70 }],
  reag: { '1:fund-seg': 2 },
})

describe('tabela de entidades', () => {
  it('cada valor inicial é válido para o próprio validador', () => {
    for (const nome of NOMES_ENTIDADES) {
      const e = ENTIDADES[nome]
      expect(e.validar(e.inicial), nome).toBe(true)
    }
  })

  it('o backup leva histórico, plano, config, check-ins, lesões, pesos e reagendamentos', () => {
    expect([...NOMES_NO_BACKUP].sort()).toEqual(['checkins', 'config', 'historico', 'lesoes', 'pesos', 'plano', 'reag'])
  })

  it('o que é só do dia (checklist, ajuste, lembrete), a cópia da assinatura e a foto de perfil não entram no backup', () => {
    for (const nome of ['checklist', 'ajuste', 'lembrete', 'assinatura', 'foto'] as NomeEntidade[]) {
      expect(NOMES_NO_BACKUP).not.toContain(nome)
    }
  })

  it('toda entidade do backup tem mensagem de erro própria', () => {
    for (const nome of NOMES_NO_BACKUP) expect(ENTIDADES[nome].erroBackup, nome).toBeTruthy()
  })

  it('os nomes das chaves não se repetem', () => {
    expect(new Set(NOMES_ENTIDADES).size).toBe(NOMES_ENTIDADES.length)
  })
})

describe('montarBackup', () => {
  it('gera o formato do backup: app, versão, data e dados', () => {
    const json = JSON.parse(montarBackup(dadosCompletos(), AGORA))
    expect(json).toMatchObject({ app: 'corner', versao: VERSAO_ESQUEMA, exportadoEm: AGORA.toISOString() })
    expect(Object.keys(json.dados).sort()).toEqual(['checkins', 'config', 'historico', 'lesoes', 'pesos', 'plano', 'reag'])
  })

  it('ignora o que não entra no backup, mesmo que seja passado', () => {
    const json = JSON.parse(montarBackup({ ...dadosCompletos(), checklist: { data: 'x', itens: {} }, lembrete: '2026-10-14' } as never, AGORA))
    expect(json.dados).not.toHaveProperty('checklist')
    expect(json.dados).not.toHaveProperty('lembrete')
  })

  it('é um JSON legível, com indentação', () => {
    expect(montarBackup(dadosCompletos(), AGORA)).toContain('\n  ')
  })
})

describe('lerBackup', () => {
  it('ida e volta: o que foi exportado é importado igual', () => {
    const r = lerBackup(montarBackup(dadosCompletos(), AGORA))
    expect(r).toEqual({ ok: true, dados: dadosCompletos() })
  })

  it('lê o backup no formato que a versão anterior do app exportava', () => {
    const antigo = JSON.stringify({ app: 'corner', versao: 1, exportadoEm: '2026-10-07T10:00:00.000Z', dados: dadosCompletos() })
    expect(lerBackup(antigo)).toEqual({ ok: true, dados: dadosCompletos() })
  })

  it('backup parcial importa só o que veio (o resto fica como está)', () => {
    const r = lerBackup(JSON.stringify({ app: 'corner', versao: 1, dados: { pesos: dadosCompletos().pesos } }))
    expect(r).toEqual({ ok: true, dados: { pesos: dadosCompletos().pesos } })
  })

  it('ignora entidades desconhecidas e as que não são do backup', () => {
    const r = lerBackup(JSON.stringify({ app: 'corner', versao: 1, dados: { pesos: [], checklist: { data: '', itens: {} }, inventada: 1 } }))
    expect(r).toEqual({ ok: true, dados: { pesos: [] } })
  })

  it('aceita backup sem o campo versao (trata como versão 1)', () => {
    expect(lerBackup(JSON.stringify({ app: 'corner', dados: {} })).ok).toBe(true)
  })

  it.each([
    ['texto que não é JSON', 'isto não é json', 'O arquivo não é um JSON válido.'],
    ['JSON vazio', '', 'O arquivo não é um JSON válido.'],
    ['JSON de outro app', JSON.stringify({ app: 'outro', dados: {} }), 'Este arquivo não é um backup do Corner.'],
    ['array', '[]', 'Este arquivo não é um backup do Corner.'],
    ['número', '42', 'Este arquivo não é um backup do Corner.'],
    ['sem dados', JSON.stringify({ app: 'corner' }), 'Este arquivo não é um backup do Corner.'],
    ['dados que não é objeto', JSON.stringify({ app: 'corner', dados: [] }), 'Este arquivo não é um backup do Corner.'],
  ])('recusa %s', (_nome, texto, erro) => {
    expect(lerBackup(texto)).toEqual({ ok: false, erro })
  })

  it.each([
    ['historico', [{ ...treino(), rpe: 99 }]],
    ['plano', { planoId: 'inexistente', inicio: '2026-10-05' }],
    ['config', { metaSemanal: 50 }],
    ['checkins', [{ data: '2026-02-31', sono: 3, dor: 3, energia: 3 }]],
    ['lesoes', [{ id: 'l', regiao: 'constructor', intensidade: 2, inicio: '2026-10-01' }]],
    ['pesos', [{ id: 'p', data: '2026-10-14', kg: -3 }]],
    ['reag', { x: 9 }],
  ])('recusa backup com %s inválido, com a mensagem daquela entidade', (nome, valor) => {
    const r = lerBackup(JSON.stringify({ app: 'corner', versao: 1, dados: { ...dadosCompletos(), [nome]: valor } }))
    expect(r).toEqual({ ok: false, erro: ENTIDADES[nome as NomeEntidade].erroBackup })
  })

  it('um item ruim recusa o backup inteiro: nada é importado pela metade', () => {
    const r = lerBackup(JSON.stringify({ app: 'corner', versao: 1, dados: { ...dadosCompletos(), pesos: [{ id: 'p', data: 'x', kg: 1 }] } }))
    expect(r.ok).toBe(false)
  })

  it('recusa backup de uma versão mais nova do app, com orientação', () => {
    const r = lerBackup(JSON.stringify({ app: 'corner', versao: VERSAO_ESQUEMA + 1, dados: {} }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/mais nova/)
  })

  it.each([['texto', 'um'], ['zero', 0], ['negativa', -1], ['fracionária', 1.5], ['null', null]])('recusa versão %s', (_nome, versao) => {
    const r = lerBackup(JSON.stringify({ app: 'corner', versao, dados: {} }))
    expect(r.ok).toBe(false)
  })

  describe('migração de backups antigos', () => {
    // Versão 2 fictícia: o campo `kg` dos pesos passou a se chamar `peso`.
    const v1paraV2: Migracao = {
      de: 1,
      migrar: dados => ({ ...dados, pesos: (dados.pesos as { kg: number }[] | undefined)?.map(({ kg, ...resto }) => ({ ...resto, kg: kg * 1000 })) }),
    }

    it('aplica a migração antes de validar', () => {
      const r = lerBackup(
        JSON.stringify({ app: 'corner', versao: 1, dados: { pesos: [{ id: 'p', data: '2026-10-14', kg: 0.07 }] } }),
        { alvo: 2, migracoes: [v1paraV2] },
      )
      expect(r).toEqual({ ok: true, dados: { pesos: [{ id: 'p', data: '2026-10-14', kg: 70 }] } })
    })

    it('valida o resultado da migração: migração que produz dado inválido é recusada', () => {
      const ruim: Migracao = { de: 1, migrar: dados => ({ ...dados, pesos: [{ lixo: true }] }) }
      const r = lerBackup(JSON.stringify({ app: 'corner', versao: 1, dados: { pesos: [] } }), { alvo: 2, migracoes: [ruim] })
      expect(r.ok).toBe(false)
    })
  })
})

describe('migrar', () => {
  const inc = (de: number): Migracao => ({ de, migrar: dados => ({ ...dados, passos: [...((dados.passos as number[]) ?? []), de] }) })

  it('na versão atual devolve os mesmos dados', () => {
    const dados = { a: 1 }
    expect(migrar(dados, 1, { alvo: 1 })).toEqual({ ok: true, dados: { a: 1 } })
  })

  it('encadeia as migrações, em ordem, até a versão alvo', () => {
    const r = migrar({}, 1, { alvo: 4, migracoes: [inc(3), inc(1), inc(2)] })
    expect(r).toEqual({ ok: true, dados: { passos: [1, 2, 3] } })
  })

  it('para na versão alvo, sem aplicar migrações a mais', () => {
    const r = migrar({}, 1, { alvo: 2, migracoes: [inc(1), inc(2)] })
    expect(r).toEqual({ ok: true, dados: { passos: [1] } })
  })

  it('não altera o objeto original', () => {
    const original = { a: 1 }
    migrar(original, 1, { alvo: 2, migracoes: [inc(1)] })
    expect(original).toEqual({ a: 1 })
  })

  it('recusa dados de uma versão mais nova que o app', () => {
    const r = migrar({}, 5, { alvo: 2 })
    expect(r.ok).toBe(false)
  })

  it('recusa quando falta uma migração no caminho', () => {
    const r = migrar({}, 1, { alvo: 3, migracoes: [inc(1)] })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/migra/i)
  })

  it('devolve erro (não lança) quando uma migração falha', () => {
    const quebra: Migracao = { de: 1, migrar: () => { throw new Error('boom') } }
    expect(migrar({}, 1, { alvo: 2, migracoes: [quebra] }).ok).toBe(false)
  })

  it('usa as migrações reais por padrão: hoje a versão atual é a 1 e não há migrações', () => {
    expect(VERSAO_ESQUEMA).toBe(1)
    expect(migrar({ x: 1 }, 1)).toEqual({ ok: true, dados: { x: 1 } })
  })
})
