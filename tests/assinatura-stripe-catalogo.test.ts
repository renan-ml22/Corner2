import { describe, expect, it } from 'vitest'
import { NIVEIS, PERIODOS, lookupKey, precoEmCentavos } from '@/lib/assinatura/catalogo'
import {
  configuracaoDoPortal, descricaoDoNivel, exigirChaveDeTeste, planejar, precosDesejados, produtosDesejados,
  type PrecoExistente, type ProdutoExistente,
} from '@/lib/assinatura/stripe-catalogo'

const produto = (nivel: string, parcial: Partial<ProdutoExistente> = {}): ProdutoExistente => {
  const d = produtosDesejados().find(p => p.nivel === nivel)!
  return { id: `prod_${nivel}`, active: true, name: d.nome, description: d.descricao, metadata: { corner_nivel: nivel }, ...parcial }
}
const preco = (chave: string, parcial: Partial<PrecoExistente> = {}): PrecoExistente => {
  const d = precosDesejados().find(p => p.chave === chave)!
  return {
    id: `price_${chave}`, active: true, lookup_key: chave, unit_amount: d.centavos, currency: 'brl',
    product: `prod_${d.nivel}`, recurring: { interval: d.intervalo, interval_count: 1 }, ...parcial,
  }
}
const tudoCerto = () => ({ produtos: NIVEIS.map(n => produto(n)), precos: precosDesejados().map(p => preco(p.chave)) })

describe('o que deve existir no Stripe', () => {
  it('3 produtos, um por nível, com nome "Corner <Nível>"', () => {
    const ps = produtosDesejados()
    expect(ps.map(p => p.nivel)).toEqual([...NIVEIS])
    expect(ps.map(p => p.nome)).toEqual(['Corner Iniciante', 'Corner Amador', 'Corner Profissional'])
  })

  it('6 preços, em BRL, com os valores do catálogo', () => {
    const ps = precosDesejados()
    expect(ps).toHaveLength(6)
    for (const n of NIVEIS) {
      for (const periodo of PERIODOS) {
        const p = ps.find(x => x.chave === lookupKey(n, periodo))!
        expect(p.centavos).toBe(precoEmCentavos(n, periodo))
        expect(p.intervalo).toBe(periodo === 'mensal' ? 'month' : 'year')
      }
    }
    expect(ps.find(p => p.chave === 'iniciante_mensal')!.centavos).toBe(3990)
    expect(ps.find(p => p.chave === 'profissional_anual')!.centavos).toBe(69900)
  })

  it('a descrição de cada nível lista o que ele acrescenta e cita o nível anterior', () => {
    expect(descricaoDoNivel('iniciante')).toContain('Biblioteca técnica')
    expect(descricaoDoNivel('iniciante')).toContain('Tudo do plano gratuito')
    expect(descricaoDoNivel('iniciante')).not.toContain('Cronômetro')
    expect(descricaoDoNivel('amador')).toContain('Tudo do Iniciante')
    expect(descricaoDoNivel('amador')).toContain('Check-in diário')
    expect(descricaoDoNivel('profissional')).toContain('Tudo do Amador')
    expect(descricaoDoNivel('profissional')).toContain('Pré-competição')
  })
})

describe('planejar: o que falta criar', () => {
  it('conta vazia: cria tudo (3 produtos e 6 preços), sem transferir chaves', () => {
    const p = planejar([], [])
    expect(p.produtos.criar).toHaveLength(3)
    expect(p.precos.criar).toHaveLength(6)
    expect(p.precos.criar.every(x => x.transferir === false)).toBe(true)
    expect(p.precos.arquivar).toEqual([])
    expect(p.semMudancas).toBe(false)
  })

  it('tudo já criado: nada a fazer (rodar duas vezes não duplica)', () => {
    const p = planejar(tudoCerto().produtos, tudoCerto().precos)
    expect(p.produtos.criar).toHaveLength(0)
    expect(p.produtos.atualizar).toHaveLength(0)
    expect(p.precos.criar).toHaveLength(0)
    expect(p.precos.arquivar).toHaveLength(0)
    expect(p.semMudancas).toBe(true)
  })

  it('falta só um produto: cria só ele e os preços dele', () => {
    const { produtos, precos } = tudoCerto()
    const p = planejar(produtos.filter(x => x.metadata.corner_nivel !== 'amador'), precos.filter(x => !x.lookup_key!.startsWith('amador')))
    expect(p.produtos.criar.map(x => x.nivel)).toEqual(['amador'])
    expect(p.precos.criar.map(x => x.chave).sort()).toEqual(['amador_anual', 'amador_mensal'])
  })

  it('falta só um preço: cria só ele', () => {
    const { produtos, precos } = tudoCerto()
    const p = planejar(produtos, precos.filter(x => x.lookup_key !== 'profissional_anual'))
    expect(p.produtos.criar).toHaveLength(0)
    expect(p.precos.criar.map(x => x.chave)).toEqual(['profissional_anual'])
  })

  it('produto com nome ou descrição diferente: atualiza (não cria outro)', () => {
    const { produtos, precos } = tudoCerto()
    produtos[0] = { ...produtos[0], name: 'Nome antigo' }
    const p = planejar(produtos, precos)
    expect(p.produtos.criar).toHaveLength(0)
    expect(p.produtos.atualizar).toEqual([{ id: 'prod_iniciante', nivel: 'iniciante', nome: 'Corner Iniciante', descricao: produtosDesejados()[0].descricao }])
  })

  it('produto arquivado não conta: cria um novo', () => {
    const { produtos, precos } = tudoCerto()
    produtos[1] = { ...produtos[1], active: false }
    expect(planejar(produtos, precos).produtos.criar.map(x => x.nivel)).toEqual(['amador'])
  })

  it('produtos que não são do Corner (sem metadata) são ignorados', () => {
    const { produtos, precos } = tudoCerto()
    const p = planejar([...produtos, { id: 'prod_outro', active: true, name: 'Camiseta', description: null, metadata: {} }], precos)
    expect(p.semMudancas).toBe(true)
  })
})

