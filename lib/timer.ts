// Cronômetro livre (aba Timer): configuração, limites, validação do que vem do aparelho e textos. Funções puras.

export const LIMITES = {
  rounds: { min: 1, max: 20 },
  /** Duração do round em segundos: de 1:00 a 5:00, de 30 em 30. */
  roundSeg: { min: 60, max: 300, passo: 30 },
} as const

/** Descansos oferecidos, em segundos: 30 s, 1, 2 e 3 minutos. */
export const DESCANSOS_SEG = [30, 60, 120, 180] as const

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

export const CONFIG_PADRAO: ConfigTimer = { rounds: 3, roundSeg: 180, descansoSeg: 60, preparo: true, vibracao: true, volume: 80, mudo: false }

const entre = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

export const somarRounds = (rounds: number, delta: number): number => entre(rounds + delta, LIMITES.rounds.min, LIMITES.rounds.max)

/** `passos` de 30 s para cima (positivo) ou para baixo (negativo). */
export const somarRoundSeg = (seg: number, passos: number): number =>
  entre(seg + passos * LIMITES.roundSeg.passo, LIMITES.roundSeg.min, LIMITES.roundSeg.max)

/** 90 -> "01:30". Negativo, quebrado ou inválido não gera texto estranho. */
export function formatarTempo(seg: number): string {
  const s = Number.isFinite(seg) ? Math.max(0, Math.round(seg)) : 0
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export function rotuloDoDescanso(seg: number): string {
  return seg >= 60 && seg % 60 === 0 ? `${seg / 60} min` : `${seg} s`
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
  const { min, max, passo } = LIMITES.roundSeg
  const roundSeg = ehNumero(v.roundSeg) ? entre(min + Math.round((v.roundSeg - min) / passo) * passo, min, max) : padrao.roundSeg
  const descansoSeg = (DESCANSOS_SEG as readonly unknown[]).includes(v.descansoSeg) ? (v.descansoSeg as number) : padrao.descansoSeg
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
