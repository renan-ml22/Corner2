import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarSegundoPlano, wavSilencioso } from '@/lib/segundo-plano'

// "Manter o som com a tela bloqueada": um áudio de mídia inaudível em repetição mantém a página viva (o celular a trata
// como um app tocando áudio) e o controle de mídia da tela de bloqueio ganha pausar/retomar do timer.

describe('wavSilencioso', () => {
  const lerTexto = (b: Uint8Array, de: number, n: number) => String.fromCharCode(...b.slice(de, de + n))
  const visao = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength)

  it('é um WAV válido: PCM de 16 bits, um canal, com o tamanho que o cabeçalho diz', () => {
    const b = wavSilencioso()
    const v = visao(b)
    expect(lerTexto(b, 0, 4)).toBe('RIFF')
    expect(lerTexto(b, 8, 4)).toBe('WAVE')
    expect(lerTexto(b, 12, 4)).toBe('fmt ')
    expect(v.getUint16(20, true)).toBe(1) // PCM
    expect(v.getUint16(22, true)).toBe(1) // mono
    expect(v.getUint16(34, true)).toBe(16)
    expect(lerTexto(b, 36, 4)).toBe('data')
    expect(v.getUint32(4, true)).toBe(b.length - 8)
    expect(v.getUint32(40, true)).toBe(b.length - 44)
  })

  it('dura mais de 5 s (o Chrome do Android só mostra o controle de mídia para áudio mais longo que isso)', () => {
    const b = wavSilencioso()
    const v = visao(b)
    const segundos = v.getUint32(40, true) / v.getUint32(28, true) // bytes de som / bytes por segundo
    expect(segundos).toBeGreaterThan(5)
  })

  it('é inaudível: nenhuma amostra passa de ±1 (−90 dB)', () => {
    const b = wavSilencioso()
    const v = visao(b)
    let maximo = 0
    for (let i = 44; i < b.length; i += 2) maximo = Math.max(maximo, Math.abs(v.getInt16(i, true)))
    expect(maximo).toBeLessThanOrEqual(1)
  })
})

