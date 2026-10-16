// Catálogo das assinaturas do Corner: níveis, preços, períodos e o que cada nível libera.
// É a ÚNICA fonte desses dados: o Stripe, as telas e as regras de acesso leem daqui.
// Para mudar um preço ou mover um recurso de plano, mude só este arquivo (e rode os testes).

export const NIVEIS = ['iniciante', 'amador', 'profissional'] as const
export type NivelAssinatura = (typeof NIVEIS)[number]

export const PERIODOS = ['mensal', 'anual'] as const
export type Periodo = (typeof PERIODOS)[number]

export const NOME_DO_NIVEL: Record<NivelAssinatura, string> = {
  iniciante: 'Iniciante',
  amador: 'Amador',
  profissional: 'Profissional',
}

/** Preço mensal em centavos de real (nunca em decimal: evita erro de arredondamento). */
export const PRECO_MENSAL_CENTAVOS: Record<NivelAssinatura, number> = {
  iniciante: 3990,
  amador: 5290,
  profissional: 6990,
}

/**
 * Quantos meses o plano anual cobra. 10 = dois meses grátis; 11 = um mês grátis.
 * Decisão de negócio ainda em aberto (veja docs/plano-pagamento.md).
 */
export const ANUAL_EM_MESES = 10

/** Teste grátis, sem cartão. */
export const TESTE_GRATIS_DIAS = 7

export const ordemDoNivel = (nivel: NivelAssinatura): number => NIVEIS.indexOf(nivel)

/** Quem não tem assinatura (ou está com ela vencida) usa o modo gratuito, que é menor que o Iniciante. */
export const NIVEL_GRATUITO = 'gratuito' as const
export type NivelDeAcesso = typeof NIVEL_GRATUITO | NivelAssinatura

/** Ordem de acesso: o gratuito vem antes de todos os planos pagos. */
export const ordemDeAcesso = (nivel: NivelDeAcesso): number => (nivel === NIVEL_GRATUITO ? -1 : ordemDoNivel(nivel))

export const NOME_DO_ACESSO: Record<NivelDeAcesso, string> = { gratuito: 'Gratuito', ...NOME_DO_NIVEL }

export function precoEmCentavos(nivel: NivelAssinatura, periodo: Periodo): number {
  return PRECO_MENSAL_CENTAVOS[nivel] * (periodo === 'anual' ? ANUAL_EM_MESES : 1)
}

/** "R$ 1.234,50". Montado à mão para não mudar com o idioma do computador ou do servidor. */
export function formatarPreco(centavos: number): string {
  const reais = Math.floor(centavos / 100)
  const resto = String(centavos % 100).padStart(2, '0')
  const milhares = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `R$ ${milhares},${resto}`
}

// ── Nome de cada preço no Stripe ─────────────────────────────

/** O Stripe guarda cada preço com esta chave: `iniciante_mensal`, `amador_anual`... */
export const lookupKey = (nivel: NivelAssinatura, periodo: Periodo): string => `${nivel}_${periodo}`

export function nivelDeLookupKey(chave: string | null | undefined): { nivel: NivelAssinatura; periodo: Periodo } | null {
  if (!chave) return null
  for (const nivel of NIVEIS) {
    for (const periodo of PERIODOS) {
      if (lookupKey(nivel, periodo) === chave) return { nivel, periodo }
    }
  }
  return null
}

// ── O que cada nível libera ──────────────────────────────────

export interface Recurso {
  nome: string
  /** Menor nível que libera o recurso. `gratuito` = qualquer pessoa, com ou sem assinatura. */
  nivelMinimo: NivelDeAcesso
}

export const RECURSOS = {
  // Gratuito: o suficiente para treinar, registrar e se proteger. Segurança nunca fica atrás de plano pago.
  registroTreino: { nome: 'Registrar treino, histórico e progresso', nivelMinimo: 'gratuito' },
  cronometro: { nome: 'Cronômetro de rounds', nivelMinimo: 'gratuito' },
  alertasSeguranca: { nome: 'Registrar pancadas na cabeça e lesões, com os alertas de segurança', nivelMinimo: 'gratuito' },
  exportarDados: { nome: 'Exportar os próprios dados', nivelMinimo: 'gratuito' },

  biblioteca: { nome: 'Biblioteca técnica', nivelMinimo: 'iniciante' },
  planoFundamentos: { nome: 'Plano de treino Fundamentos', nivelMinimo: 'iniciante' },

  planosIntermediarios: { nome: 'Planos Base Aeróbica e Técnica Avançada', nivelMinimo: 'amador' },
  checkin: { nome: 'Check-in diário e ajuste do treino do dia', nivelMinimo: 'amador' },
  carga: { nome: 'Carga de treino e alerta de sobrecarga', nivelMinimo: 'amador' },
  saude: { nome: 'Peso, categoria e gráfico de peso', nivelMinimo: 'amador' },
  reagendar: { nome: 'Reagendar sessões', nivelMinimo: 'amador' },

  planoPreCompeticao: { nome: 'Plano Pré-competição', nivelMinimo: 'profissional' },
  sparringDetalhado: { nome: 'Intensidade e parceiro no sparring, e resumo de pancadas dos últimos 30 dias', nivelMinimo: 'profissional' },
  perdaRapidaPeso: { nome: 'Alerta de perda rápida de peso', nivelMinimo: 'profissional' },
  importarDados: { nome: 'Importar backup', nivelMinimo: 'profissional' },
  lembrete: { nome: 'Lembrete diário', nivelMinimo: 'profissional' },
} as const satisfies Record<string, Recurso>

export type RecursoId = keyof typeof RECURSOS

/** Lê um recurso com o tipo completo (o objeto acima guarda cada nome como literal). */
export const recurso = (id: RecursoId): Recurso => RECURSOS[id]

/** Cada plano de treino do app (data/planos.ts) pertence a um recurso. */
export const RECURSO_DO_PLANO_DE_TREINO: Record<string, RecursoId> = {
  fundamentos: 'planoFundamentos',
  'base-aerobica': 'planosIntermediarios',
  'tecnica-avancada': 'planosIntermediarios',
  'pre-competicao': 'planoPreCompeticao',
}
