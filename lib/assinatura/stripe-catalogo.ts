// O que deve existir no Stripe (produtos, preços e Portal do Cliente) e o plano de ação para chegar lá.
// Puro: não chama o Stripe. Quem executa o plano é scripts/stripe-sincronizar.ts.
// Rodar duas vezes não duplica nada: `planejar` compara o que já existe com o que o catálogo pede.

import {
  NIVEIS, NOME_DO_NIVEL, PERIODOS, RECURSOS, lookupKey, precoEmCentavos, recurso,
  type NivelAssinatura, type Periodo,
} from './catalogo'

export interface ProdutoDesejado {
  nivel: NivelAssinatura
  nome: string
  descricao: string
}

export interface PrecoDesejado {
  chave: string
  nivel: NivelAssinatura
  periodo: Periodo
  centavos: number
  intervalo: 'month' | 'year'
}

/** Lista o que o nível acrescenta em relação ao anterior, para a descrição do produto. */
export function descricaoDoNivel(nivel: NivelAssinatura): string {
  const novos = (Object.keys(RECURSOS) as (keyof typeof RECURSOS)[])
    .filter(id => recurso(id).nivelMinimo === nivel && !recurso(id).semAssinatura)
    .map(id => recurso(id).nome)
  const anterior = NIVEIS[NIVEIS.indexOf(nivel) - 1]
  return [anterior ? `Tudo do ${NOME_DO_NIVEL[anterior]}` : null, ...novos].filter(Boolean).join(' · ')
}

export const produtosDesejados = (): ProdutoDesejado[] =>
  NIVEIS.map(nivel => ({ nivel, nome: `Corner ${NOME_DO_NIVEL[nivel]}`, descricao: descricaoDoNivel(nivel) }))

export const precosDesejados = (): PrecoDesejado[] =>
  NIVEIS.flatMap(nivel => PERIODOS.map(periodo => ({
    chave: lookupKey(nivel, periodo),
    nivel,
    periodo,
    centavos: precoEmCentavos(nivel, periodo),
    intervalo: periodo === 'mensal' ? ('month' as const) : ('year' as const),
  })))

// ── O que já existe no Stripe (só os campos de que precisamos) ──

export interface ProdutoExistente {
  id: string
  active: boolean
  name: string
  description?: string | null
  metadata: Record<string, string>
}

export interface PrecoExistente {
  id: string
  active: boolean
  lookup_key: string | null
  unit_amount: number | null
  currency: string
  /** Id do produto (sem expandir). */
  product: string
  recurring: { interval: string; interval_count: number } | null
}

export interface Plano {
  produtos: {
    criar: ProdutoDesejado[]
    atualizar: { id: string; nivel: NivelAssinatura; nome: string; descricao: string }[]
  }
  precos: {
    /** `transferir`: a chave já está num preço errado; o novo preço toma a chave (transfer_lookup_key) e o antigo é arquivado. */
    criar: (PrecoDesejado & { transferir: boolean })[]
    arquivar: string[]
  }
  semMudancas: boolean
}

/** Marca nos produtos do Corner, para achá-los de novo sem depender do nome. */
export const METADATA_NIVEL = 'corner_nivel'

export function planejar(produtos: readonly ProdutoExistente[], precos: readonly PrecoExistente[]): Plano {
  const plano: Plano = { produtos: { criar: [], atualizar: [] }, precos: { criar: [], arquivar: [] }, semMudancas: false }

  const idDoProduto = new Map<NivelAssinatura, string>()
  for (const d of produtosDesejados()) {
    const existente = produtos.find(p => p.active && p.metadata[METADATA_NIVEL] === d.nivel)
    if (!existente) {
      plano.produtos.criar.push(d)
      continue
    }
    idDoProduto.set(d.nivel, existente.id)
    if (existente.name !== d.nome || (existente.description ?? '') !== d.descricao) {
      plano.produtos.atualizar.push({ id: existente.id, nivel: d.nivel, nome: d.nome, descricao: d.descricao })
    }
  }

  for (const d of precosDesejados()) {
    const atual = precos.find(p => p.active && p.lookup_key === d.chave)
    if (!atual) {
      plano.precos.criar.push({ ...d, transferir: false })
      continue
    }
    const certo =
      atual.unit_amount === d.centavos &&
      atual.currency === 'brl' &&
      atual.recurring?.interval === d.intervalo &&
      atual.recurring?.interval_count === 1 &&
      // Se o produto do nível ainda vai ser criado, o preço antigo não pode estar certo.
      idDoProduto.get(d.nivel) === atual.product
    if (!certo) {
      plano.precos.criar.push({ ...d, transferir: true })
      plano.precos.arquivar.push(atual.id)
    }
  }

  plano.semMudancas =
    plano.produtos.criar.length === 0 && plano.produtos.atualizar.length === 0 &&
    plano.precos.criar.length === 0 && plano.precos.arquivar.length === 0
  return plano
}

/** O script só trabalha na conta de teste. Recusa qualquer outra chave, sem repeti-la na mensagem. */
export function exigirChaveDeTeste(chave: string | undefined): asserts chave is string {
  if (typeof chave !== 'string' || !chave.startsWith('sk_test_')) {
    throw new Error('Este script só roda com uma chave secreta de TESTE (sk_test_...). Nada foi feito.')
  }
}

// ── Portal do Cliente ────────────────────────────────────────

export interface ConfiguracaoDoPortal {
  business_profile: { headline: string }
  features: {
    customer_update: { enabled: boolean; allowed_updates: string[] }
    invoice_history: { enabled: boolean }
    payment_method_update: { enabled: boolean }
    subscription_cancel: { enabled: boolean; mode: 'at_period_end'; proration_behavior: 'none' }
    subscription_update: {
      enabled: boolean
      default_allowed_updates: string[]
      proration_behavior: 'create_prorations'
      products: { product: string; prices: string[]; adjustable_quantity: { enabled: false } }[]
    }
  }
  metadata: Record<string, string>
}

/** Portal onde a pessoa troca de plano, atualiza o cartão, vê as faturas e cancela (no fim do período). */
export function configuracaoDoPortal(
  produtoPorNivel: Record<NivelAssinatura, string>,
  precoPorChave: Record<string, string>,
): ConfiguracaoDoPortal {
  return {
    business_profile: { headline: 'Gerencie a sua assinatura do Corner' },
    features: {
      customer_update: { enabled: true, allowed_updates: ['email', 'name'] },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: 'at_period_end', proration_behavior: 'none' },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['price'],
        proration_behavior: 'create_prorations',
        products: NIVEIS.map(nivel => ({
          product: produtoPorNivel[nivel],
          prices: PERIODOS.map(periodo => precoPorChave[lookupKey(nivel, periodo)]),
          adjustable_quantity: { enabled: false },
        })),
      },
    },
    metadata: { corner: '1' },
  }
}
