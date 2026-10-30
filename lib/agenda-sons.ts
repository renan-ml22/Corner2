// O que o cronômetro toca no treino inteiro e em que segundo (desde o início) cada som entra. Funções puras.
// Com a lista pronta, os sons são programados de uma vez no relógio do áudio (lib/agendador-de-sons.ts): o áudio toca no
// horário mesmo com a página em segundo plano, quando o navegador congela o JavaScript.

export interface FaseCrono {
  tipo: 'preparo' | 'round' | 'descanso'
  /** Round a que a fase pertence (no preparo, o primeiro; no descanso, o que acabou de terminar) */
  round: number
  duracao: number
  /** Segundo, desde o início, em que a fase começa */
  inicio: number
}

/** Os avisos sonoros do cronômetro. Cada tela escolhe os seus (o treino do plano usa o sino; o Timer usa bipes). */
export interface SonsDoCronometro {
  inicioRound: (ctx: AudioContext | null) => void
  inicioDescanso: (ctx: AudioContext | null) => void
  /** Faltam 10 segundos para o fim do round */
  aviso: (ctx: AudioContext | null) => void
  /** Contagem dos últimos 3 segundos: `restante` é 3, 2 ou 1 */
  contagem: (ctx: AudioContext | null, restante: number) => void
  fim: (ctx: AudioContext | null) => void
}

export type NomeDoSom = 'inicioRound' | 'inicioDescanso' | 'aviso' | 'contagem' | 'fim'

export interface EventoDeSom {
  /** Identifica o som no treino: o mesmo som nunca toca duas vezes. */
  chave: string
  nome: NomeDoSom
  /** Só na contagem: 3, 2 ou 1 */
  restante?: 1 | 2 | 3
  /** Segundo, desde o início do treino (na mesma escala do andamento do cronômetro), em que o som entra */
  em: number
}

/** O round só ganha o aviso dos 10 s se for mais longo que isso. */
export const ROUND_MINIMO_PARA_AVISO_SEG = 25
const AVISO_FALTANDO_SEG = 10

/**
 * O número (3, 2 ou 1) da contagem regressiva a tocar agora, ou null. O preparo e o descanso sempre contam; o round só
 * se `contagemNoRound`. Numa fase curta, a contagem não começa no primeiro segundo (o sino de início ainda está soando).
 */
export function numeroDaContagem(fase: Pick<FaseCrono, 'tipo' | 'duracao'>, restante: number, contagemNoRound: boolean): 1 | 2 | 3 | null {
  if (fase.tipo === 'round' && !contagemNoRound) return null
  if (restante < 1 || restante > 3 || restante >= fase.duracao) return null
  return restante as 1 | 2 | 3
}

/** Todos os sons do treino, em ordem de horário. O último é o fim do treino. */
export function agendaDeSons(fases: FaseCrono[], contagemNoRound: boolean): EventoDeSom[] {
  const eventos: EventoDeSom[] = []
  fases.forEach((fase, i) => {
    const fimDaFase = fase.inicio + fase.duracao
    if (fase.tipo === 'round') eventos.push({ chave: `${i}:inicio`, nome: 'inicioRound', em: fase.inicio })
    if (fase.tipo === 'descanso') eventos.push({ chave: `${i}:inicio`, nome: 'inicioDescanso', em: fase.inicio })
    if (fase.tipo === 'round' && fase.duracao > ROUND_MINIMO_PARA_AVISO_SEG) {
      eventos.push({ chave: `${i}:aviso`, nome: 'aviso', em: fimDaFase - AVISO_FALTANDO_SEG })
    }
    for (const restante of [3, 2, 1] as const) {
      if (numeroDaContagem(fase, restante, contagemNoRound)) {
        eventos.push({ chave: `${i}:c${restante}`, nome: 'contagem', restante, em: fimDaFase - restante })
      }
    }
  })
  const ultima = fases[fases.length - 1]
  eventos.push({ chave: 'fim', nome: 'fim', em: ultima.inicio + ultima.duracao })
  // Estável: sons no mesmo segundo ficam na ordem em que foram montados.
  return eventos.map((e, i) => ({ e, i })).sort((a, b) => a.e.em - b.e.em || a.i - b.i).map(({ e }) => e)
}
