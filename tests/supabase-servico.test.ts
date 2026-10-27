import { describe, expect, it } from 'vitest'
import {
  ENTIDADES_SINCRONIZADAS, ErroDados, LIMITE_DE_ITENS, carregarDados, salvarEntidades, type BancoLike,
} from '@/lib/dados/servidor/servico'
import type { LinhaPerfil, LinhaPlano, LinhaTreino } from '@/lib/dados/servidor/mapeamento'

/** Banco em memória com a mesma semântica do Supabase: cada usuário só enxerga as próprias linhas. */
class BancoFalso implements BancoLike {
  treinos = new Map<string, LinhaTreino[]>()
  planos = new Map<string, LinhaPlano>()
  perfis = new Map<string, LinhaPerfil>()
  dados = new Map<string, Map<string, unknown>>()
  escritas = 0
  falharEm: string | null = null

  private escrever(nome: string) { if (this.falharEm === nome) throw new Error(`banco indisponível em ${nome}`); this.escritas++ }

  async lerTreinos(u: string) { return structuredClone(this.treinos.get(u) ?? []) }
  async substituirTreinos(u: string, linhas: LinhaTreino[]) { this.escrever('treinos'); this.treinos.set(u, structuredClone(linhas)) }
  async lerPlano(u: string) { return structuredClone(this.planos.get(u) ?? null) }
  async salvarPlano(u: string, linha: LinhaPlano | null) { this.escrever('plano'); if (linha) this.planos.set(u, structuredClone(linha)); else this.planos.delete(u) }
  async lerPerfil(u: string) { return structuredClone(this.perfis.get(u) ?? null) }
  async salvarPerfil(u: string, linha: LinhaPerfil) { this.escrever('perfil'); this.perfis.set(u, structuredClone(linha)) }
  async lerDados(u: string) { return [...(this.dados.get(u) ?? new Map())].map(([entity, value]) => ({ entity, value: structuredClone(value) })) }
  async salvarDado(u: string, entity: string, value: unknown) {
    this.escrever('dado')
    if (!this.dados.has(u)) this.dados.set(u, new Map())
    this.dados.get(u)!.set(entity, structuredClone(value))
  }
}

const treino = (id: string, extra: object = {}) => ({ id, data: '2026-10-10T12:00:00.000Z', tipo: 'tec', rounds: 5, minPorRound: 3, rpe: 6, duracaoSegundos: 900, ...extra })
const renan = { id: 'u_test', nome: 'Renan' }
const outro = { id: 'u_outro', nome: 'Outro' }

const TUDO = {
  historico: [treino('a'), treino('b', { tipo: 'spa', sparring: { intensidade: 'forte', cabeca: 'leves', parceiro: 'Rafa' }, nota: 'ok', sessaoId: 'fun-s1-qua' })],
  plano: { planoId: 'fundamentos', inicio: '2026-10-12' },
  config: { metaSemanal: 4, postura: 'canhoto', experiencia: '1a3', notificacoes: false },
  checkins: [{ data: '2026-10-13', sono: 4, dor: 2, energia: 3 }],
  lesoes: [{ id: 'l1', regiao: 'ombros', intensidade: 3, inicio: '2026-10-01' }],
  pesos: [{ id: 'p1', data: '2026-10-13', kg: 66.4 }],
  reag: { 'fun-s1-qua': 4 },
  checklist: { data: '2026-10-14', itens: { aquecimento: true } },
  ajuste: { data: '2026-10-14', aplicado: true },
  foto: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
}

describe('as entidades que vão para o banco', () => {
  it('são as de dados do atleta; lembrete (do aparelho) e assinatura (cópia do Stripe) ficam de fora', () => {
    expect([...ENTIDADES_SINCRONIZADAS].sort()).toEqual(['ajuste', 'checkins', 'checklist', 'config', 'foto', 'historico', 'lesoes', 'pesos', 'plano', 'reag'])
  })
})

describe('carregar o que nunca foi salvo', () => {
  it('um usuário novo não tem nada (ausente, não "vazio"): o app sabe que deve enviar o que tem no aparelho', async () => {
    expect(await carregarDados(new BancoFalso(), renan.id)).toEqual({})
  })
})

