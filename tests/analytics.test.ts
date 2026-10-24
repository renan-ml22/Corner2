import { describe, expect, it, vi } from 'vitest'
import { EVENTOS, configuracaoDoPostHog, criarAnalytics, filtrarEnvio, type ClienteDeAnalise } from '@/lib/analytics'

function cliente() {
  const c = { capture: vi.fn(), identify: vi.fn(), reset: vi.fn() } satisfies ClienteDeAnalise
  return { ...c, analytics: criarAnalytics(c) }
}

describe('os eventos do produto', () => {
  it('são exatamente os seis combinados', () => {
    expect([...EVENTOS].sort()).toEqual(['onboarding_completed', 'onboarding_started', 'plan_selected', 'sheet_opened', 'tab_changed', 'workout_registered'])
  })
})

describe('track: propriedades fixas por evento', () => {
  it('onboarding_started: sem propriedades', () => {
    const { capture, analytics } = cliente()
    expect(analytics.track('onboarding_started', {})).toBe(true)
    expect(capture).toHaveBeenCalledWith('onboarding_started', {})
  })

  it('onboarding_completed: nível, dias por semana e plano escolhido', () => {
    const { capture, analytics } = cliente()
    expect(analytics.track('onboarding_completed', { nivel: 'intermediario', dias_por_semana: 4, plano_escolhido: 'base-aerobica' })).toBe(true)
    expect(capture).toHaveBeenCalledWith('onboarding_completed', { nivel: 'intermediario', dias_por_semana: 4, plano_escolhido: 'base-aerobica' })
  })

  it('workout_registered: tipo, rounds, rpe e duração em segundos (e nada mais)', () => {
    const { capture, analytics } = cliente()
    expect(analytics.track('workout_registered', { tipo: 'spa', rounds: 4, rpe: 8, duracao_segundos: 1234 })).toBe(true)
    expect(capture).toHaveBeenCalledWith('workout_registered', { tipo: 'spa', rounds: 4, rpe: 8, duracao_segundos: 1234 })
  })

  it('plan_selected: id e nível do plano', () => {
    const { capture, analytics } = cliente()
    analytics.track('plan_selected', { plano_id: 'fundamentos', nivel: 'iniciante' })
    expect(capture).toHaveBeenCalledWith('plan_selected', { plano_id: 'fundamentos', nivel: 'iniciante' })
  })

  it('sheet_opened e tab_changed: só o nome', () => {
    const { capture, analytics } = cliente()
    analytics.track('sheet_opened', { sheet_name: 'registro_treino' })
    analytics.track('tab_changed', { tab_name: 'progresso' })
    expect(capture.mock.calls).toEqual([['sheet_opened', { sheet_name: 'registro_treino' }], ['tab_changed', { tab_name: 'progresso' }]])
  })

  it('propriedades que não fazem parte do evento são descartadas, nunca enviadas (e-mail, nome, nota, lesão...)', () => {
    const { capture, analytics } = cliente()
    analytics.track('workout_registered', { tipo: 'tec', rounds: 3, rpe: 6, duracao_segundos: 900, nota: 'machuquei o ombro', email: 'ana@exemplo.com', parceiro: 'Rafa', cabeca: 'fortes' } as never)
    expect(capture).toHaveBeenCalledWith('workout_registered', { tipo: 'tec', rounds: 3, rpe: 6, duracao_segundos: 900 })
  })

  it('números fracionados são arredondados', () => {
    const { capture, analytics } = cliente()
    analytics.track('workout_registered', { tipo: 'con', rounds: 5.4, rpe: 7.6, duracao_segundos: 899.6 })
    expect(capture).toHaveBeenCalledWith('workout_registered', { tipo: 'con', rounds: 5, rpe: 8, duracao_segundos: 900 })
  })

  it.each([
    ['tipo desconhecido', 'workout_registered', { tipo: 'luta-livre', rounds: 3, rpe: 6, duracao_segundos: 900 }],
    ['rpe fora de 1 a 10', 'workout_registered', { tipo: 'tec', rounds: 3, rpe: 99, duracao_segundos: 900 }],
    ['rounds negativo', 'workout_registered', { tipo: 'tec', rounds: -1, rpe: 6, duracao_segundos: 900 }],
    ['duração que não é número', 'workout_registered', { tipo: 'tec', rounds: 3, rpe: 6, duracao_segundos: 'muito' }],
    ['duração infinita', 'workout_registered', { tipo: 'tec', rounds: 3, rpe: 6, duracao_segundos: Infinity }],
    ['nível desconhecido', 'onboarding_completed', { nivel: 'mestre', dias_por_semana: 3, plano_escolhido: 'fundamentos' }],
    ['dias fora de 1 a 7', 'onboarding_completed', { nivel: 'iniciante', dias_por_semana: 12, plano_escolhido: 'fundamentos' }],
    ['plano com e-mail no lugar do id', 'onboarding_completed', { nivel: 'iniciante', dias_por_semana: 3, plano_escolhido: 'ana@exemplo.com' }],
    ['plan_selected sem nível', 'plan_selected', { plano_id: 'fundamentos' }],
    ['nome de painel com texto livre', 'sheet_opened', { sheet_name: 'Meu painel com espaços' }],
    ['nome de aba com e-mail', 'tab_changed', { tab_name: 'ana@exemplo.com' }],
    ['nome de aba vazio', 'tab_changed', { tab_name: '' }],
    ['nome de painel comprido demais', 'sheet_opened', { sheet_name: 'a'.repeat(41) }],
  ] as const)('valor inválido (%s): o evento NÃO é enviado', (_nome, evento, props) => {
    const { capture, analytics } = cliente()
    expect(analytics.track(evento, props as never)).toBe(false)
    expect(capture).not.toHaveBeenCalled()
  })

  it('evento que não existe na lista não é enviado', () => {
    const { capture, analytics } = cliente()
    expect(analytics.track('qualquer_outro' as never, {} as never)).toBe(false)
    expect(capture).not.toHaveBeenCalled()
  })

  it('sem cliente (sem chave do PostHog): nada acontece e nada quebra', () => {
    const analytics = criarAnalytics(null)
    expect(analytics.track('onboarding_started', {})).toBe(false)
    expect(analytics.identificar('u_test')).toBe(false)
    expect(() => analytics.resetar()).not.toThrow()
  })

  it('se o PostHog lançar um erro, o app não é afetado', () => {
    const analytics = criarAnalytics({ capture: () => { throw new Error('boom') }, identify: () => { throw new Error('boom') }, reset: () => { throw new Error('boom') } })
    expect(analytics.track('onboarding_started', {})).toBe(false)
    expect(analytics.identificar('u_test')).toBe(false)
    expect(() => analytics.resetar()).not.toThrow()
  })
})

