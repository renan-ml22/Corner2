// Converte as assinaturas que o Stripe devolve no nosso `EstadoAssinatura`. Puro: não chama o Stripe.

import { nivelDeLookupKey, ordemDoNivel, type NivelAssinatura, type Periodo } from './catalogo'
import { SEM_ASSINATURA, type EstadoAssinatura, type Situacao } from './regras'

/** O pedaço do objeto Subscription do Stripe de que precisamos (aceita as duas versões da API). */
export interface AssinaturaStripe {
  status: string
  cancel_at_period_end?: boolean
  trial_end?: number | null
  /** API antiga: o fim do período fica na assinatura. */
  current_period_end?: number
  items: { data: { price: { lookup_key?: string | null }; current_period_end?: number }[] }
}

/** Status do Stripe que dão acesso (as demais situações são decididas por `temAcesso`). */
const SITUACAO_POR_STATUS: Record<string, Situacao> = {
  trialing: 'teste',
  active: 'ativa',
  past_due: 'atrasada',
  canceled: 'cancelada',
  unpaid: 'cancelada',
  incomplete_expired: 'cancelada',
  paused: 'cancelada',
}

const COM_ACESSO: Situacao[] = ['teste', 'ativa', 'atrasada']

const paraIso = (segundos: number | null | undefined): string | null =>
  typeof segundos === 'number' && Number.isFinite(segundos) ? new Date(segundos * 1000).toISOString() : null

function converter(a: AssinaturaStripe): EstadoAssinatura | null {
  const situacao = SITUACAO_POR_STATUS[a.status]
  if (!situacao) return null // `incomplete` (pagamento não feito) e status desconhecidos: nunca liberam

  const item = a.items.data.find(i => nivelDeLookupKey(i.price.lookup_key) !== null)
  if (!item) return null // preço que não é do Corner
  const { nivel, periodo } = nivelDeLookupKey(item.price.lookup_key)!

  const fins = [a.current_period_end, ...a.items.data.map(i => i.current_period_end)].filter((n): n is number => typeof n === 'number')
  return {
    situacao,
    nivel,
    periodo,
    fimDoPeriodo: paraIso(fins.length ? Math.max(...fins) : null),
    fimDoTeste: situacao === 'teste' ? paraIso(a.trial_end) : null,
    cancelaNoFim: a.cancel_at_period_end === true,
  }
}

const temAcessoPorSituacao = (e: EstadoAssinatura) => COM_ACESSO.includes(e.situacao)
const fim = (e: EstadoAssinatura) => (e.fimDoPeriodo ? Date.parse(e.fimDoPeriodo) : 0)

/**
 * Escolhe o estado que vale quando o cliente tem várias assinaturas (troca de plano, antiga, duplicada):
 * quem dá acesso ganha de quem não dá; entre as que dão, o maior nível; no mesmo nível, a que vai mais longe.
 * Só canceladas: mostra a mais recente. Nenhuma do Corner: sem assinatura.
 */
export function estadoDeAssinaturas(assinaturas: readonly AssinaturaStripe[]): EstadoAssinatura {
  const estados = assinaturas.map(converter).filter((e): e is EstadoAssinatura => e !== null)
  if (estados.length === 0) return SEM_ASSINATURA

  const nivelDe = (e: EstadoAssinatura) => (e.nivel ? ordemDoNivel(e.nivel as NivelAssinatura) : -1)
  const melhor = [...estados].sort((a, b) =>
    Number(temAcessoPorSituacao(b)) - Number(temAcessoPorSituacao(a)) || nivelDe(b) - nivelDe(a) || fim(b) - fim(a),
  )[0]
  return melhor
}

export type { Periodo }