describe('planejar: preço com valor errado', () => {
  it('valor diferente: cria o preço novo transferindo a chave e arquiva o antigo', () => {
    const { produtos, precos } = tudoCerto()
    const i = precos.findIndex(x => x.lookup_key === 'amador_anual')
    precos[i] = { ...precos[i], unit_amount: 58190 }
    const p = planejar(produtos, precos)
    expect(p.precos.criar).toEqual([expect.objectContaining({ chave: 'amador_anual', centavos: 52900, transferir: true })])
    expect(p.precos.arquivar).toEqual(['price_amador_anual'])
  })

  it('período errado (mensal no lugar de anual): troca', () => {
    const { produtos, precos } = tudoCerto()
    const i = precos.findIndex(x => x.lookup_key === 'iniciante_anual')
    precos[i] = { ...precos[i], recurring: { interval: 'month', interval_count: 1 } }
    expect(planejar(produtos, precos).precos.criar.map(x => x.chave)).toEqual(['iniciante_anual'])
  })

  it('moeda errada: troca', () => {
    const { produtos, precos } = tudoCerto()
    precos[0] = { ...precos[0], currency: 'usd' }
    expect(planejar(produtos, precos).precos.arquivar).toEqual([precos[0].id])
  })

  it('preço ligado ao produto errado: troca', () => {
    const { produtos, precos } = tudoCerto()
    precos[0] = { ...precos[0], product: 'prod_amador' }
    expect(planejar(produtos, precos).precos.criar.map(x => x.chave)).toEqual([precos[0].lookup_key])
  })

  it('preço inativo com a mesma chave é ignorado: cria um novo', () => {
    const { produtos, precos } = tudoCerto()
    precos[2] = { ...precos[2], active: false }
    const p = planejar(produtos, precos)
    expect(p.precos.criar.map(x => x.chave)).toEqual([precos[2].lookup_key])
    expect(p.precos.arquivar).toEqual([])
  })

  it('preço de outro produto qualquer (sem nossa chave) não é tocado', () => {
    const { produtos, precos } = tudoCerto()
    const p = planejar(produtos, [...precos, { id: 'price_x', active: true, lookup_key: 'camiseta_mensal', unit_amount: 100, currency: 'brl', product: 'prod_x', recurring: null }])
    expect(p.semMudancas).toBe(true)
  })

  it('não altera as listas recebidas', () => {
    const { produtos, precos } = tudoCerto()
    const copia = JSON.parse(JSON.stringify({ produtos, precos }))
    planejar(produtos, precos)
    expect({ produtos, precos }).toEqual(copia)
  })
})

describe('exigirChaveDeTeste (o script nunca toca em conta real)', () => {
  it('aceita sk_test_', () => {
    expect(() => exigirChaveDeTeste('sk_test_abc123')).not.toThrow()
  })

  it.each(['sk_live_abc123', 'rk_live_abc', 'pk_test_abc', '', undefined, 'abc'])('recusa %s', chave => {
    expect(() => exigirChaveDeTeste(chave)).toThrow(/teste/i)
  })

  it('a mensagem de erro não repete a chave recebida', () => {
    try { exigirChaveDeTeste('sk_live_SEGREDO123') } catch (e) { expect(String(e)).not.toContain('SEGREDO123') }
  })
})

describe('configuracaoDoPortal', () => {
  const produtos = { iniciante: 'prod_i', amador: 'prod_a', profissional: 'prod_p' } as const
  const precos = Object.fromEntries(precosDesejados().map(p => [p.chave, `price_${p.chave}`]))
  const cfg = configuracaoDoPortal(produtos, precos)

  it('a pessoa pode cancelar (no fim do período), atualizar o cartão e ver as faturas', () => {
    expect(cfg.features.subscription_cancel).toMatchObject({ enabled: true, mode: 'at_period_end' })
    expect(cfg.features.payment_method_update.enabled).toBe(true)
    expect(cfg.features.invoice_history.enabled).toBe(true)
  })

  it('pode trocar de plano entre os 3 produtos, com os 2 preços de cada um', () => {
    const troca = cfg.features.subscription_update
    expect(troca.enabled).toBe(true)
    expect(troca.default_allowed_updates).toContain('price')
    expect(troca.products).toHaveLength(3)
    for (const p of troca.products) expect(p.prices).toHaveLength(2)
    expect(troca.products.find(p => p.product === 'prod_a')!.prices.sort()).toEqual(['price_amador_anual', 'price_amador_mensal'])
  })

  it('não deixa trocar a quantidade (a assinatura é pessoal: uma por pessoa)', () => {
    for (const p of cfg.features.subscription_update.products) expect(p.adjustable_quantity).toEqual({ enabled: false })
  })

  it('a troca de plano cobra a diferença proporcional', () => {
    expect(cfg.features.subscription_update.proration_behavior).toBe('create_prorations')
  })

  it('marca a configuração como do Corner (para achá-la de novo sem duplicar)', () => {
    expect(cfg.metadata.corner).toBe('1')
  })
})
