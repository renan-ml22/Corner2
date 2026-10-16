import type { Page, Route } from '@playwright/test'
import type { EstadoAssinatura } from '../lib/assinatura/regras'

// As rotas de assinatura simuladas: os testes de navegador nunca falam com o Stripe de verdade.
// A data "de hoje" nos testes é DATA_PADRAO (quarta, 14/10/2026), então as datas abaixo são relativas a ela.

const mais = (dias: number) => new Date(new Date('2026-10-14T12:00:00-03:00').getTime() + dias * 86_400_000).toISOString()

export const SEM_ASSINATURA_TESTE: EstadoAssinatura = { situacao: 'nenhuma', nivel: null, periodo: null, fimDoPeriodo: null, fimDoTeste: null, cancelaNoFim: false }
export const ativa = (nivel: EstadoAssinatura['nivel'], parcial: Partial<EstadoAssinatura> = {}): EstadoAssinatura => ({
  situacao: 'ativa', nivel, periodo: 'mensal', fimDoPeriodo: mais(20), fimDoTeste: null, cancelaNoFim: false, ...parcial,
})
export const emTeste = (nivel: EstadoAssinatura['nivel'], dias = 5): EstadoAssinatura => ({
  situacao: 'teste', nivel, periodo: 'mensal', fimDoPeriodo: mais(dias), fimDoTeste: mais(dias), cancelaNoFim: false,
})
export const cancelada = (nivel: EstadoAssinatura['nivel'] = 'amador'): EstadoAssinatura => ({
  situacao: 'cancelada', nivel, periodo: 'mensal', fimDoPeriodo: mais(-30), fimDoTeste: null, cancelaNoFim: false,
})

export type RespostaDoEstado = EstadoAssinatura | 'indisponivel' | ((chamada: number) => EstadoAssinatura)

/** Faz `/api/assinatura/estado` responder o que o teste quer. `indisponivel` imita a falta da chave do Stripe (pagamento desligado). */
export async function simularEstado(pagina: Page, resposta: RespostaDoEstado) {
  let chamada = 0
  await pagina.route('**/api/assinatura/estado*', (rota: Route) => {
    chamada++
    if (resposta === 'indisponivel') return rota.fulfill({ status: 200, json: { pagamentoAtivo: false } })
    const estado = typeof resposta === 'function' ? resposta(chamada) : resposta
    return rota.fulfill({ status: 200, json: { pagamentoAtivo: true, estado, origem: 'stripe' } })
  })
}

export interface PedidoRegistrado { corpo: unknown }

/** Faz as rotas de checkout e portal responderem um endereço do próprio site, e registra o que foi pedido. */
export async function simularPagamento(pagina: Page, opcoes: { checkout?: { status: number; json: unknown }; portal?: { status: number; json: unknown } } = {}) {
  const checkout: PedidoRegistrado[] = []
  const portal: PedidoRegistrado[] = []
  await pagina.route('**/api/assinatura/checkout', rota => {
    checkout.push({ corpo: rota.request().postDataJSON() })
    const r = opcoes.checkout ?? { status: 200, json: { url: '/assinatura?checkout=cancelado' } }
    return rota.fulfill({ status: r.status, json: r.json })
  })
  await pagina.route('**/api/assinatura/portal', rota => {
    portal.push({ corpo: rota.request().postDataJSON?.() ?? null })
    const r = opcoes.portal ?? { status: 200, json: { url: '/assinatura?portal=voltou' } }
    return rota.fulfill({ status: r.status, json: r.json })
  })
  return { checkout, portal }
}