describe('identificar: só o id, nunca e-mail nem nome', () => {
  it('identifica com o id do usuário e com mais nada', () => {
    const { identify, analytics } = cliente()
    expect(analytics.identificar('3f2b8c1e-9d4a-4e6b-8a57-1c2d3e4f5a6b')).toBe(true)
    expect(identify).toHaveBeenCalledWith('3f2b8c1e-9d4a-4e6b-8a57-1c2d3e4f5a6b')
    expect(identify.mock.calls[0]).toHaveLength(1) // sem propriedades da pessoa
  })

  it('aceita o id do usuário de teste', () => {
    const { identify, analytics } = cliente()
    expect(analytics.identificar('u_test')).toBe(true)
    expect(identify).toHaveBeenCalledWith('u_test')
  })

  it.each(['', 'ana@exemplo.com', 'Ana Souza', 'a'.repeat(65), '   '])('recusa %j (não é um id)', id => {
    const { identify, analytics } = cliente()
    expect(analytics.identificar(id)).toBe(false)
    expect(identify).not.toHaveBeenCalled()
  })

  it('resetar chama o reset do cliente (ao sair da conta)', () => {
    const { reset, analytics } = cliente()
    analytics.resetar()
    expect(reset).toHaveBeenCalledOnce()
  })
})

