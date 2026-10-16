// Teste de fumaça da integração com o Stripe, na conta de TESTE: exercita o mesmo código das rotas
// (lib/assinatura/servico.ts) contra o Stripe de verdade e limpa tudo o que criou.
//
// Uso:  npm run stripe:fumaca
//
// Pré-requisito: `npm run stripe:sincronizar` já rodou (os planos precisam existir no Stripe).
// O que NÃO cobre: pagar de verdade na página do Stripe (isso é o teste manual com o cartão 4242 4242 4242 4242).

import Stripe from 'stripe'
import { TESTE_GRATIS_DIAS, lookupKey } from '../lib/assinatura/catalogo'
import { temAcesso } from '../lib/assinatura/regras'
import { ErroAssinatura, criarCheckout, criarPortal, estadoDoUsuario, type StripeLike } from '../lib/assinatura/servico'
import { exigirChaveDeTeste } from '../lib/assinatura/stripe-catalogo'

try { process.loadEnvFile('.env.local') } catch { /* usa só o ambiente */ }
const chave = process.env.STRIPE_SECRET_KEY
exigirChaveDeTeste(chave)

const stripe = new Stripe(chave)
const servico = stripe as unknown as StripeLike
const ORIGEM = 'https://corner2.vercel.app'
const usuario = { id: `u_fumaca_${Date.now()}`, email: `fumaca+${Date.now()}@corner.test`, name: 'Teste de fumaça' }

let falhas = 0
const confere = (nome: string, ok: boolean, detalhe = '') => {
  if (!ok) falhas++
  console.log(`${ok ? 'PASSOU' : 'FALHOU'}  ${nome}${!ok && detalhe ? `  → ${detalhe}` : ''}`)
}

async function principal() {
  // 1. Usuário novo: sem cliente, sem assinatura.
  let estado = await estadoDoUsuario(servico, usuario)
  confere('usuário novo não tem assinatura', estado.situacao === 'nenhuma')

  // 2. Checkout: devolve a página de pagamento e configura o teste grátis sem cartão.
  const checkout = await criarCheckout(servico, { usuario, nivel: 'amador', periodo: 'mensal', origem: ORIGEM })
  confere('checkout devolve um endereço do Stripe', checkout.url.startsWith('https://checkout.stripe.com/'))
  const id = new URL(checkout.url).pathname.split('/').pop()!
  const clientes = await stripe.customers.list({ email: usuario.email })
  const cliente = clientes.data[0]
  confere('o cliente foi criado, com a marca do usuário', cliente?.metadata.corner_user_id === usuario.id)
  const sessoes = await stripe.checkout.sessions.list({ customer: cliente.id, limit: 1 })
  const sessao = sessoes.data[0]
  confere('a sessão é de assinatura, sem exigir cartão (teste grátis)', sessao.mode === 'subscription' && sessao.payment_method_collection === 'if_required', `${sessao.mode} / ${sessao.payment_method_collection}`)
  confere('volta para /assinatura depois de pagar', sessao.success_url?.startsWith(`${ORIGEM}/assinatura?checkout=ok&session_id=`) === true)
  confere('idioma português', sessao.locale === 'pt-BR' || sessao.locale === null, String(sessao.locale))
  void id

  // 3. Simula a conclusão do checkout: a assinatura em teste grátis que o Stripe criaria.
  const preco = (await stripe.prices.list({ lookup_keys: [lookupKey('amador', 'mensal')], active: true })).data[0]
  const assinatura = await stripe.subscriptions.create({
    customer: cliente.id,
    items: [{ price: preco.id }],
    trial_period_days: TESTE_GRATIS_DIAS,
    trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
    metadata: { corner_user_id: usuario.id },
  })
  estado = await estadoDoUsuario(servico, usuario)
  confere('em teste grátis: situação "teste", plano Amador, mensal', estado.situacao === 'teste' && estado.nivel === 'amador' && estado.periodo === 'mensal', JSON.stringify(estado))
  confere('tem acesso durante o teste', temAcesso(estado))
  const dias = estado.fimDoTeste ? (Date.parse(estado.fimDoTeste) - Date.now()) / 86_400_000 : -1
  confere('o teste dura cerca de 7 dias', dias > 6.9 && dias <= 7.01, `${dias.toFixed(2)} dias`)

  // 4. Quem já assina não cria outra assinatura.
  const duplicada = await criarCheckout(servico, { usuario, nivel: 'profissional', periodo: 'anual', origem: ORIGEM }).catch(e => e)
  confere('segunda assinatura é barrada (409)', duplicada instanceof ErroAssinatura && duplicada.status === 409)

  // 5. Portal do Cliente.
  const portal = await criarPortal(servico, { usuario, origem: ORIGEM })
  confere('portal devolve um endereço do Stripe', portal.url.startsWith('https://billing.stripe.com/'))

  // 6. Troca de plano feita pelo portal (simulada pela API): o estado acompanha.
  const novo = (await stripe.prices.list({ lookup_keys: [lookupKey('profissional', 'anual')], active: true })).data[0]
  await stripe.subscriptions.update(assinatura.id, { items: [{ id: assinatura.items.data[0].id, price: novo.id }], proration_behavior: 'none' })
  estado = await estadoDoUsuario(servico, usuario)
  confere('depois da troca: Profissional anual', estado.nivel === 'profissional' && estado.periodo === 'anual', JSON.stringify(estado))

  // 7. Cancelamento no fim do período continua valendo até lá; cancelamento imediato tira o acesso.
  await stripe.subscriptions.update(assinatura.id, { cancel_at_period_end: true })
  estado = await estadoDoUsuario(servico, usuario)
  confere('cancelamento agendado: ainda tem acesso e avisa que vai cancelar', temAcesso(estado) && estado.cancelaNoFim)
  await stripe.subscriptions.cancel(assinatura.id)
  estado = await estadoDoUsuario(servico, usuario)
  confere('cancelada: sem acesso', estado.situacao === 'cancelada' && !temAcesso(estado), JSON.stringify(estado))

  // 8. Quem já teve assinatura não ganha outro teste grátis.
  await criarCheckout(servico, { usuario, nivel: 'iniciante', periodo: 'anual', origem: ORIGEM })
  const novas = await stripe.checkout.sessions.list({ customer: cliente.id, limit: 3 })
  const ultima = novas.data.find(s => s.id !== sessao.id)!
  confere('segunda compra: cartão obrigatório, sem teste grátis', ultima.payment_method_collection === 'always', String(ultima.payment_method_collection))

  // 9. Limpeza: apagar o cliente de teste remove também as assinaturas dele.
  await stripe.customers.del(cliente.id)
  const depois = await stripe.customers.list({ email: usuario.email })
  confere('limpeza: cliente de teste removido', depois.data.length === 0)
}

principal()
  .catch(erro => {
    falhas++
    console.error('\nFalhou:', erro instanceof Error ? erro.message : erro)
  })
  .finally(() => {
    console.log(falhas === 0 ? '\nTudo certo com o Stripe.' : `\n${falhas} verificação(ões) falharam.`)
    process.exit(falhas === 0 ? 0 : 1)
  })
