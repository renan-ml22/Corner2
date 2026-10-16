// Utilitários das rotas de assinatura: conferir de onde veio o pedido e validar o corpo. Puros e testáveis.

import { NIVEIS, PERIODOS, type NivelAssinatura, type Periodo } from './catalogo'

const primeiro = (valor: string | null): string | null => valor?.split(',')[0].trim() || null

/** Protocolo do site: o que o proxy informou (só http ou https) ou o do próprio pedido. */
function protocolo(request: Request): 'http' | 'https' {
  const informado = primeiro(request.headers.get('x-forwarded-proto'))
  if (informado === 'http' || informado === 'https') return informado
  return new URL(request.url).protocol === 'http:' ? 'http' : 'https'
}

function host(request: Request): string {
  return primeiro(request.headers.get('x-forwarded-host')) ?? request.headers.get('host') ?? new URL(request.url).host
}

/** Endereço do site (ex.: https://corner2.vercel.app), usado para montar os links de retorno. */
export function origemDoSite(request: Request): string {
  const url = new URL(request.url)
  const informado = primeiro(request.headers.get('x-forwarded-host'))
  return `${protocolo(request)}://${informado ?? url.host}`
}

/**
 * O pedido veio do próprio site? Confere `Origin` (ou, na falta dele, `Referer`) com o host do site.
 * Sem nenhum dos dois: não. Protege contra um site alheio fazendo o navegador da pessoa chamar a rota.
 */
export function origemPermitida(request: Request): boolean {
  const declarada = request.headers.get('origin') ?? request.headers.get('referer')
  if (!declarada) return false
  try {
    return new URL(declarada).host === host(request)
  } catch {
    return false
  }
}

/** Corpo do pedido de checkout: só nível e período, de uma lista fechada. Qualquer outra coisa é recusada. */
export function lerPedidoDeCheckout(corpo: unknown): { nivel: NivelAssinatura; periodo: Periodo } | null {
  if (typeof corpo !== 'object' || corpo === null || Array.isArray(corpo)) return null
  const x = corpo as Record<string, unknown>
  const chaves = Object.keys(x)
  if (chaves.length !== 2 || !chaves.includes('nivel') || !chaves.includes('periodo')) return null
  if (!NIVEIS.includes(x.nivel as NivelAssinatura) || !PERIODOS.includes(x.periodo as Periodo)) return null
  return { nivel: x.nivel as NivelAssinatura, periodo: x.periodo as Periodo }
}