describe('filtrarEnvio: a última barreira antes de qualquer coisa sair do navegador', () => {
  const evento = (event: string, properties: Record<string, unknown> = {}, extra: object = {}) => ({ uuid: 'u', event, properties, ...extra }) as never

  it('os seis eventos passam com as propriedades que têm', () => {
    for (const nome of EVENTOS) {
      const r = filtrarEnvio(evento(nome, { sheet_name: 'x' }))
      expect(r, nome).not.toBeNull()
      expect(r!.event).toBe(nome)
    }
  })

  it('o $identify também passa (é como o PostHog liga o id à pessoa)', () => {
    expect(filtrarEnvio(evento('$identify', { distinct_id: 'u_test', $anon_distinct_id: 'abc' }))).not.toBeNull()
  })

  it.each(['$pageview', '$pageleave', '$autocapture', '$snapshot', '$exception', '$dead_click', '$heatmap', '$web_vitals', '$rageclick', '$feature_flag_called', '$groupidentify', '$create_alias', 'qualquer_outro'])(
    '%s é descartado: nada que não esteja na lista sai do aparelho', nome => {
      expect(filtrarEnvio(evento(nome, { $el_text: 'texto da tela' }))).toBeNull()
    })

  it('entrada vazia ou sem nome de evento: descartada', () => {
    expect(filtrarEnvio(null)).toBeNull()
    expect(filtrarEnvio({ uuid: 'u', properties: {} } as never)).toBeNull()
  })

  it('a URL perde a query e o hash (a volta do pagamento traz o id de uma sessão do Stripe)', () => {
    const r = filtrarEnvio(evento('tab_changed', {
      tab_name: 'perfil',
      $current_url: 'https://corner2.vercel.app/assinatura?checkout=ok&session_id=cs_test_a1B2c3#topo',
      $referrer: 'https://checkout.stripe.com/c/pay/cs_test_a1B2c3?x=1',
      $initial_referrer: 'https://exemplo.com/p?token=segredo',
    }))
    expect(r!.properties.$current_url).toBe('https://corner2.vercel.app/assinatura')
    expect(r!.properties.$referrer).toBe('https://checkout.stripe.com/c/pay/cs_test_a1B2c3')
    expect(r!.properties.$initial_referrer).toBe('https://exemplo.com/p')
    expect(JSON.stringify(r)).not.toMatch(/session_id|token=|segredo|#topo/)
  })

  it('URL que não dá para interpretar também é cortada na query', () => {
    const r = filtrarEnvio(evento('tab_changed', { tab_name: 'hoje', $current_url: '/hoje?x=1&y=2#z' }))
    expect(r!.properties.$current_url).toBe('/hoje')
  })

  it('propriedades de pessoa ($set e $set_once) são removidas: ninguém ganha e-mail, nome nem referência inicial', () => {
    const r = filtrarEnvio(evento('onboarding_started', {}, { $set: { email: 'ana@exemplo.com' }, $set_once: { $initial_referrer: 'x' }, $unset: ['a'] }))
    expect(r).not.toBeNull()
    expect(r).not.toHaveProperty('$set')
    expect(r).not.toHaveProperty('$set_once')
    const identify = filtrarEnvio(evento('$identify', { distinct_id: 'u_test' }, { $set: { email: 'ana@exemplo.com', name: 'Ana' } }))
    expect(identify).not.toHaveProperty('$set')
  })

  it('qualquer propriedade com cara de e-mail é removida, mesmo que alguém a coloque por engano', () => {
    const r = filtrarEnvio(evento('tab_changed', { tab_name: 'perfil', contato: 'ana@exemplo.com', $current_url: 'https://corner2.vercel.app/perfil' }))
    expect(r!.properties).not.toHaveProperty('contato')
    expect(r!.properties.tab_name).toBe('perfil')
  })

  it('não altera o objeto recebido', () => {
    const original = evento('tab_changed', { tab_name: 'perfil', $current_url: 'https://x.com/a?b=1' })
    const copia = JSON.parse(JSON.stringify(original))
    filtrarEnvio(original)
    expect(JSON.parse(JSON.stringify(original))).toEqual(copia)
  })
})

describe('configuracaoDoPostHog: o que fica desligado (o app guarda dados de saúde)', () => {
  const config = configuracaoDoPostHog('https://us.i.posthog.com')

  it('não grava a tela, não captura cliques nem textos e não rastreia páginas sozinho', () => {
    expect(config).toMatchObject({
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      capture_heatmaps: false,
      capture_dead_clicks: false,
      capture_exceptions: false,
    })
  })

  it('não carrega scripts extras nem recursos remotos (pesquisas, experimentos, flags)', () => {
    expect(config).toMatchObject({
      disable_external_dependency_loading: true,
      disable_surveys: true,
      disable_web_experiments: true,
      disable_conversations: true,
      advanced_disable_flags: true,
    })
  })

  it('só cria perfil de pessoa depois de identificar, guarda só no aparelho (sem cookie) e respeita "não rastrear"', () => {
    expect(config).toMatchObject({ person_profiles: 'identified_only', persistence: 'localStorage', respect_dnt: true, save_campaign_params: false })
  })

  it('usa o endereço informado e o filtro de envio', () => {
    expect(config.api_host).toBe('https://us.i.posthog.com')
    expect(config.before_send).toBe(filtrarEnvio)
  })
})
