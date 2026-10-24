// Cliente do PostHog (métricas de produto). É o ÚNICO arquivo que importa o posthog-js: o resto do app usa `track`,
// `identificarUsuario` e `resetarUsuario`, que passam pela lista fechada de lib/analytics.ts.
//
// Sem NEXT_PUBLIC_POSTHOG_KEY, nada é carregado nem enviado: o app funciona igual. A chave do PostHog (`phc_…`) é pública
// por natureza (vai no navegador). NUNCA coloque aqui a chave pessoal (`phx_…`) nem a secreta (`phs_…`).

import posthog from 'posthog-js'
import { configuracaoDoPostHog, criarAnalytics, type Analytics, type ClienteDeAnalise } from './analytics'

// Precisam ser lidas assim (acesso direto): o Next troca estas expressões pelo valor na hora do build.
const CHAVE = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()
const ENDERECO = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com'

let iniciado = false

/** Liga o PostHog (uma vez só, e só no navegador). `false` quando não há chave ou o navegador não permite. */
export function iniciarPostHog(): boolean {
  if (iniciado) return true
  if (typeof window === 'undefined' || !CHAVE) return false
  try {
    posthog.init(CHAVE, configuracaoDoPostHog(ENDERECO))
    iniciado = true
  } catch {
    // Métrica nenhuma pode quebrar o app.
  }
  return iniciado
}

// Liga na primeira vez que alguém precisa: filhos rodam seus efeitos antes do provider, e assim nenhum evento se perde.
const cliente: ClienteDeAnalise = {
  capture: (evento, props) => { if (iniciarPostHog()) posthog.capture(evento, props) },
  identify: id => { if (iniciarPostHog()) posthog.identify(id) },
  reset: () => { if (iniciado) posthog.reset() },
}

const analytics = criarAnalytics(CHAVE ? cliente : null)

export const track: Analytics['track'] = (evento, props) => analytics.track(evento, props)
export const identificarUsuario = (idDoUsuario: string) => analytics.identificar(idDoUsuario)
export const resetarUsuario = () => analytics.resetar()
