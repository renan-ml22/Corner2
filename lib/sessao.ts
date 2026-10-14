import type { Nivel, Plano } from '@/data/planos'
import { isRegType, type Experiencia, type RegType } from './tipos'

/** Nível usado para escolher combinações e focos: o do plano ativo ou, sem plano, a experiência do atleta. */
export function nivelDoAtleta(plano: Plano | null, experiencia: Experiencia | null): Nivel {
  if (plano) return plano.nivel
  if (experiencia === 'nenhuma' || experiencia === 'ate1') return 'iniciante'
  if (experiencia === 'mais3') return 'avancado'
  return 'intermediario'
}

export interface ParamsTreino {
  tipo: RegType
  rounds: number
  /** Minutos por round (aceita fração, ex.: 0.5) */
  minPorRound: number
  descansoSeg: number
  nivel: Nivel
  sessaoId?: string
}

const NIVEIS: Nivel[] = ['iniciante', 'intermediario', 'avancado']

export function urlTreino(p: ParamsTreino): string {
  const q = new URLSearchParams({
    tipo: p.tipo,
    rounds: String(p.rounds),
    min: String(p.minPorRound),
    descanso: String(p.descansoSeg),
    nivel: p.nivel,
  })
  if (p.sessaoId) q.set('sessao', p.sessaoId)
  return `/treino?${q.toString()}`
}

/** Parâmetro ausente ou vazio vira NaN (e cai no padrão); `Number(null)` e `Number('')` dariam 0. */
const numero = (v: string | null) => (v === null || v.trim() === '' ? NaN : Number(v))
const limitar = (v: number, min: number, max: number, padrao: number) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : padrao)

/** Lê e sanitiza os parâmetros da URL: nunca confia no que veio de fora. */
export function lerParamsTreino(q: URLSearchParams): ParamsTreino {
  const tipo = q.get('tipo')
  const nivel = q.get('nivel')
  return {
    tipo: isRegType(tipo) ? tipo : 'tec',
    rounds: Math.round(limitar(numero(q.get('rounds')), 1, 20, 4)),
    minPorRound: limitar(numero(q.get('min')), 0.05, 10, 3),
    descansoSeg: Math.round(limitar(numero(q.get('descanso')), 0, 300, 60)),
    nivel: NIVEIS.find(n => n === nivel) ?? 'intermediario',
    sessaoId: q.get('sessao') ?? undefined,
  }
}
