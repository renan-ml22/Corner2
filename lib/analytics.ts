// Métricas de produto (PostHog): o que é rastreado, com quais propriedades, e o que NUNCA sai do aparelho.
//
// O app guarda dados de saúde (lesões, pancadas na cabeça, peso). Por isso este módulo é uma lista fechada:
// - só os eventos de EVENTOS existem, cada um com propriedades fixas e validadas (texto livre, e-mail e nome não passam);
// - `filtrarEnvio` é a última barreira, chamada pelo PostHog antes de cada envio, e descarta tudo o que não estiver na lista;
// - `configuracaoDoPostHog` deixa desligado o que poderia capturar conteúdo: gravação de tela, cliques, textos, exceções.
//
// Puro e sem rede: vale no navegador e nos testes. O cliente real fica em lib/posthog.ts.

import type { CaptureResult, PostHogConfig } from 'posthog-js'

export const EVENTOS = ['onboarding_started', 'onboarding_completed', 'workout_registered', 'plan_selected', 'sheet_opened', 'tab_changed'] as const
export type NomeDoEvento = (typeof EVENTOS)[number]

/** O que cada evento carrega. É o que o TypeScript exige em cada chamada; em tempo de execução tudo é validado de novo. */
export interface PropsDosEventos {
  onboarding_started: Record<string, never>
  onboarding_completed: { nivel: string; dias_por_semana: number; plano_escolhido: string }
  workout_registered: { tipo: string; rounds: number; rpe: number; duracao_segundos: number }
  plan_selected: { plano_id: string; nivel: string }
  sheet_opened: { sheet_name: string }
  tab_changed: { tab_name: string }
}

export interface ClienteDeAnalise {
  capture(evento: string, props?: Record<string, unknown>): void
  identify(id: string): void
  reset(): void
}

// ── Validação das propriedades ───────────────────────────────

const ID = /^[a-z0-9][a-z0-9_-]{0,39}$/
const NIVEIS = ['iniciante', 'intermediario', 'avancado'] as const
const TIPOS_DE_TREINO = ['tec', 'con', 'spa'] as const
/** Id de pessoa: o uuid do Supabase ou o id do usuário de teste. Nunca e-mail nem nome. */
const ID_DE_USUARIO = /^[A-Za-z0-9_-]{1,64}$/

const texto = (v: unknown): string | null => (typeof v === 'string' && ID.test(v) ? v : null)
const dentroDe = (v: unknown, lista: readonly string[]): string | null => (typeof v === 'string' && lista.includes(v) ? v : null)
const inteiro = (v: unknown, min: number, max: number): number | null => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  const r = Math.round(v)
  return r >= min && r <= max ? r : null
}

type Props = Record<string, unknown>
type Saneado = Record<string, string | number>

/** Devolve só as propriedades previstas, já limpas, ou `null` se alguma for inválida (aí o evento nem é enviado). */
const ESPECIFICACOES: Record<NomeDoEvento, (p: Props) => Saneado | null> = {
  onboarding_started: () => ({}),
  onboarding_completed: p => {
    const nivel = dentroDe(p.nivel, NIVEIS), dias = inteiro(p.dias_por_semana, 1, 7), plano = texto(p.plano_escolhido)
    return nivel && dias !== null && plano ? { nivel, dias_por_semana: dias, plano_escolhido: plano } : null
  },
  workout_registered: p => {
    const tipo = dentroDe(p.tipo, TIPOS_DE_TREINO), rounds = inteiro(p.rounds, 0, 100), rpe = inteiro(p.rpe, 1, 10), duracao = inteiro(p.duracao_segundos, 0, 172_800)
    return tipo && rounds !== null && rpe !== null && duracao !== null ? { tipo, rounds, rpe, duracao_segundos: duracao } : null
  },
  plan_selected: p => {
    const plano = texto(p.plano_id), nivel = dentroDe(p.nivel, NIVEIS)
    return plano && nivel ? { plano_id: plano, nivel } : null
  },
  sheet_opened: p => { const nome = texto(p.sheet_name); return nome ? { sheet_name: nome } : null },
  tab_changed: p => { const nome = texto(p.tab_name); return nome ? { tab_name: nome } : null },
}

