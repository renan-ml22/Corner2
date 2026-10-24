// Treinos "no estilo de" cada atleta do quiz (data/atletas.ts): 4 semanas, exclusivos do plano Profissional.
//
// São planos do Corner INSPIRADOS no estilo de luta de cada atleta (distância, defesa, golpes e ritmo que o marcaram).
// Não são a rotina real de ninguém, e o Corner não tem vínculo com os atletas.
//
// Só `import type` de planos.ts: planos.ts importa este arquivo (para o getPlano achar estes planos), e um import de
// valor nos dois sentidos criaria um ciclo.
import type { RegType } from '@/lib/tipos'
import type { Nivel, Plano, SessaoPlano } from './planos'

const ROTULO_DO_NIVEL: Record<Nivel, string> = { iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado' }
const DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab']

/** Uma sessão que se repete nas 4 semanas, com mais rounds nas duas últimas. `{r}` vira o número de rounds. */
interface Tema {
  dia: number
  tipo: RegType
  titulo: string
  /** Rounds nas semanas 1 e 2 (nas semanas 3 e 4 sobe 1, menos no sparring, que não sobe). */
  rounds: number
  descricao: string
  /** Itens específicos do checklist (de 1 a 3). O aquecimento e o alongamento entram sozinhos. */
  itens: string[]
}

interface Receita {
  atleta: string
  nome: string
  nivel: Nivel
  resumo: string
  temas: Tema[]
}

const AQUECIMENTO = 'Aquecimento: 5 min de corda e mobilidade'
const ALONGAMENTO = 'Alongamento final'
const AQUECIMENTO_COMPLETO = 'Aquecimento completo'

function sessoes(r: Receita): SessaoPlano[] {
  const fase = (semanas: [number, number], acrescimo: number): SessaoPlano[] =>
    r.temas.map(t => {
      // O sparring nunca aumenta: fica sempre leve e curto.
      const rounds = t.rounds + (t.tipo === 'spa' ? 0 : acrescimo)
      const itens = t.itens.map(i => i.replaceAll('{r}', String(rounds)))
      return {
        id: `atl-${r.atleta}-s${semanas[0]}-${DIA[t.dia]}`,
        diaSemana: t.dia,
        tipo: t.tipo,
        titulo: t.titulo,
        rounds,
        minPorRound: 3,
        descansoSeg: 60,
        descricao: t.descricao,
        checklist: [t.tipo === 'spa' ? AQUECIMENTO_COMPLETO : AQUECIMENTO, ...itens, ALONGAMENTO],
        semanas,
      }
    })
  return [...fase([1, 2], 0), ...fase([3, 4], 1)]
}

function plano(r: Receita): Plano {
  return {
    id: `atleta-${r.atleta}`,
    nome: r.nome,
    nivel: r.nivel,
    nivelLabel: ROTULO_DO_NIVEL[r.nivel],
    semanas: 4,
    diasPorSemana: r.temas.length,
    resumo: r.resumo,
    sessoes: sessoes(r),
  }
}

const RECEITAS: Receita[] = [
  {
    atleta: 'ali', nome: 'Estilo Muhammad Ali', nivel: 'intermediario',
    resumo: 'Distância, jab longo e movimento constante: o estilo do out-boxer, que luta de longe e não deixa o adversário acertar.',
    temas: [
      { dia: 1, tipo: 'tec', titulo: 'Jab longo e distância', rounds: 5,
        descricao: 'Shadowboxing em que o jab manda: golpe longo e rápido, voltando para a guarda e saindo da linha de fogo.',
        itens: ['{r} rounds de shadowboxing com jab e passo lateral', 'In-and-out: entrar com o jab e sair em dois passos'] },
      { dia: 2, tipo: 'con', titulo: 'Movimento constante', rounds: 6,
        descricao: 'Rounds de corda e de saco circulando, sem parar de se mexer. A ideia é manter o ritmo leve do primeiro ao último segundo.',
        itens: ['{r} rounds alternando corda e saco circulando', 'Core: prancha 3 × 40 s'] },
      { dia: 4, tipo: 'tec', titulo: 'Esquivas e saídas', rounds: 5,
        descricao: 'Esquiva com o tronco e com a cabeça, sempre seguida de um 1-2 e de um passo para sair de frente.',
        itens: ['{r} rounds de pull back e slip externo seguidos de 1-2', 'Pivot após cada combinação'] },
      { dia: 6, tipo: 'spa', titulo: 'Sparring técnico leve de distância', rounds: 4,
        descricao: 'Sparring leve, só para usar o jab e o movimento de pernas da semana. Intensidade a 50%, sem trocar golpes fortes: o foco é a distância.',
        itens: ['Bandagem, protetor bucal, luvas, capacete e um treinador por perto', '{r} rounds de sparring técnico leve', 'Conversa com o parceiro: a distância ficou sua?'] },
    ],
  },
  {
    atleta: 'tyson', nome: 'Estilo Mike Tyson', nivel: 'avancado',
    resumo: 'Pressão, movimento de cabeça e golpes curtos e explosivos: o estilo do swarmer, que entra balançando e finaliza por dentro.',
    temas: [
      { dia: 1, tipo: 'tec', titulo: 'Movimento de cabeça e entrada', rounds: 5,
        descricao: 'Bob and weave e duck no shadowboxing e no saco, entrando por baixo do jab imaginário e saindo com um golpe.',
        itens: ['{r} rounds de bob and weave e duck com jab na entrada', 'Guarda alta e queixo para baixo em todos os rounds'] },
      { dia: 2, tipo: 'con', titulo: 'Saco pesado: explosão', rounds: 6,
        descricao: 'Rounds de saco com rajadas curtas e explosivas, e pausa ativa entre elas. Qualidade antes de quantidade.',
        itens: ['{r} rounds de saco: 20 s de rajada e 40 s de ritmo leve', 'Core: 3 séries de abdominal'] },
      { dia: 3, tipo: 'tec', titulo: 'Gancho, uppercut e corpo', rounds: 5,
        descricao: 'Golpes curtos na meia distância: gancho, uppercut e body shot em combinação, com giro de quadril e retorno à guarda.',
        itens: ['{r} rounds de gancho, uppercut e body shot no saco', 'Combinação: 1-2-3 e saída com a cabeça'] },
      { dia: 4, tipo: 'con', titulo: 'Condicionamento de pressão', rounds: 6,
        descricao: 'Circuito de corda, saco e exercícios de peso do corpo, para aguentar avançar durante todos os rounds.',
        itens: ['{r} estações de 3 min alternando corda, saco, burpee e shadow', 'Desaceleração: 5 min de caminhada'] },
      { dia: 6, tipo: 'spa', titulo: 'Sparring técnico: pressão controlada', rounds: 4,
        descricao: 'Sparring técnico leve para treinar a entrada com movimento de cabeça. Intensidade a 50%, sem tentar nocautear o parceiro.',
        itens: ['Bandagem, protetor bucal, luvas, capacete e um treinador por perto', '{r} rounds de sparring técnico leve', 'Anotar: em que momento a entrada funcionou'] },
    ],
  },
  {
    atleta: 'mayweather', nome: 'Estilo Floyd Mayweather Jr.', nivel: 'avancado',
    resumo: 'Defesa ativa, controle de distância e contra-golpes precisos: o estilo do counter-puncher, que acerta mais e leva menos.',
    temas: [
      { dia: 1, tipo: 'tec', titulo: 'Shoulder roll e contra-golpe', rounds: 5,
        descricao: 'Shoulder roll com o ombro da frente protegendo o queixo, respondendo cada golpe imaginário com um direto de volta.',
        itens: ['{r} rounds de shoulder roll seguido de direto', 'Pull back e contra em 1-2'] },
      { dia: 2, tipo: 'tec', titulo: 'Controle de distância', rounds: 5,
        descricao: 'Jab e passo lateral para decidir a distância da luta. Pivot para sair do alcance e voltar para o ângulo.',
        itens: ['{r} rounds de jab, passo lateral e pivot', 'Parar a combinação sempre fora do alcance'] },
      { dia: 4, tipo: 'con', titulo: 'Saco: eficiência', rounds: 6,
        descricao: 'Rounds de saco com poucos golpes e boa execução, medindo o timing em vez do volume.',
        itens: ['{r} rounds de saco com no máximo 3 golpes por série', 'Core: prancha 3 × 40 s'] },
      { dia: 6, tipo: 'spa', titulo: 'Sparring técnico leve de contra-ataque', rounds: 4,
        descricao: 'Sparring leve esperando o golpe do parceiro para responder. Intensidade a 50%: o objetivo é o timing, não o dano.',
        itens: ['Bandagem, protetor bucal, luvas, capacete e um treinador por perto', '{r} rounds de sparring técnico leve', 'Conversa: quais contra-golpes saíram no tempo certo'] },
    ],
  },
  {
    atleta: 'pacquiao', nome: 'Estilo Manny Pacquiao', nivel: 'avancado',
    resumo: 'Combinações rápidas, ângulos e pressão pelos lados: o estilo agressivo de canhoto, que nunca deixa o adversário descansar.',
    temas: [
      { dia: 1, tipo: 'tec', titulo: 'Combinações rápidas', rounds: 5,
        descricao: 'Combinações longas em velocidade, com o direto saindo logo depois do jab. Mãos sempre voltando para a guarda.',
        itens: ['{r} rounds de 1-2-3 e 1-2-3-2 em manopla ou saco', 'Jab duplo e direto: 1-1-2 em ritmo'] },
      { dia: 2, tipo: 'con', titulo: 'Corda e velocidade de mãos', rounds: 6,
        descricao: 'Corda em ritmo forte e shadowboxing com mãos rápidas, alternando intervalos de 30 s de velocidade máxima.',
        itens: ['{r} rounds de corda e shadow: 30 s rápido, 30 s leve', 'Core: 3 séries de abdominal'] },
      { dia: 3, tipo: 'tec', titulo: 'Ângulos e pivot', rounds: 5,
        descricao: 'Sair da linha com o pivot e o passo em L, e atacar de lado. Os ângulos valem para canhotos e destros.',
        itens: ['{r} rounds de pivot e passo em L, com combinação ao fim', 'Trabalhar para os dois lados'] },
      { dia: 4, tipo: 'con', titulo: 'Saco de volume', rounds: 6,
        descricao: 'Rounds de saco com muito volume e ritmo constante, para manter a pressão sem perder a forma dos golpes.',
        itens: ['{r} rounds de saco em volume alto e ritmo constante', 'Prancha 3 × 40 s'] },
      { dia: 6, tipo: 'spa', titulo: 'Sparring técnico leve de pressão', rounds: 4,
        descricao: 'Sparring leve usando ângulos e combinações curtas. Intensidade a 50%, trocando de lado com frequência.',
        itens: ['Bandagem, protetor bucal, luvas, capacete e um treinador por perto', '{r} rounds de sparring técnico leve', 'Anotar quais ângulos abriram espaço'] },
    ],
  },
  {
    atleta: 'stevenson', nome: 'Estilo Teófilo Stevenson', nivel: 'intermediario',
    resumo: 'Direto de direita forte, guarda alta e controle com o jab: o estilo do power puncher, que decide em poucos golpes.',
    temas: [
      { dia: 1, tipo: 'tec', titulo: 'Direto de direita e guarda alta', rounds: 5,
        descricao: 'O direto sai do chão: pé, quadril e ombro girando juntos. A mão da frente fica alta e pronta para o jab.',
        itens: ['{r} rounds de jab e direto, com giro completo do quadril', 'Guarda alta entre os golpes'] },
      { dia: 3, tipo: 'con', titulo: 'Saco: potência com técnica', rounds: 6,
        descricao: 'Rounds de saco com golpes pesados em séries curtas, sem perder a base. Descanse a mão entre as séries.',
        itens: ['{r} rounds de saco: 3 séries de 1-2 forte por minuto', 'Core: 3 séries de abdominal'] },
      { dia: 5, tipo: 'tec', titulo: 'Jab e distância', rounds: 5,
        descricao: 'Use o jab para medir a distância e preparar o direto, com passos curtos e sem cruzar os pés.',
        itens: ['{r} rounds de jab, passo lateral e 1-2', 'Pull back e direto de volta'] },
    ],
  },
  {
    atleta: 'robinson', nome: 'Estilo Sugar Ray Robinson', nivel: 'avancado',
    resumo: 'Combinações fluidas, adaptação a cada adversário e velocidade com técnica: o estilo completo do all-around.',
    temas: [
      { dia: 1, tipo: 'tec', titulo: 'Combinações fluidas', rounds: 5,
        descricao: 'Combinações em sequência, mudando de altura e de ritmo sem quebrar a guarda. A fluidez vale mais que a força.',
        itens: ['{r} rounds de 1-2-3 e 1-2-3-2, trocando cabeça e corpo', 'Body shot na saída da combinação'] },
      { dia: 2, tipo: 'con', titulo: 'Condicionamento completo', rounds: 6,
        descricao: 'Mistura de corda, saco e shadowboxing em ritmos diferentes, para treinar o corpo a mudar de marcha.',
        itens: ['{r} rounds alternando corda, saco e shadow', 'Core: prancha 3 × 40 s'] },
      { dia: 4, tipo: 'tec', titulo: 'Adaptação: esquiva e contra', rounds: 5,
        descricao: 'Trabalhe o mesmo golpe de três jeitos: esquivando com o slip, com o pull back e com o duck, e sempre contra-atacando.',
        itens: ['{r} rounds de slip, pull back e duck, cada um com contra', 'Mudar o plano a cada round'] },
      { dia: 6, tipo: 'spa', titulo: 'Sparring técnico leve de adaptação', rounds: 4,
        descricao: 'Sparring leve, mudando a estratégia a cada round: distância, pressão ou contra-ataque. Intensidade a 50%.',
        itens: ['Bandagem, protetor bucal, luvas, capacete e um treinador por perto', '{r} rounds de sparring técnico leve', 'Anotar qual plano funcionou melhor'] },
    ],
  },
  {
    atleta: 'frazier', nome: 'Estilo Joe Frazier', nivel: 'avancado',
    resumo: 'Movimento de cabeça constante, gancho de esquerda e muito volume: o estilo do swarmer resistente, que vence pelo desgaste.',
    temas: [
      { dia: 1, tipo: 'tec', titulo: 'Bob and weave e gancho de esquerda', rounds: 5,
        descricao: 'Balançar a cabeça em U por baixo do golpe imaginário e sair com o gancho. O movimento vem das pernas, não só do pescoço.',
        itens: ['{r} rounds de bob and weave seguido de gancho', 'Jab na entrada, sempre com a guarda alta'] },
      { dia: 2, tipo: 'con', titulo: 'Volume no saco', rounds: 6,
        descricao: 'Rounds de saco com muitos golpes e pouca pausa, aprendendo a manter a técnica quando o cansaço chega.',
        itens: ['{r} rounds de saco em volume alto', 'Core: 3 séries de abdominal'] },
      { dia: 4, tipo: 'tec', titulo: 'Pressão e golpes ao corpo', rounds: 5,
        descricao: 'Avançar sem se expor: jab, passo curto e body shot ou gancho. Procure encurtar a distância e sair em seguida.',
        itens: ['{r} rounds de avanço com jab, body shot e gancho', 'Slip interno e saída lateral'] },
      { dia: 6, tipo: 'con', titulo: 'Resistência: circuito de boxe', rounds: 6,
        descricao: 'Circuito de estações de 3 minutos, para ganhar fôlego e aguentar o ritmo até o último round.',
        itens: ['{r} estações de 3 min alternando saco, corda, burpee e shadow', 'Desaceleração: 5 min de caminhada'] },
    ],
  },
  {
    atleta: 'foreman', nome: 'Estilo George Foreman', nivel: 'intermediario',
    resumo: 'Pressão de cima, jab pesado e golpes ao corpo: o estilo do slugger, que anda para frente e desgasta com cada golpe.',
    temas: [
      { dia: 1, tipo: 'tec', titulo: 'Jab pesado e avanço', rounds: 5,
        descricao: 'Jab firme para empurrar o adversário, e passos curtos para frente, sem cruzar os pés e sem abrir a guarda.',
        itens: ['{r} rounds de jab pesado e passo à frente', 'Direto depois do jab, e guarda de volta'] },
      { dia: 2, tipo: 'con', titulo: 'Saco pesado: força', rounds: 6,
        descricao: 'Rounds de saco com golpes pesados e boa base. Respire a cada golpe e relaxe o ombro entre as séries.',
        itens: ['{r} rounds de saco pesado, golpes firmes e base estável', 'Core: prancha 3 × 40 s'] },
      { dia: 4, tipo: 'tec', titulo: 'Golpes ao corpo', rounds: 5,
        descricao: 'Body shot em sequência com o gancho e o uppercut, flexionando os joelhos para chegar ao corpo sem se curvar.',
        itens: ['{r} rounds de body shot, gancho e uppercut', 'Combinação 1-2 e body shot'] },
      { dia: 6, tipo: 'con', titulo: 'Resistência com saco', rounds: 6,
        descricao: 'Rounds longos de saco em ritmo constante e circuito de core, para manter a pressão até o fim.',
        itens: ['{r} rounds de saco em ritmo constante', 'Core: 3 séries de abdominal e prancha'] },
    ],
  },
  {
    atleta: 'canelo', nome: 'Estilo Canelo Álvarez', nivel: 'avancado',
    resumo: 'Esquiva de tronco, timing e golpes ao corpo: o estilo do counter-puncher moderno, que espera, desvia e responde forte.',
    temas: [
      { dia: 1, tipo: 'tec', titulo: 'Esquiva de tronco e contra', rounds: 5,
        descricao: 'Lean back e pull back para tirar o rosto do golpe, e volta imediata com direto ou gancho no tempo certo.',
        itens: ['{r} rounds de lean back e pull back com contra', 'Gancho de volta depois da esquiva'] },
      { dia: 2, tipo: 'tec', titulo: 'Golpes ao corpo', rounds: 5,
        descricao: 'Body shot e gancho ao corpo em combinação, abaixando o tronco com os joelhos e voltando para a guarda.',
        itens: ['{r} rounds de body shot e gancho em combinação', 'Combinação 1-2-3 com golpe ao corpo'] },
      { dia: 4, tipo: 'con', titulo: 'Saco: timing e ritmo', rounds: 6,
        descricao: 'Rounds de saco com ritmo cadenciado e pausas de espera, para treinar a hora certa de entrar.',
        itens: ['{r} rounds de saco com ritmo cadenciado', 'Core: prancha 3 × 40 s'] },
      { dia: 6, tipo: 'spa', titulo: 'Sparring técnico leve de contra-ataque', rounds: 4,
        descricao: 'Sparring leve esperando o golpe do parceiro, desviando com o tronco e respondendo. Intensidade a 50%.',
        itens: ['Bandagem, protetor bucal, luvas, capacete e um treinador por perto', '{r} rounds de sparring técnico leve', 'Anotar quais respostas saíram no tempo'] },
    ],
  },
  {
    atleta: 'conceicao', nome: 'Estilo Robson Conceição', nivel: 'intermediario',
    resumo: 'Velocidade de mãos, reflexos e combinações imprevisíveis: o estilo do boxeador veloz, que ataca por ângulos diferentes.',
    temas: [
      { dia: 1, tipo: 'tec', titulo: 'Jab e direto em velocidade', rounds: 5,
        descricao: 'Jab e direto o mais rápido que a técnica deixar, com a mão voltando para a guarda a cada golpe.',
        itens: ['{r} rounds de 1-2 e 1-1-2 em velocidade', 'Passo lateral entre as combinações'] },
      { dia: 2, tipo: 'con', titulo: 'Corda e reflexos', rounds: 6,
        descricao: 'Corda em ritmo alto e exercícios de reação, alternando 30 s de velocidade máxima e 30 s leves.',
        itens: ['{r} rounds de corda: 30 s rápido, 30 s leve', 'Core: 3 séries de abdominal'] },
      { dia: 4, tipo: 'tec', titulo: 'Ângulos e combinações criativas', rounds: 5,
        descricao: 'Pivot e passo em L para atacar de lado, e trocar a ordem dos golpes para surpreender. Vale para canhotos e destros.',
        itens: ['{r} rounds de pivot, passo em L e 1-2-3', 'Variar a ordem da combinação a cada round'] },
      { dia: 6, tipo: 'con', titulo: 'Saco de velocidade', rounds: 6,
        descricao: 'Rounds de saco em velocidade, com séries curtas e pausa ativa para manter os golpes limpos.',
        itens: ['{r} rounds de saco de velocidade, séries de 20 s', 'Prancha 3 × 40 s'] },
    ],
  },
]

export const PLANOS_DE_ATLETAS: Plano[] = RECEITAS.map(plano)

/** O id do plano de treino de um atleta (`ali` -> `atleta-ali`). */
export const idDoPlanoDoAtleta = (atletaId: string): string => `atleta-${atletaId}`

export const planoDoAtleta = (atletaId: string | null | undefined): Plano | null =>
  atletaId ? (PLANOS_DE_ATLETAS.find(p => p.id === idDoPlanoDoAtleta(atletaId)) ?? null) : null