describe('criarSegundoPlano', () => {
  class AudioFalso {
    static todos: AudioFalso[] = []
    loop = false
    pausado = true
    src: string
    plays = 0
    falhar = false
    constructor(src: string) { this.src = src; AudioFalso.todos.push(this) }
    play() { this.plays++; this.pausado = false; return this.falhar ? Promise.reject(new Error('NotAllowedError')) : Promise.resolve() }
    pause() { this.pausado = true }
    removeAttribute() { this.src = '' }
    load() {}
  }
  class MetadataFalso { constructor(public dados: { title: string; artist: string }) {} }

  type Acao = 'play' | 'pause'
  let sessao: { metadata: MetadataFalso | null; playbackState: string; handlers: Partial<Record<Acao, (() => void) | null>>; setActionHandler(a: Acao, f: (() => void) | null): void }
  let urls: { criadas: Blob[]; soltas: string[] }

  beforeEach(() => {
    AudioFalso.todos = []
    sessao = {
      metadata: null, playbackState: 'none', handlers: {},
      setActionHandler(a, f) { this.handlers[a] = f },
    }
    urls = { criadas: [], soltas: [] }
    vi.stubGlobal('Audio', AudioFalso)
    vi.stubGlobal('MediaMetadata', MetadataFalso)
    vi.stubGlobal('navigator', { mediaSession: sessao })
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b: Blob | MediaSource) => { urls.criadas.push(b as Blob); return `blob:falso-${urls.criadas.length}` })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((u: string) => { urls.soltas.push(u) })
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  const controles = () => ({ pausar: vi.fn(), retomar: vi.fn() })
  const info = (tocando = true) => ({ titulo: 'Corner · Timer', detalhe: 'Round 2 de 5', tocando })

  it('ligar: toca o áudio inaudível em repetição e mostra o controle de mídia', () => {
    const sp = criarSegundoPlano()
    sp.ligar(controles(), info())
    expect(AudioFalso.todos).toHaveLength(1)
    const a = AudioFalso.todos[0]
    expect(a.loop).toBe(true)
    expect(a.plays).toBe(1)
    expect(a.src).toBe('blob:falso-1')
    expect(urls.criadas[0].type).toBe('audio/wav')
    expect(sessao.metadata?.dados).toEqual({ title: 'Corner · Timer', artist: 'Round 2 de 5' })
    expect(sessao.playbackState).toBe('playing')
  })

  it('os botões da tela de bloqueio pausam e retomam o timer', () => {
    const c = controles()
    criarSegundoPlano().ligar(c, info())
    sessao.handlers.pause?.()
    expect(c.pausar).toHaveBeenCalledTimes(1)
    sessao.handlers.play?.()
    expect(c.retomar).toHaveBeenCalledTimes(1)
  })

  it('atualizar: troca o texto e o estado (tocando/pausado) sem criar outro áudio', () => {
    const sp = criarSegundoPlano()
    sp.ligar(controles(), info())
    sp.atualizar({ titulo: 'Corner · Timer', detalhe: 'Descanso', tocando: false })
    expect(sessao.metadata?.dados.artist).toBe('Descanso')
    expect(sessao.playbackState).toBe('paused')
    sp.atualizar(info(true))
    expect(sessao.playbackState).toBe('playing')
    expect(AudioFalso.todos).toHaveLength(1)
  })

  it('ligar de novo não cria outro áudio, mas passa a valer os botões novos', () => {
    const sp = criarSegundoPlano()
    sp.ligar(controles(), info())
    const novo = controles()
    sp.ligar(novo, info())
    expect(AudioFalso.todos).toHaveLength(1)
    sessao.handlers.pause?.()
    expect(novo.pausar).toHaveBeenCalledTimes(1)
  })

  it('desligar: para o áudio, solta o arquivo e tira o controle de mídia', () => {
    const sp = criarSegundoPlano()
    sp.ligar(controles(), info())
    sp.desligar()
    expect(AudioFalso.todos[0].pausado).toBe(true)
    expect(urls.soltas).toEqual(['blob:falso-1'])
    expect(sessao.metadata).toBeNull()
    expect(sessao.playbackState).toBe('none')
    expect(sessao.handlers.play).toBeNull()
    expect(sessao.handlers.pause).toBeNull()
    // Desligar de novo não faz nada de mais.
    expect(() => sp.desligar()).not.toThrow()
    expect(urls.soltas).toHaveLength(1)
  })

  it('depois de desligar, dá para ligar de novo', () => {
    const sp = criarSegundoPlano()
    sp.ligar(controles(), info())
    sp.desligar()
    sp.ligar(controles(), info())
    expect(AudioFalso.todos).toHaveLength(2)
    expect(AudioFalso.todos[1].plays).toBe(1)
  })

  it('o navegador recusou tocar (sem permissão): não dá erro e o timer segue', async () => {
    class Recusa extends AudioFalso { falhar = true }
    vi.stubGlobal('Audio', Recusa)
    const sp = criarSegundoPlano()
    expect(() => sp.ligar(controles(), info())).not.toThrow()
    await Promise.resolve()
    expect(() => sp.atualizar(info())).not.toThrow()
  })

  it('navegador sem controle de mídia ou sem Audio: não dá erro', () => {
    vi.stubGlobal('navigator', {})
    expect(() => { const sp = criarSegundoPlano(); sp.ligar(controles(), info()); sp.atualizar(info()); sp.desligar() }).not.toThrow()
    vi.unstubAllGlobals()
    vi.stubGlobal('navigator', { mediaSession: sessao })
    vi.stubGlobal('Audio', undefined)
    expect(() => { const sp = criarSegundoPlano(); sp.ligar(controles(), info()); sp.desligar() }).not.toThrow()
  })
})