describe('salvar e carregar', () => {
  it('tudo o que o app guarda volta igual', async () => {
    const banco = new BancoFalso()
    await salvarEntidades(banco, renan, TUDO)
    expect(await carregarDados(banco, renan.id)).toEqual(TUDO)
  })

  it('pode salvar só uma entidade; o resto não é tocado', async () => {
    const banco = new BancoFalso()
    await salvarEntidades(banco, renan, TUDO)
    await salvarEntidades(banco, renan, { pesos: [] })
    const dados = await carregarDados(banco, renan.id)
    expect(dados.pesos).toEqual([])
    expect(dados.historico).toEqual(TUDO.historico)
    expect(dados.config).toEqual(TUDO.config)
  })

  it('histórico vazio salvo de propósito volta como vazio (apagou tudo), e não como "ausente"', async () => {
    const banco = new BancoFalso()
    await salvarEntidades(banco, renan, { historico: [treino('a')] })
    await salvarEntidades(banco, renan, { historico: [] })
    expect((await carregarDados(banco, renan.id)).historico).toEqual([])
  })

  it('"sem plano" salvo de propósito volta como null, e não como ausente', async () => {
    const banco = new BancoFalso()
    await salvarEntidades(banco, renan, { plano: TUDO.plano })
    await salvarEntidades(banco, renan, { plano: null })
    const dados = await carregarDados(banco, renan.id)
    expect(dados).toHaveProperty('plano', null)
    expect(banco.planos.has(renan.id)).toBe(false)
  })

  it('foto removida é gravada como texto vazio (nunca nulo) e volta como vazio, não como ausente', async () => {
    const banco = new BancoFalso()
    await salvarEntidades(banco, renan, { foto: TUDO.foto })
    await salvarEntidades(banco, renan, { foto: '' })
    expect(banco.dados.get(renan.id)!.get('foto')).toBe('')
    expect(await carregarDados(banco, renan.id)).toHaveProperty('foto', '')
  })

  it('treino que saiu da lista some do banco; os que ficaram continuam', async () => {
    const banco = new BancoFalso()
    await salvarEntidades(banco, renan, { historico: [treino('a'), treino('b'), treino('c')] })
    await salvarEntidades(banco, renan, { historico: [treino('b')] })
    expect((await carregarDados(banco, renan.id)).historico!.map(t => t.id)).toEqual(['b'])
  })

  it('configuração com campos que o app não conhece: só os conhecidos vão para o banco', async () => {
    const banco = new BancoFalso()
    await salvarEntidades(banco, renan, { config: { metaSemanal: 3, campoInventado: 'x'.repeat(1000), outro: { a: 1 } } })
    expect(banco.perfis.get(renan.id)!.settings).toStrictEqual({ metaSemanal: 3 })
  })

  it('o nome gravado no perfil vem do login, não do pedido', async () => {
    const banco = new BancoFalso()
    await salvarEntidades(banco, renan, { config: { metaSemanal: 3 }, ...({ nome: 'Invasor' } as object) } as never).catch(() => {})
    await salvarEntidades(banco, renan, { config: { metaSemanal: 3 } })
    expect(banco.perfis.get(renan.id)).toMatchObject({ name: 'Renan', days_per_week: 3 })
  })
})

describe('cada usuário só enxerga e altera o que é seu', () => {
  it('dados de um não aparecem para o outro', async () => {
    const banco = new BancoFalso()
    await salvarEntidades(banco, renan, TUDO)
    expect(await carregarDados(banco, outro.id)).toEqual({})
  })

  it('salvar para um não mexe no outro', async () => {
    const banco = new BancoFalso()
    await salvarEntidades(banco, renan, TUDO)
    await salvarEntidades(banco, outro, { historico: [treino('z')], plano: null, config: {}, pesos: [] })
    expect(await carregarDados(banco, renan.id)).toEqual(TUDO)
    expect((await carregarDados(banco, outro.id)).historico!.map(t => t.id)).toEqual(['z'])
  })
})

