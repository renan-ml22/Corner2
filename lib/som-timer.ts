// Sons do Timer, gerados na hora com Web Audio (sem arquivos de áudio e sem biblioteca):
// o sino de ringue (início do round, fim do round e fim do treino), a contagem 3-2-1 e o aviso dos 10 segundos.
// O volume é lido na hora de programar cada aviso (o cronômetro programa tudo de uma vez e reprograma o que falta quando
// o volume ou o mudo mudam).

export interface Bipe {
  /** Hz */
  freq: number
  /** Segundos depois do início do aviso */
  inicio: number
  /** Segundos */
  duracao: number
  /** Forma da onda (padrão: senoide). A quadrada soa bem mais alta que a senoide com o mesmo ganho. */
  onda?: OscillatorType
  /** Fração do ganho pedido (padrão: 1) */
  forca?: number
}

// ── O sino ───────────────────────────────────────────────────

/** Um tom do sino. `razao` multiplica a frequência-base; `ganho` e `duracao` são relativos (a duração é fração da badalada). */
export interface ParcialDoSino {
  razao: number
  ganho: number
  duracao: number
}

export const FREQ_BASE_DO_SINO = 1000

/**
 * Um sino de metal não toca uma nota só: toca vários tons que não são múltiplos uns dos outros, e os agudos somem antes
 * dos graves. É isso que separa o "dinnng" de um apito. Os tons ficam entre 560 e 4070 Hz: o alto-falante pequeno do
 * celular quase não reproduz o que está abaixo de 400 Hz, mas reproduz bem a faixa de 2 a 4 kHz.
 */
export const PARCIAIS_DO_SINO: ParcialDoSino[] = [
  { razao: 0.56, ganho: 1.0, duracao: 1.0 },
  { razao: 0.92, ganho: 0.8, duracao: 0.8 },
  { razao: 1.19, ganho: 1.0, duracao: 0.6 },
  { razao: 1.71, ganho: 1.2, duracao: 0.5 },
  { razao: 2.0, ganho: 1.0, duracao: 0.4 },
  { razao: 2.74, ganho: 1.0, duracao: 0.3 },
  { razao: 3.0, ganho: 0.8, duracao: 0.25 },
  { razao: 3.76, ganho: 0.7, duracao: 0.18 },
  { razao: 4.07, ganho: 0.6, duracao: 0.12 },
]

/** Uma batida do sino: quando começa (segundos depois do início do aviso) e quanto tempo ele soa. */
export interface Badalada {
  inicio: number
  duracao: number
}

/** O "dinnng" que abre o round. */
export const BADALADAS_INICIO_DE_ROUND: Badalada[] = [{ inicio: 0, duracao: 2.6 }]

/** "Ting ting ting": o fim do round, que leva ao descanso. */
export const BADALADAS_FIM_DE_ROUND: Badalada[] = [
  { inicio: 0, duracao: 1.4 },
  { inicio: 0.5, duracao: 1.4 },
  { inicio: 1.0, duracao: 2.4 },
]

/** Fim de todos os rounds: uma batida a mais que o fim de round, a última longa. */
export const BADALADAS_FIM_DO_TREINO: Badalada[] = [
  { inicio: 0, duracao: 1.2 },
  { inicio: 0.5, duracao: 1.2 },
  { inicio: 1.0, duracao: 1.2 },
  { inicio: 1.7, duracao: 3.5 },
]

/**
 * Quanto os tons são amplificados antes da saturação suave (curva `tanh`, que nunca passa de 1). Um sino tem o pico no
 * começo e some logo: sem isso ele sai bem mais baixo que um bipe do mesmo volume. Medindo o som renderizado, com 3 o
 * sino fica uns 4 dB acima do bipe de 880 Hz que o Timer tocava antes, no mesmo volume.
 */
export const SATURACAO_DO_SINO = 3

/** A curva de saturação: suave perto de 0 e achatada perto de ±1; vai de -1 a 1. */
function curvaDeSaturacao(): Float32Array<ArrayBuffer> {
  const n = 2048
  const curva = new Float32Array(n)
  for (let i = 0; i < n; i++) curva[i] = Math.tanh(((i / (n - 1)) * 2 - 1) * 2) / Math.tanh(2)
  return curva
}

// ── Bipes ────────────────────────────────────────────────────

/** Faltam 10 segundos para o fim do round. */
export const BIPES_AVISO_10S: Bipe[] = [{ freq: 660, inicio: 0, duracao: 0.2 }]

/** Contagem dos últimos 3 segundos: seco e cada vez mais agudo (3 -> 2 -> 1), bem diferente do sino. */
const CONTAGEM: Record<1 | 2 | 3, Bipe> = {
  3: { freq: 1000, inicio: 0, duracao: 0.15, onda: 'square', forca: 0.6 },
  2: { freq: 1250, inicio: 0, duracao: 0.15, onda: 'square', forca: 0.6 },
  1: { freq: 1600, inicio: 0, duracao: 0.25, onda: 'square', forca: 0.6 },
}

