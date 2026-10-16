// Regras de negócio da assinatura que falam com o Stripe. O Stripe é recebido de fora (`StripeLike`),
// então os testes usam um falso e as rotas passam o de verdade (lib/assinatura/stripe.ts).
// Nada aqui lê cookie, cabeçalho ou variável de ambiente.

import { TESTE_GRATIS_DIAS, lookupKey, type NivelAssinatura, type Periodo } from './catalogo'
import { temAcesso, type EstadoAssinatura } from './regras'
import { estadoDeAssinaturas, type AssinaturaStripe } from './stripe-para-estado'

/** O pedaço do cliente do Stripe de que precisamos (o objeto real tem muito mais). */
export interface StripeLike {
  customers: {
    list(p: { email: string; limit: number }): Promise<{ data: ClienteStripe[] }>
    create(p: { email: string; name?: string; metadata: Record<string, string> }): Promise<ClienteStripe>
  }
  prices: { list(p: { lookup_keys: string[]; active: boolean; limit: number }): Promise<{ data: { id: string }[] }> }
  subscriptions: { list(p: { customer: string; status: 'all'; limit: number }): Promise<{ data: AssinaturaStripe[] }> }
  checkout: { sessions: { create(p: Record<string, unknown>): Promise<{ id: string; url: string | null }> } }
  billingPortal: { sessions: { create(p: { customer: string; return_url: string }): Promise<{ url: string }> } }
}

interface ClienteStripe {
  id: string
  email?: string | null
  metadata: Record<string, string>
}

export interface UsuarioDoApp {
  id: string
  email: string
  name: string
}

export type CodigoDeErro = 'ja_assinante' | 'preco_inexistente' | 'sem_url' | 'sem_cliente'

/** Erro com texto seguro para mostrar à pessoa (em português, sem nada do Stripe) e o status HTTP a devolver. */
export class ErroAssinatura extends Error {
  constructor(readonly codigo: CodigoDeErro, mensagem: string, readonly status: number) {
    super(mensagem)
    this.name = 'ErroAssinatura'
  }
}

/** Marca nos clientes do Stripe, para achar o cliente certo sem banco de dados. */
const MARCA_DO_USUARIO = 'corner_user_id'

/** Id do cliente deste usuário no Stripe, ou `null` se ele ainda não existe. Nunca cria. */
export async function acharCliente(stripe: StripeLike, usuario: UsuarioDoApp): Promise<string | null> {
  const { data } = await stripe.customers.list({ email: usuario.email, limit: 10 })
  return data.find(c => c.metadata[MARCA_DO_USUARIO] === usuario.id)?.id ?? null
}

async function garantirCliente(stripe: StripeLike, usuario: UsuarioDoApp): Promise<string> {
  const existente = await acharCliente(stripe, usuario)
  if (existente) return existente
  const criado = await stripe.customers.create({ email: usuario.email, name: usuario.name, metadata: { [MARCA_DO_USUARIO]: usuario.id } })
  return criado.id
}

async function assinaturasDoCliente(stripe: StripeLike, cliente: string): Promise<AssinaturaStripe[]> {
  return (await stripe.subscriptions.list({ customer: cliente, status: 'all', limit: 100 })).data
}

/** Pergunta ao Stripe qual é a assinatura do usuário. Sem cliente: sem assinatura (e nada é criado). */
export async function estadoDoUsuario(stripe: StripeLike, usuario: UsuarioDoApp): Promise<EstadoAssinatura> {
  const cliente = await acharCliente(stripe, usuario)
  if (!cliente) return estadoDeAssinaturas([])
  return estadoDeAssinaturas(await assinaturasDoCliente(stripe, cliente))
}

export interface PedidoDeCheckout {
  usuario: UsuarioDoApp
  nivel: NivelAssinatura
  periodo: Periodo
  /** Endereço do site (ex.: https://corner2.vercel.app), para os links de retorno. */
  origem: string
}

/** Cria a página de pagamento do Stripe. Primeira assinatura: 7 dias grátis, sem cartão. */
export async function criarCheckout(stripe: StripeLike, { usuario, nivel, periodo, origem }: PedidoDeCheckout): Promise<{ url: string }> {
  const cliente = await garantirCliente(stripe, usuario)
  const anteriores = await assinaturasDoCliente(stripe, cliente)

  // Uma assinatura por pessoa: quem já tem uma ativa, em teste ou atrasada gerencia pelo portal.
  const atual = estadoDeAssinaturas(anteriores)
  if (temAcesso(atual)) {
    throw new ErroAssinatura('ja_assinante', 'Você já tem uma assinatura. Use "Gerenciar assinatura" para trocar de plano.', 409)
  }

  const chave = lookupKey(nivel, periodo)
  const preco = (await stripe.prices.list({ lookup_keys: [chave], active: true, limit: 1 })).data[0]
  if (!preco) {
    throw new ErroAssinatura('preco_inexistente', 'Os planos ainda não estão disponíveis para contratação. Tente novamente mais tarde.', 503)
  }

  // O teste grátis é só da primeira vez: quem já teve qualquer assinatura (mesmo cancelada) paga desde o início.
  const comTeste = anteriores.length === 0
  const metadata = { [MARCA_DO_USUARIO]: usuario.id }
  const sessao = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: cliente,
    client_reference_id: usuario.id,
    locale: 'pt-BR',
    line_items: [{ price: preco.id, quantity: 1 }],
    payment_method_collection: comTeste ? 'if_required' : 'always',
    subscription_data: comTeste
      ? { trial_period_days: TESTE_GRATIS_DIAS, trial_settings: { end_behavior: { missing_payment_method: 'cancel' } }, metadata }
      : { metadata },
    success_url: `${origem}/assinatura?checkout=ok&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origem}/assinatura?checkout=cancelado`,
  })
  if (!sessao.url) throw new ErroAssinatura('sem_url', 'Não foi possível abrir a página de pagamento. Tente novamente.', 502)
  return { url: sessao.url }
}

/** Abre o Portal do Cliente do Stripe (trocar de plano, cartão, faturas, cancelar). */
export async function criarPortal(stripe: StripeLike, { usuario, origem }: { usuario: UsuarioDoApp; origem: string }): Promise<{ url: string }> {
  const cliente = await acharCliente(stripe, usuario)
  if (!cliente) throw new ErroAssinatura('sem_cliente', 'Você ainda não tem uma assinatura para gerenciar.', 409)
  const sessao = await stripe.billingPortal.sessions.create({ customer: cliente, return_url: `${origem}/assinatura` })
  return { url: sessao.url }
}
