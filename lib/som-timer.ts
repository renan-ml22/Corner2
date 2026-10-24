// Sons do Timer, gerados na hora com Web Audio (sem arquivos de áudio e sem biblioteca).
// O volume é lido na hora de cada aviso, então mudar o controle com o cronômetro rodando vale na hora.

export interface Bipe {
  /** Hz */
  freq: number
  /** Segundos depois do início do aviso */
  inicio: number
  /** Segundos */
  duracao: number
}

/** Campainha de ringue: 3 bipes curtos (100 ms, com 150 ms entre eles) e 1 longo de 600 ms. */
export const BIPES_INICIO_DE_ROUND: Bipe[] = [
  { freq: 880, inicio: 0, duracao: 0.1 },
  { freq: 880, inicio: 0.25, duracao: 0.1 },
  { freq: 880, inicio: 0.5, duracao: 0.1 },
  { freq: 880, inicio: 0.75, duracao: 0.6 },
]

/** Faltam 10 segundos para o fim do round. */
export const BIPES_AVISO_10S: Bipe[] = [{ freq: 660, inicio: 0, duracao: 0.2 }]

/** Fim de um round e começo do descanso. */
export const BIPES_FIM_DE_ROUND: Bipe[] = [{ freq: 440, inicio: 0, duracao: 0.8 }]

/** Fim de todos os rounds: três bipes longos, cada um mais agudo, com uma pausa curta entre eles. */
export const BIPES_FIM_DO_TREINO: Bipe[] = [
  { freq: 880, inicio: 0, duracao: 0.4 },
  { freq: 1100, inicio: 0.45, duracao: 0.4 },
  { freq: 1320, inicio: 0.9, duracao: 0.4 },
]

/** Bip curto da contagem dos últimos segundos do preparo e do descanso. */
const BIPE_DE_CONTAGEM: Bipe[] = [{ freq: 880, inicio: 0, duracao: 0.12 }]

/** Força máxima do som (1 estouraria o alto-falante, e vários bipes seguidos somam). */
const GANHO_MAXIMO = 0.6

/** Volume de 0 a 100 (e o botão de mudo) vira a força do som, de 0 a GANHO_MAXIMO. */
export function ganhoDoVolume(volume: number, mudo: boolean): number {
  if (mudo || !Number.isFinite(volume)) return 0
  return (Math.min(100, Math.max(0, volume)) / 100) * GANHO_MAXIMO
}

/** Toca os bipes. O áudio precisa ter nascido de um toque do usuário (ver `criarAudio` em lib/som.ts). */
export function tocarBipes(ctx: AudioContext | null, bipes: Bipe[], ganho: number): void {
  if (!ctx || ganho <= 0) return
  const t0 = ctx.currentTime + 0.02
  for (const b of bipes) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    const inicio = t0 + b.inicio
    const fim = inicio + b.duracao
    osc.type = 'sine'
    osc.frequency.value = b.freq
    // Sobe e desce rápido, para o bipe não estalar no começo e no fim.
    const rampa = Math.min(0.01, b.duracao / 4)
    g.gain.setValueAtTime(0, inicio)
    g.gain.linearRampToValueAtTime(ganho, inicio + rampa)
    g.gain.setValueAtTime(ganho, fim - rampa)
    g.gain.linearRampToValueAtTime(0, fim)
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start(inicio)
    osc.stop(fim + 0.02)
  }
}

export interface AjusteDeSom {
  volume: number
  mudo: boolean
}

/** Os mesmos cinco avisos que o cronômetro do treino usa (hooks/useCronometro.ts), com os sons do Timer. */
export function criarSonsDoTimer(ler: () => AjusteDeSom) {
  const tocar = (ctx: AudioContext | null, bipes: Bipe[]) => {
    const { volume, mudo } = ler()
    tocarBipes(ctx, bipes, ganhoDoVolume(volume, mudo))
  }
  return {
    inicioRound: (ctx: AudioContext | null) => tocar(ctx, BIPES_INICIO_DE_ROUND),
    inicioDescanso: (ctx: AudioContext | null) => tocar(ctx, BIPES_FIM_DE_ROUND),
    aviso: (ctx: AudioContext | null) => tocar(ctx, BIPES_AVISO_10S),
    contagem: (ctx: AudioContext | null) => tocar(ctx, BIPE_DE_CONTAGEM),
    fim: (ctx: AudioContext | null) => tocar(ctx, BIPES_FIM_DO_TREINO),
  }
}
