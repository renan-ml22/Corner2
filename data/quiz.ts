// Perguntas do quiz de estilo. Cada resposta soma pontos em categorias de estilo; lib/quiz.ts cruza essas categorias
// com os pontos fortes de cada atleta (data/atletas.ts).
import type { TagDeEstilo } from './atletas'

export interface OpcaoDoQuiz {
  id: string
  texto: string
  /** Ícone do Phosphor (classe `ph-…`). */
  icone: string
  pontos: Partial<Record<TagDeEstilo, number>>
}

export interface PerguntaDoQuiz {
  id: string
  /** Rótulo curto, mostrado acima da pergunta. */
  assunto: string
  pergunta: string
  opcoes: OpcaoDoQuiz[]
}

export const PERGUNTAS: PerguntaDoQuiz[] = [
  {
    id: 'distancia',
    assunto: 'Distância preferida',
    pergunta: 'Em uma luta, onde você se sente mais confortável?',
    opcoes: [
      { id: 'longe', texto: 'Longe, controlando com o jab e me movimentando', icone: 'ph-arrows-out-line-horizontal', pontos: { footwork: 2 } },
      { id: 'perto', texto: 'Perto, trocando golpes e usando o corpo', icone: 'ph-arrows-in-line-horizontal', pontos: { pressao: 2 } },
      { id: 'meio', texto: 'No meio-campo, esperando o momento certo', icone: 'ph-target', pontos: { counter: 2 } },
    ],
  },
  {
    id: 'arma',
    assunto: 'Arma principal',
    pergunta: 'Qual é o seu maior trunfo?',
    opcoes: [
      { id: 'velocidade', texto: 'Velocidade e reflexos', icone: 'ph-lightning', pontos: { velocidade: 2 } },
      { id: 'potencia', texto: 'Potência e força', icone: 'ph-hand-fist', pontos: { potencia: 2 } },
      { id: 'tecnica', texto: 'Técnica e inteligência', icone: 'ph-brain', pontos: { tecnica: 2 } },
      { id: 'resistencia', texto: 'Resistência e volume', icone: 'ph-heartbeat', pontos: { resistencia: 2 } },
    ],
  },
  {
    id: 'pressao',
    assunto: 'Sob pressão',
    pergunta: 'Quando o adversário te pressiona, você:',
    opcoes: [
      { id: 'recuo', texto: 'Recuo, crio distância e reorganizo', icone: 'ph-arrow-u-up-left', pontos: { footwork: 2, defesa: 1 } },
      { id: 'clinch', texto: 'Clincho e trato para ganhar tempo', icone: 'ph-handshake', pontos: { 'inside-fighting': 2 } },
      { id: 'contra-ataque', texto: 'Contra-ataco imediatamente', icone: 'ph-crosshair', pontos: { counter: 2 } },
      { id: 'avanco', texto: 'Avanço ainda mais e pressiono de volta', icone: 'ph-arrow-fat-lines-right', pontos: { pressao: 2 } },
    ],
  },
  {
    id: 'alvo',
    assunto: 'Alvo preferido',
    pergunta: 'Onde você prefere atacar?',
    opcoes: [
      { id: 'cabeca', texto: 'Cabeça — busco o nocaute', icone: 'ph-user-focus', pontos: { potencia: 1 } },
      { id: 'corpo', texto: 'Corpo — queimo o adversário', icone: 'ph-flame', pontos: { corpo: 2 } },
      { id: 'estrategia', texto: 'Combino os dois com estratégia', icone: 'ph-path', pontos: { tecnica: 2 } },
    ],
  },
  {
    id: 'luta-ideal',
    assunto: 'Luta ideal',
    pergunta: 'Como seria sua luta perfeita?',
    opcoes: [
      { id: 'controle', texto: 'Controle total de distância e ritmo', icone: 'ph-timer', pontos: { footwork: 2, tecnica: 1 } },
      { id: 'explosao', texto: 'Explosão no começo, pressão constante', icone: 'ph-fire', pontos: { pressao: 2, potencia: 1 } },
      { id: 'paciencia', texto: 'Paciência, esperar o erro e punir', icone: 'ph-hourglass', pontos: { counter: 2, defesa: 1 } },
      { id: 'volume', texto: 'Guerra de volume, quem aguentar mais', icone: 'ph-infinity', pontos: { resistencia: 2 } },
    ],
  },
]
