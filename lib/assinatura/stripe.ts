import 'server-only'
import Stripe from 'stripe'
import type { StripeLike } from './servico'

let instancia: StripeLike | null = null

/**
 * Cliente do Stripe, só no servidor. `null` quando STRIPE_SECRET_KEY não está configurada
 * (ex.: no CI e em quem ainda não ativou o pagamento): as rotas respondem "indisponível" em vez de quebrar.
 */
export function getStripe(): StripeLike | null {
  const chave = process.env.STRIPE_SECRET_KEY?.trim()
  if (!chave) return null
  // O cliente real tem muito mais métodos e tipos mais estritos; StripeLike é o recorte que usamos.
  instancia ??= new Stripe(chave) as unknown as StripeLike
  return instancia
}
