// Regras de acesso: dado o estado da assinatura, o que a pessoa pode usar.
// Puro (sem rede, sem navegador): quem decide é sempre o servidor, a partir do que o Stripe informou.

import {
  NIVEIS, NIVEL_GRATUITO, RECURSO_DO_PLANO_DE_TREINO, ordemDoNivel, recurso,
  type NivelAssinatura, type Periodo, type RecursoId,
} from './catalogo'

export type Situacao = 'nenhuma' | 'teste' | 'ativa' | 'atrasada' | 'cancelada'

export interface EstadoAssinatura {
  situacao: Situacao
  nivel: NivelAssinatura | null
  periodo: Periodo | null
  /** Fim do período já pago (ISO 8601), quando o Stripe informa. */
  fimDoPeriodo: string | null
  /** Fim do teste grátis (ISO 8601), só em `teste`. */
  fimDoTeste: string | null
  /** Marcada para cancelar no fim do período: continua valendo até lá. */
  cancelaNoFim: boolean
}

const SITUACOES: Situacao[] = ['nenhuma', 'teste', 'ativa', 'atrasada', 'cancelada']

/** O valor tem o formato de um `EstadoAssinatura`? Usado ao ler cookie e dado guardado no aparelho. */
export function isEstadoAssinatura(e: unknown): e is EstadoAssinatura {
  if (typeof e !== 'object' || e === null) return false
  const x = e as Record<string, unknown>
  return (
    SITUACOES.includes(x.situacao as Situacao) &&
    (x.nivel === null || NIVEIS.includes(x.nivel as never)) &&
    (x.periodo === null || x.periodo === 'mensal' || x.periodo === 'anual') &&
    (x.fimDoPeriodo === null || typeof x.fimDoPeriodo === 'string') &&
    (x.fimDoTeste === null || typeof x.fimDoTeste === 'string') &&
    typeof x.cancelaNoFim === 'boolean'
  )
}

export const SEM_ASSINATURA: EstadoAssinatura = {
  situacao: 'nenhuma', nivel: null, periodo: null, fimDoPeriodo: null, fimDoTeste: null, cancelaNoFim: false,
}

/** Pagamento atrasado: o acesso continua por este tempo depois do fim do período, enquanto o Stripe tenta cobrar de novo. */
export const DIAS_DE_TOLERANCIA = 3

const DIA_MS = 24 * 60 * 60 * 1000

export function temAcesso(estado: EstadoAssinatura, agora: Date = new Date()): boolean {
  if (estado.nivel === null) return false
  switch (estado.situacao) {
    case 'ativa':
      return true
    case 'teste':
      // O Stripe encerra o teste sozinho; a checagem da data cobre um estado guardado que ficou velho.
      return estado.fimDoTeste === null || Date.parse(estado.fimDoTeste) >= agora.getTime()
    case 'atrasada': {
      if (estado.fimDoPeriodo === null) return false
      return agora.getTime() <= Date.parse(estado.fimDoPeriodo) + DIAS_DE_TOLERANCIA * DIA_MS
    }
    default:
      return false
  }
}

export function podeUsar(id: RecursoId, estado: EstadoAssinatura, agora: Date = new Date()): boolean {
  const { nivelMinimo } = recurso(id)
  if (nivelMinimo === NIVEL_GRATUITO) return true // vale para todos, com ou sem assinatura
  if (!temAcesso(estado, agora) || estado.nivel === null) return false
  return ordemDoNivel(estado.nivel) >= ordemDoNivel(nivelMinimo)
}

/** Um plano de treino do app (`fundamentos`, `base-aerobica`...) está liberado? Plano desconhecido: não. */
export function planoDeTreinoLiberado(planoId: string, estado: EstadoAssinatura, agora: Date = new Date()): boolean {
  const id = RECURSO_DO_PLANO_DE_TREINO[planoId]
  return id !== undefined && podeUsar(id, estado, agora)
}