// ── O que as telas chamam ────────────────────────────────────

export interface Analytics {
  /** `true` se o evento foi entregue ao PostHog. Nunca lança erro: métrica nenhuma pode quebrar o app. */
  track<E extends NomeDoEvento>(evento: E, props: PropsDosEventos[E]): boolean
  /** Liga o que vem depois a uma pessoa pelo id (nunca e-mail, nome ou outra propriedade). */
  identificar(idDoUsuario: string): boolean
  /** Ao sair da conta: esquece a pessoa neste aparelho. */
  resetar(): void
}

/** `cliente: null` = sem chave do PostHog: tudo vira "não fazer nada". */
export function criarAnalytics(cliente: ClienteDeAnalise | null): Analytics {
  return {
    track(evento, props) {
      if (!cliente || !Object.hasOwn(ESPECIFICACOES, evento)) return false
      const saneado = ESPECIFICACOES[evento]((props ?? {}) as Props)
      if (!saneado) return false
      try { cliente.capture(evento, saneado); return true } catch { return false }
    },
    identificar(id) {
      if (!cliente || !ID_DE_USUARIO.test(id)) return false
      try { cliente.identify(id); return true } catch { return false }
    },
    resetar() {
      try { cliente?.reset() } catch { /* sem efeito: a limpeza é só uma cortesia */ }
    },
  }
}

// ── Última barreira antes de enviar ──────────────────────────

const PERMITIDOS = new Set<string>([...EVENTOS, '$identify'])
const PERSON_PROPS = ['$set', '$set_once', '$unset'] as const

/** "https://x.com/a?b=1#c" vira "https://x.com/a": a query e o hash podem trazer ids (a volta do pagamento traz o do Stripe). */
const semQuery = (url: string) => url.split(/[?#]/)[0]
const campoDeEndereco = (chave: string) => /url|referrer/i.test(chave)

/**
 * Chamada pelo PostHog antes de cada envio (`before_send`). Só os eventos da lista (e o `$identify`) saem: qualquer
 * outro (clique, gravação de tela, exceção, pageview) é descartado mesmo que alguma configuração remota o ligue.
 * Também tira a query e o hash das URLs, as propriedades de pessoa e qualquer propriedade com cara de e-mail.
 */
export function filtrarEnvio(resultado: CaptureResult | null): CaptureResult | null {
  if (!resultado || typeof resultado.event !== 'string' || !PERMITIDOS.has(resultado.event)) return null

  const propriedades: Record<string, unknown> = {}
  for (const [chave, valor] of Object.entries(resultado.properties ?? {})) {
    if ((PERSON_PROPS as readonly string[]).includes(chave)) continue
    if (typeof valor === 'string') {
      if (!chave.startsWith('$') && valor.includes('@')) continue
      propriedades[chave] = campoDeEndereco(chave) ? semQuery(valor) : valor
    } else {
      propriedades[chave] = valor
    }
  }

  const limpo: CaptureResult = { ...resultado, properties: propriedades }
  for (const chave of PERSON_PROPS) delete (limpo as unknown as Record<string, unknown>)[chave]
  return limpo
}

// ── Configuração do cliente ──────────────────────────────────

/**
 * Tudo o que poderia capturar o que a pessoa vê ou digita fica desligado. Os recursos remotos também: sem eles, uma
 * mudança no painel do PostHog não consegue ligar a gravação de tela.
 */
export function configuracaoDoPostHog(host: string) {
  return {
    api_host: host,
    // Nada de captura automática de conteúdo: só os eventos de EVENTOS.
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    capture_exceptions: false,
    disable_session_recording: true,
    // Nada de recursos remotos nem de scripts extras.
    disable_external_dependency_loading: true,
    disable_surveys: true,
    disable_web_experiments: true,
    disable_conversations: true,
    advanced_disable_flags: true,
    // Privacidade: pessoa só depois de identificada, sem cookie, respeitando "não rastrear", sem campanhas.
    person_profiles: 'identified_only',
    persistence: 'localStorage',
    respect_dnt: true,
    save_campaign_params: false,
    before_send: filtrarEnvio,
  } satisfies Partial<PostHogConfig>
}
