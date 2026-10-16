// Cria (ou conserta) no Stripe os produtos, os preços e o Portal do Cliente do Corner.
// Só trabalha na conta de TESTE e pode ser rodado quantas vezes quiser: não duplica nada.
//
// Uso:   npm run stripe:sincronizar            (aplica)
//        npm run stripe:sincronizar -- --simular   (só mostra o que faria)
//
// Lê STRIPE_SECRET_KEY do .env.local. A chave nunca é impressa.

import Stripe from 'stripe'
import { NIVEIS, PERIODOS, lookupKey, formatarPreco, type NivelAssinatura } from '../lib/assinatura/catalogo'
import {
  METADATA_NIVEL, configuracaoDoPortal, exigirChaveDeTeste, planejar,
  type PrecoExistente, type ProdutoExistente,
} from '../lib/assinatura/stripe-catalogo'

try { process.loadEnvFile('.env.local') } catch { /* sem .env.local: usa só o ambiente */ }

const simular = process.argv.includes('--simular')
const chave = process.env.STRIPE_SECRET_KEY
exigirChaveDeTeste(chave)
const stripe = new Stripe(chave)

const linha = (texto: string) => console.log(texto)

async function principal() {
  linha(simular ? 'SIMULAÇÃO (nada será alterado no Stripe)\n' : 'Sincronizando com o Stripe (modo de teste)\n')

  // ── 1. Ler o que já existe ──
  const produtosApi = await stripe.products.list({ limit: 100 })
  const precosApi = await stripe.prices.list({ limit: 100, lookup_keys: NIVEIS.flatMap(n => PERIODOS.map(p => lookupKey(n, p))) })

  const produtos: ProdutoExistente[] = produtosApi.data.map(p => ({
    id: p.id, active: p.active, name: p.name, description: p.description, metadata: p.metadata,
  }))
  const precos: PrecoExistente[] = precosApi.data.map(p => ({
    id: p.id, active: p.active, lookup_key: p.lookup_key, unit_amount: p.unit_amount, currency: p.currency,
    product: typeof p.product === 'string' ? p.product : p.product.id,
    recurring: p.recurring ? { interval: p.recurring.interval, interval_count: p.recurring.interval_count } : null,
  }))

  const plano = planejar(produtos, precos)

  // ── 2. Mostrar o plano ──
  linha('Plano:')
  for (const p of plano.produtos.criar) linha(`  + criar produto  ${p.nome}`)
  for (const p of plano.produtos.atualizar) linha(`  ~ atualizar produto  ${p.nome} (${p.id})`)
  for (const p of plano.precos.criar) linha(`  + criar preço    ${p.chave.padEnd(20)} ${formatarPreco(p.centavos)} / ${p.intervalo === 'month' ? 'mês' : 'ano'}${p.transferir ? '  (substitui o antigo)' : ''}`)
  for (const id of plano.precos.arquivar) linha(`  - arquivar preço antigo  ${id}`)
  if (plano.semMudancas) linha('  (produtos e preços já estão certos)')

  if (simular) {
    linha('\nSimulação concluída: nada foi alterado.')
    return
  }

  // ── 3. Executar ──
  const produtoPorNivel = {} as Record<NivelAssinatura, string>
  for (const n of NIVEIS) {
    const existente = produtos.find(p => p.active && p.metadata[METADATA_NIVEL] === n)
    if (existente) produtoPorNivel[n] = existente.id
  }

  for (const p of plano.produtos.criar) {
    const criado = await stripe.products.create({ name: p.nome, description: p.descricao, metadata: { [METADATA_NIVEL]: p.nivel } })
    produtoPorNivel[p.nivel] = criado.id
  }
  for (const p of plano.produtos.atualizar) {
    await stripe.products.update(p.id, { name: p.nome, description: p.descricao })
  }
  for (const p of plano.precos.criar) {
    await stripe.prices.create({
      product: produtoPorNivel[p.nivel],
      currency: 'brl',
      unit_amount: p.centavos,
      recurring: { interval: p.intervalo },
      lookup_key: p.chave,
      transfer_lookup_key: p.transferir,
      metadata: { corner: '1' },
    })
  }
  for (const id of plano.precos.arquivar) await stripe.prices.update(id, { active: false })

  // ── 4. Portal do Cliente (precisa dos ids dos preços finais) ──
  const finais = await stripe.prices.list({ limit: 100, active: true, lookup_keys: NIVEIS.flatMap(n => PERIODOS.map(p => lookupKey(n, p))) })
  const precoPorChave = Object.fromEntries(finais.data.map(p => [p.lookup_key as string, p.id]))
  const configuracao = configuracaoDoPortal(produtoPorNivel, precoPorChave)

  const portais = await stripe.billingPortal.configurations.list({ limit: 100 })
  const meu = portais.data.find(c => c.metadata?.corner === '1')
  // O tipo do SDK é mais estrito que o nosso objeto simples; o formato é o documentado pelo Stripe.
  const payload = configuracao as unknown as Stripe.BillingPortal.ConfigurationCreateParams
  if (meu) {
    await stripe.billingPortal.configurations.update(meu.id, payload as Stripe.BillingPortal.ConfigurationUpdateParams)
    linha(`\nPortal do Cliente: atualizado (${meu.id})`)
  } else {
    const criado = await stripe.billingPortal.configurations.create(payload)
    linha(`\nPortal do Cliente: criado (${criado.id})`)
  }

  linha('\nPronto. Produtos e preços no Stripe:')
  for (const n of NIVEIS) {
    for (const periodo of PERIODOS) {
      const k = lookupKey(n, periodo)
      linha(`  ${k.padEnd(20)} ${precoPorChave[k]}`)
    }
  }
}

principal().catch(erro => {
  // A mensagem do Stripe não contém a chave; mostra só o essencial.
  console.error('\nFalhou:', erro instanceof Error ? erro.message : erro)
  process.exit(1)
})