export function bipeDeContagem(restante: number): Bipe[] {
  const n = Number.isFinite(restante) ? Math.min(3, Math.max(1, Math.round(restante))) : 1
  return [CONTAGEM[n as 1 | 2 | 3]]
}

// ── Volume ───────────────────────────────────────────────────

/** Força máxima do som (o volume de 100%). */
const GANHO_MAXIMO = 1

/** Volume de 0 a 100 (e o botão de mudo) vira a força do som, de 0 a GANHO_MAXIMO. */
export function ganhoDoVolume(volume: number, mudo: boolean): number {
  if (mudo || !Number.isFinite(volume)) return 0
  return (Math.min(100, Math.max(0, volume)) / 100) * GANHO_MAXIMO
}

// ── Tocar ────────────────────────────────────────────────────

/** Folga para agendar o som sem cair no passado. */
const FOLGA_S = 0.02

/** Toca os bipes. O áudio precisa ter nascido de um toque do usuário (ver `criarAudio` em lib/som.ts). */
export function tocarBipes(ctx: AudioContext | null, bipes: Bipe[], ganho: number): void {
  if (!ctx || ganho <= 0) return
  const t0 = ctx.currentTime + FOLGA_S
  for (const b of bipes) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    const inicio = t0 + b.inicio
    const fim = inicio + b.duracao
    const pico = ganho * (b.forca ?? 1)
    osc.type = b.onda ?? 'sine'
    osc.frequency.value = b.freq
    // Sobe e desce rápido, para o bipe não estalar no começo e no fim.
    const rampa = Math.min(0.01, b.duracao / 4)
    g.gain.setValueAtTime(0, inicio)
    g.gain.linearRampToValueAtTime(pico, inicio + rampa)
    g.gain.setValueAtTime(pico, fim - rampa)
    g.gain.linearRampToValueAtTime(0, fim)
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start(inicio)
    osc.stop(fim + FOLGA_S)
  }
}

/**
 * Toca as badaladas do sino. Os tons somam 1; depois são amplificados e saturados (o som engorda sem passar de 1),
 * e só então o volume pedido é aplicado.
 */
export function tocarBadaladas(ctx: AudioContext | null, badaladas: Badalada[], ganho: number): void {
  if (!ctx || ganho <= 0) return
  const barra = ctx.createGain()
  barra.gain.value = SATURACAO_DO_SINO
  const saturacao = ctx.createWaveShaper()
  saturacao.curve = curvaDeSaturacao()
  const volume = ctx.createGain()
  volume.gain.value = ganho
  barra.connect(saturacao)
  saturacao.connect(volume)
  volume.connect(ctx.destination)

  const soma = PARCIAIS_DO_SINO.reduce((s, p) => s + p.ganho, 0)
  const t0 = ctx.currentTime + FOLGA_S
  for (const b of badaladas) {
    const inicio = t0 + b.inicio
    for (const p of PARCIAIS_DO_SINO) {
      const fim = inicio + b.duracao * p.duracao
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = FREQ_BASE_DO_SINO * p.razao
      // A pancada é instantânea; depois o som vai sumindo, rápido no começo e devagar no fim (como o metal), e fecha em zero.
      g.gain.setValueAtTime(0, inicio)
      g.gain.linearRampToValueAtTime(p.ganho / soma, inicio + 0.004)
      g.gain.exponentialRampToValueAtTime(0.02, fim - 0.03)
      g.gain.linearRampToValueAtTime(0, fim)
      osc.connect(g)
      g.connect(barra)
      osc.start(inicio)
      osc.stop(fim + FOLGA_S)
    }
  }
}

export interface AjusteDeSom {
  volume: number
  mudo: boolean
}

/** Os avisos do cronômetro (hooks/useCronometro.ts) com os sons do Timer. */
export function criarSonsDoTimer(ler: () => AjusteDeSom) {
  const ganho = () => {
    const { volume, mudo } = ler()
    return ganhoDoVolume(volume, mudo)
  }
  return {
    inicioRound: (ctx: AudioContext | null) => tocarBadaladas(ctx, BADALADAS_INICIO_DE_ROUND, ganho()),
    inicioDescanso: (ctx: AudioContext | null) => tocarBadaladas(ctx, BADALADAS_FIM_DE_ROUND, ganho()),
    aviso: (ctx: AudioContext | null) => tocarBipes(ctx, BIPES_AVISO_10S, ganho()),
    contagem: (ctx: AudioContext | null, restante: number) => tocarBipes(ctx, bipeDeContagem(restante), ganho()),
    fim: (ctx: AudioContext | null) => tocarBadaladas(ctx, BADALADAS_FIM_DO_TREINO, ganho()),
  }
}
