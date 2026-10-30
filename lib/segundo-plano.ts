// "Manter o som com a tela bloqueada" (opção do Timer). Com a aba em segundo plano ou a tela bloqueada, o celular congela
// ou suspende o áudio de uma página comum. Um áudio de mídia em repetição faz o celular tratá-la como um app tocando
// áudio: a página segue viva, o áudio programado (lib/agendador-de-sons.ts) toca no horário e a tela de bloqueio ganha
// o controle de mídia, com pausar e retomar do timer. O áudio é inaudível (gerado aqui, sem arquivo).
// Custo: o celular pode pausar a música de outros apps enquanto o timer anda; por isso a opção vem desligada.

const TAXA_HZ = 8000
/** Mais de 5 s: o Chrome do Android só mostra o controle de mídia para áudio mais longo que isso. */
const DURACAO_S = 10

/** Um WAV mono de 16 bits com 10 s de quase silêncio (amostras de ±1, a −90 dB: inaudível, mas não zero absoluto). */
export function wavSilencioso(): Uint8Array {
  const amostras = TAXA_HZ * DURACAO_S
  const dados = amostras * 2
  const b = new Uint8Array(44 + dados)
  const v = new DataView(b.buffer)
  const texto = (de: number, s: string) => { for (let i = 0; i < s.length; i++) b[de + i] = s.charCodeAt(i) }
  texto(0, 'RIFF')
  v.setUint32(4, 36 + dados, true)
  texto(8, 'WAVE')
  texto(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true) // PCM
  v.setUint16(22, 1, true) // mono
  v.setUint32(24, TAXA_HZ, true)
  v.setUint32(28, TAXA_HZ * 2, true) // bytes por segundo
  v.setUint16(32, 2, true) // bytes por amostra
  v.setUint16(34, 16, true)
  texto(36, 'data')
  v.setUint32(40, dados, true)
  for (let i = 0; i < amostras; i++) v.setInt16(44 + i * 2, i % 2 === 0 ? 1 : -1, true)
  return b
}

/** O que o controle de mídia da tela de bloqueio mostra. */
export interface InfoDaMidia {
  titulo: string
  detalhe: string
  /** true = tocando; false = pausado */
  tocando: boolean
}

/** O que os botões da tela de bloqueio fazem. */
export interface ControlesDaMidia {
  pausar: () => void
  retomar: () => void
}

export interface SegundoPlano {
  /** Começa a manter o áudio vivo. Precisa ser chamado dentro de um toque do usuário (o iPhone exige). */
  ligar(controles: ControlesDaMidia, info: InfoDaMidia): void
  atualizar(info: InfoDaMidia): void
  /**
   * Para de manter o áudio vivo. Com `depoisDeMs`, espera esse tempo: no fim do treino o sino final ainda está tocando e,
   * com a tela bloqueada, o celular pode suspender o áudio assim que a mídia some. Ligar de novo cancela a espera.
   */
  desligar(depoisDeMs?: number): void
}

export function criarSegundoPlano(): SegundoPlano {
  let audio: HTMLAudioElement | null = null
  let url: string | null = null
  let controles: ControlesDaMidia | null = null
  let espera: ReturnType<typeof setTimeout> | null = null

  const cancelarEspera = () => {
    if (espera !== null) clearTimeout(espera)
    espera = null
  }

  const sessao = (): MediaSession | null => (typeof navigator !== 'undefined' && navigator.mediaSession ? navigator.mediaSession : null)

  const acao = (nome: MediaSessionAction, f: MediaSessionActionHandler | null) => {
    try { sessao()?.setActionHandler(nome, f) } catch { /* ação sem suporte neste navegador */ }
  }

  const mostrar = (info: InfoDaMidia) => {
    const s = sessao()
    if (!s) return
    try {
      if (typeof MediaMetadata !== 'undefined') s.metadata = new MediaMetadata({ title: info.titulo, artist: info.detalhe })
      s.playbackState = info.tocando ? 'playing' : 'paused'
    } catch { /* o controle de mídia é um extra: o som não depende dele */ }
  }

  return {
    ligar(novos, info) {
      cancelarEspera()
      controles = novos
      if (audio) {
        mostrar(info)
        return
      }
      if (typeof Audio === 'undefined') return
      try {
        url = URL.createObjectURL(new Blob([wavSilencioso() as BlobPart], { type: 'audio/wav' }))
        audio = new Audio(url)
        audio.loop = true
        void audio.play().catch(() => undefined) // sem permissão: o timer segue, só sem o truque
      } catch {
        audio = null
        return
      }
      acao('pause', () => controles?.pausar())
      acao('play', () => {
        controles?.retomar()
        // O sistema pode ter pausado o áudio (ligação, outro app): tocar de novo mantém a página viva.
        void audio?.play().catch(() => undefined)
      })
      mostrar(info)
    },
    atualizar(info) {
      if (audio) mostrar(info)
    },
    desligar(depoisDeMs = 0) {
      if (!audio) return
      if (depoisDeMs > 0) {
        // Já há um desligamento marcado: não reinicia a contagem.
        espera ??= setTimeout(() => { espera = null; this.desligar() }, depoisDeMs)
        return
      }
      cancelarEspera()
      try {
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
        if (url) URL.revokeObjectURL(url)
      } catch { /* já solto */ }
      audio = null
      url = null
      controles = null
      acao('pause', null)
      acao('play', null)
      const s = sessao()
      if (s) {
        try { s.metadata = null; s.playbackState = 'none' } catch { /* idem */ }
      }
    },
  }
}
