// Quais alertas aparecem em cada plano. Os de segurança (pancadas na cabeça, lesões, sparring seguido,
// treino muito intenso) NUNCA ficam atrás de plano pago.

import type { Alerta } from '@/lib/saude'
import type { RecursoId } from './catalogo'

const POR_ID: Record<string, RecursoId> = {
  'cabeca-recente': 'alertasSeguranca',
  'cabeca-retorno': 'alertasSeguranca',
  'sparring-intervalo': 'alertasSeguranca',
  'rpe-alto': 'alertasSeguranca',
  carga: 'carga',
  'retorno-pausa': 'carga',
  'meta-batida': 'registroTreino',
  'meta-risco': 'registroTreino',
}

/**
 * De qual recurso o alerta depende. Alerta sem classificação cai em segurança (gratuito):
 * é melhor mostrar um aviso a mais do que esconder um de saúde por esquecimento.
 */
export function recursoDoAlerta(id: string): RecursoId {
  if (id.startsWith('lesao-')) return 'alertasSeguranca'
  return POR_ID[id] ?? 'alertasSeguranca'
}

/** Só os alertas que o plano da pessoa inclui, na mesma ordem. */
export function filtrarAlertas(alertas: Alerta[], podeUsar: (recurso: RecursoId) => boolean): Alerta[] {
  return alertas.filter(a => podeUsar(recursoDoAlerta(a.id)))
}