describe('o que chega de fora é validado antes de gravar qualquer coisa', () => {
  const recusa = async (corpo: unknown, codigo: string, status = 400) => {
    const banco = new BancoFalso()
    const e = await salvarEntidades(banco, renan, corpo).then(() => null, (x: unknown) => x)
    expect(e, JSON.stringify(corpo)).toBeInstanceOf(ErroDados)
    expect(e).toMatchObject({ codigo, status })
    expect(banco.escritas, 'nada pode ter sido gravado').toBe(0)
  }

  it('corpo que não é um objeto', async () => {
    for (const lixo of [null, 'x', 5, [], undefined]) await recusa(lixo, 'pedido_invalido')
  })

  it('objeto vazio (nada para salvar)', async () => { await recusa({}, 'pedido_invalido') })

  it('entidade desconhecida ou que não sincroniza', async () => {
    for (const nome of ['assinatura', 'lembrete', 'inventada', '__proto__']) {
      await recusa({ historico: [treino('a')], [nome]: 'x' }, 'entidade_desconhecida')
    }
  })

  it('valor inválido numa entidade: recusa o pedido inteiro, sem gravar as válidas', async () => {
    await recusa({ pesos: [], historico: [treino('a', { rpe: 99 })] }, 'dado_invalido')
    await recusa({ config: { metaSemanal: 99 } }, 'dado_invalido')
    await recusa({ plano: { planoId: 'nao-existe', inicio: '2026-10-12' } }, 'dado_invalido')
    await recusa({ checkins: 'não é lista' }, 'dado_invalido')
    await recusa({ historico: [treino('a'), treino('a')] }, 'dado_invalido') // ids repetidos
  })

  it('foto que não é JPEG em data URI, é nula ou passa de 60 000 caracteres: recusa o pedido inteiro', async () => {
    const jpeg = 'data:image/jpeg;base64,'
    await recusa({ pesos: [], foto: 'data:image/svg+xml;base64,PHN2Zz4=' }, 'dado_invalido')
    await recusa({ foto: 'javascript:alert(1)' }, 'dado_invalido')
    await recusa({ foto: null }, 'dado_invalido')
    await recusa({ foto: jpeg + 'A'.repeat(60_000) }, 'dado_invalido')
  })

  it(`lista maior que o limite (${LIMITE_DE_ITENS} itens) é recusada com 413`, async () => {
    const muitos = Array.from({ length: LIMITE_DE_ITENS + 1 }, (_, i) => treino(`t${i}`))
    await recusa({ historico: muitos }, 'muito_grande', 413)
  })
})

describe('o que vem do banco também é validado', () => {
  it('treino corrompido no banco é ignorado e os outros aparecem', async () => {
    const banco = new BancoFalso()
    await salvarEntidades(banco, renan, { historico: [treino('a'), treino('b')] })
    banco.treinos.get(renan.id)![0].rpe = 99
    expect((await carregarDados(banco, renan.id)).historico!.map(t => t.id)).toEqual(['b'])
  })

  it('item inválido numa lista genérica é descartado; lista irrecuperável não aparece', async () => {
    const banco = new BancoFalso()
    await salvarEntidades(banco, renan, { checkins: TUDO.checkins, pesos: TUDO.pesos })
    banco.dados.get(renan.id)!.set('checkins', [...TUDO.checkins, { lixo: true }])
    banco.dados.get(renan.id)!.set('pesos', 'quebrado')
    const dados = await carregarDados(banco, renan.id)
    expect(dados.checkins).toEqual(TUDO.checkins)
    expect(dados).not.toHaveProperty('pesos')
  })

  it('foto corrompida no banco não aparece (nem como vazio)', async () => {
    const banco = new BancoFalso()
    await salvarEntidades(banco, renan, { foto: TUDO.foto })
    banco.dados.get(renan.id)!.set('foto', 'data:image/svg+xml;base64,PHN2Zz4=')
    expect(await carregarDados(banco, renan.id)).not.toHaveProperty('foto')
  })

  it('configuração com campo inválido mantém os válidos', async () => {
    const banco = new BancoFalso()
    await salvarEntidades(banco, renan, { config: { metaSemanal: 3, postura: 'canhoto' } })
    banco.perfis.get(renan.id)!.settings = { metaSemanal: 99, postura: 'canhoto' }
    expect((await carregarDados(banco, renan.id)).config).toEqual({ postura: 'canhoto' })
  })

  it('plano que o app não conhece mais vira "sem plano"', async () => {
    const banco = new BancoFalso()
    await salvarEntidades(banco, renan, { plano: TUDO.plano })
    banco.planos.get(renan.id)!.plan_id = 'removido'
    expect(await carregarDados(banco, renan.id)).toHaveProperty('plano', null)
  })
})

describe('falhas do banco', () => {
  it('um erro do banco sobe como erro (a rota responde 502, o app tenta de novo depois)', async () => {
    const banco = new BancoFalso()
    banco.falharEm = 'perfil'
    await expect(salvarEntidades(banco, renan, { config: { metaSemanal: 3 } })).rejects.toThrow('banco indisponível')
  })

  it('regravar o mesmo pedido depois da falha deixa tudo certo (as gravações são idempotentes)', async () => {
    const banco = new BancoFalso()
    banco.falharEm = 'perfil'
    await salvarEntidades(banco, renan, TUDO).catch(() => {})
    banco.falharEm = null
    await salvarEntidades(banco, renan, TUDO)
    expect(await carregarDados(banco, renan.id)).toEqual(TUDO)
  })
})
