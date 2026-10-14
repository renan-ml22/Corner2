// Sons do cronômetro, sintetizados com Web Audio (sem arquivos de áudio).

type CtxAudio = AudioContext

export function criarAudio(): CtxAudio | null {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    const ctx = new Ctor()
    // Navegadores só liberam o áudio depois de um toque do usuário: este é criado dentro de um clique.
    void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

/** Uma batida de sino de boxe: parciais inarmônicos com decaimento longo. */
function sino(ctx: CtxAudio, quando: number) {
  const base = 620
  const parciais: [number, number, number][] = [[1, 0.5, 1.8], [2.0, 0.3, 1.3], [2.76, 0.25, 1.0], [5.4, 0.12, 0.6], [8.93, 0.06, 0.4]]
  for (const [razao, ganho, duracao] of parciais) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = base * razao
    g.gain.setValueAtTime(0.0001, quando)
    g.gain.exponentialRampToValueAtTime(ganho, quando + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, quando + duracao)
    osc.connect(g).connect(ctx.destination)
    osc.start(quando)
    osc.stop(quando + duracao + 0.05)
  }
}

export function tocarSino(ctx: CtxAudio | null, vezes = 1) {
  if (!ctx) return
  const t0 = ctx.currentTime + 0.02
  for (let i = 0; i < vezes; i++) sino(ctx, t0 + i * 0.45)
}

/** Aviso dos 10 segundos finais: dois estalos secos, como a "matraca" do ringue. */
export function tocarMatraca(ctx: CtxAudio | null) {
  if (!ctx) return
  const t0 = ctx.currentTime + 0.02
  for (let i = 0; i < 2; i++) {
    const t = t0 + i * 0.14
    const dur = 0.05
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate)
    const dados = buffer.getChannelData(0)
    for (let n = 0; n < dados.length; n++) dados[n] = (Math.random() * 2 - 1) * (1 - n / dados.length)
    const fonte = ctx.createBufferSource()
    fonte.buffer = buffer
    const filtro = ctx.createBiquadFilter()
    filtro.type = 'bandpass'
    filtro.frequency.value = 1900
    const g = ctx.createGain()
    g.gain.value = 0.9
    fonte.connect(filtro).connect(g).connect(ctx.destination)
    fonte.start(t)
  }
}

/** Bip curto da contagem regressiva. */
export function tocarBip(ctx: CtxAudio | null, agudo = false) {
  if (!ctx) return
  const t = ctx.currentTime + 0.01
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = agudo ? 1175 : 880
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
  osc.connect(g).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + 0.2)
}

export function vibrar(padrao: number | number[]) {
  try {
    navigator.vibrate?.(padrao)
  } catch {
    // Sem suporte (iOS, desktop): ignora.
  }
}