describe('criarSegundoPlano: fim do treino e botão play', () => {
  class AudioFalso {
    static todos: AudioFalso[] = []
    loop = false
    pausado = true
    src: string
    plays = 0
    constructor(src: string) { this.src = src; AudioFalso.todos.push(this) }
    play() { this.plays++; this.pausado = false; return Promise.resolve() }
    pause() { this.pausado = true }
    removeAttribute() { this.src = '' }
    load() {}
  }
  class MetadataFalso { constructor(public dados: { title: string; artist: string }) {} }
  type Acao = 'play' | 'pause'
  let sessao: { metadata: MetadataFalso | null; playbackState: string; handlers: Partial<Record<Acao, (() => void) | null>>; setActionHandler(a: Acao, f: (() => void) | null): void }

  beforeEach(() => {
    vi.useFakeTimers()
    AudioFalso.todos = []
    sessao = { metadata: null, playbackState: 'none', handlers: {}, setActionHandler(a, f) { this.handlers[a] = f } }
    vi.stubGlobal('Audio', AudioFalso)
    vi.stubGlobal('MediaMetadata', MetadataFalso)
    vi.stubGlobal('navigator', { mediaSession: sessao })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:falso')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

  const controles = () => ({ pausar: vi.fn(), retomar: vi.fn() })
  const info = { titulo: 'Corner · Timer', detalhe: 'Fim do treino', tocando: false }

  it('desligar com atraso: o áudio e o controle seguem até o fim do atraso (o sino final termina de tocar com a tela bloqueada)', () => {
    const sp = criarSegundoPlano()
    sp.ligar(controles(), info)
    sp.desligar(7000)
    vi.advanceTimersByTime(6999)
    expect(AudioFalso.todos[0].pausado).toBe(false)
    expect(sessao.metadata).not.toBeNull()
    vi.advanceTimersByTime(1)
    expect(AudioFalso.todos[0].pausado).toBe(true)
    expect(sessao.metadata).toBeNull()
  })

  it('desligar de novo durante o atraso não reinicia a contagem', () => {
    const sp = criarSegundoPlano()
    sp.ligar(controles(), info)
    sp.desligar(7000)
    vi.advanceTimersByTime(5000)
    sp.desligar(7000)
    vi.advanceTimersByTime(2000)
    expect(AudioFalso.todos[0].pausado).toBe(true)
  })

  it('ligar durante o atraso cancela o desligamento e reaproveita o mesmo áudio', () => {
    const sp = criarSegundoPlano()
    sp.ligar(controles(), info)
    sp.desligar(7000)
    sp.ligar(controles(), { ...info, detalhe: 'Round 1 de 2', tocando: true })
    vi.advanceTimersByTime(10_000)
    expect(AudioFalso.todos).toHaveLength(1)
    expect(AudioFalso.todos[0].pausado).toBe(false)
    expect(sessao.metadata?.dados.artist).toBe('Round 1 de 2')
  })

  it('desligar sem atraso (sair da tela) corta na hora e cancela o atraso pendente', () => {
    const sp = criarSegundoPlano()
    sp.ligar(controles(), info)
    sp.desligar(7000)
    sp.desligar()
    expect(AudioFalso.todos[0].pausado).toBe(true)
    expect(() => vi.advanceTimersByTime(10_000)).not.toThrow()
  })

  it('o botão play da tela de bloqueio também religa o áudio, se o sistema o tinha pausado', () => {
    const c = controles()
    criarSegundoPlano().ligar(c, { ...info, tocando: true })
    AudioFalso.todos[0].pausado = true // o sistema pausou (ligação, outro app)
    sessao.handlers.play?.()
    expect(c.retomar).toHaveBeenCalledTimes(1)
    expect(AudioFalso.todos[0].plays).toBe(2)
  })
})
