// Cronômetro livre (aba Timer): configuração, limites, validação do que vem do aparelho e textos. Funções puras.

export const LIMITES = {
  rounds: { min: 1, max: 20 },
  /** Duração do round em segundos: de 0:10 a 10:00, de segundo em segundo. */
  roundSeg: { min: 10, max: 600 },
  /** Descanso entre rounds em segundos: de 0 (sem descanso) a 10:00, de segundo em segundo. */
  descansoSeg: { min: 0, max: 600 },
} as const

export interface ConfigTimer {
  rounds: number
  roundSeg: number
  descansoSeg: number
  /** Contagem regressiva de 10 s antes do primeiro round. */
  preparo: boolean
  vibracao: boolean
  /** De 0 a 100. */
  volume: number
  mudo: boolean
}

export const CONFIG_PADRAO: ConfigTimer = { rounds: 3, roundSeg: 180, descansoSeg: 60, preparo: true, vibracao: true, volume: 100, mudo: false }

const entre = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

export const somarRounds = (rounds: number, delta: number): number => entre(rounds + delta, LIMITES.rounds.min, LIMITES.rounds.max)

/** 185 -> 3 min e 5 s. Negativo ou inválido vira 0. */
export function separarTempo(seg: number): { minutos: number; segundos: number } {
  const s = Number.isFinite(seg) ? Math.max(0, Math.round(seg)) : 0
  return { minutos: Math.floor(s / 60), segundos: s % 60 }
}

/** Minutos + segundos (0 a 59) viram o total em segundos, sempre dentro dos limites. */
export function juntarTempo(minutos: number, segundos: number, { min, max }: { min: number; max: number }): number {
  const total = (Number.isFinite(minutos) ? Math.round(minutos) : 0) * 60 + (Number.isFinite(segundos) ? Math.round(segundos) : 0)
  return entre(total, min, max)
}

/** 90 -> "01:30". Negativo, quebrado ou inválido não gera texto estranho. */
export function formatarTempo(seg: number): string {
  const s = Number.isFinite(seg) ? Math.max(0, Math.round(seg)) : 0
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** O tempo do round em minutos, como o registro do treino guarda (90 s -> 1,5), com no máximo 2 casas. */
export const minutosDoRound = (seg: number): number => Math.round((seg / 60) * 100) / 100

/** 0 -> "sem descanso", 30 -> "30 s", 60 -> "1 min", 90 -> "1 min 30 s". */
export function rotuloDoDescanso(seg: number): string {
  const { minutos, segundos } = separarTempo(seg)
  if (minutos === 0 && segundos === 0) return 'sem descanso'
  return [minutos > 0 ? `${minutos} min` : '', segundos > 0 ? `${segundos} s` : ''].filter(Boolean).join(' ')
}

/** O que a tela mostra: as quatro fases do treino, mais "pronto" (antes de iniciar). */
export type FaseVisual = 'pronto' | 'preparo' | 'round' | 'descanso' | 'fim'

const ROTULO_DA_FASE: Record<FaseVisual, string> = { pronto: 'PRONTO', preparo: 'PREPARAÇÃO', round: 'ROUND', descanso: 'DESCANSO', fim: 'FIM' }
export const rotuloDaFase = (fase: FaseVisual): string => ROTULO_DA_FASE[fase]

export const PREPARO_DO_TIMER_SEG = 10

/** Duração total, em segundos: preparo, rounds e descansos (só entre os rounds). */
export function duracaoTotal(c: Pick<ConfigTimer, 'rounds' | 'roundSeg' | 'descansoSeg' | 'preparo'>): number {
  return (c.preparo ? PREPARO_DO_TIMER_SEG : 0) + c.rounds * c.roundSeg + (c.rounds - 1) * c.descansoSeg
}

// ── O que vem do aparelho ────────────────────────────────────

const ehNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/**
 * Transforma qualquer coisa lida do aparelho numa configuração válida. Campo por campo: o que está errado volta ao
 * padrão e o que está certo fica; números fora do limite são ajustados ao limite mais próximo.
 */
export function normalizarConfig(valor: unknown): ConfigTimer {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return { ...CONFIG_PADRAO }
  const v = valor as Record<string, unknown>
  const padrao = CONFIG_PADRAO

  const rounds = ehNumero(v.rounds) ? entre(Math.round(v.rounds), LIMITES.rounds.min, LIMITES.rounds.max) : padrao.rounds
  const roundSeg = ehNumero(v.roundSeg) ? entre(Math.round(v.roundSeg), LIMITES.roundSeg.min, LIMITES.roundSeg.max) : padrao.roundSeg
  const descansoSeg = ehNumero(v.descansoSeg) ? entre(Math.round(v.descansoSeg), LIMITES.descansoSeg.min, LIMITES.descansoSeg.max) : padrao.descansoSeg
  const volume = ehNumero(v.volume) ? entre(Math.round(v.volume), 0, 100) : padrao.volume

  return {
    rounds,
    roundSeg,
    descansoSeg,
    preparo: typeof v.preparo === 'boolean' ? v.preparo : padrao.preparo,
    vibracao: typeof v.vibracao === 'boolean' ? v.vibracao : padrao.vibracao,
    volume,
    mudo: typeof v.mudo === 'boolean' ? v.mudo : padrao.mudo,
  }
}

/** Guardado só neste aparelho: som e tempos do cronômetro são um gosto do aparelho, não um dado de saúde. */
export const CHAVE_DO_TIMER = 'corner:timer:config'

/** O texto guardado no aparelho (JSON) vira uma configuração válida; texto quebrado ou ausente vira o padrão. */
export function configDeTexto(texto: string | null | undefined): ConfigTimer {
  try {
    return normalizarConfig(texto ? JSON.parse(texto) : null)
  } catch {
    return { ...CONFIG_PADRAO }
  }
}

export function lerConfig(armazem: Pick<Storage, 'getItem'> | null): ConfigTimer {
  try {
    return configDeTexto(armazem?.getItem(CHAVE_DO_TIMER))
  } catch {
    // Armazenamento bloqueado (navegação privada): usa o padrão.
    return { ...CONFIG_PADRAO }
  }
}

export function gravarConfig(armazem: Pick<Storage, 'setItem'> | null, config: ConfigTimer): void {
  try {
    armazem?.setItem(CHAVE_DO_TIMER, JSON.stringify(config))
  } catch {
    // Cheio ou bloqueado: a tela continua funcionando, só não lembra na próxima vez.
  }
}
