// Biblioteca de exercícios de boxe (plano gratuito): movimentação, esquivas, golpes e combinações.
// Os textos falam em "mão da frente" e "mão de trás", que valem tanto para quem luta ortodoxo quanto para canhoto.

import type { Nivel } from './planos'

export type CategoriaDeExercicio = 'footwork' | 'esquivas-cabeca' | 'esquivas-tronco' | 'golpes' | 'combinacoes'

export interface Categoria {
  id: CategoriaDeExercicio
  nome: string
  /** Nome do ícone do Phosphor (usado como `ph-fill ${icone}`). */
  icone: string
}

export interface Exercicio {
  id: string
  categoria: CategoriaDeExercicio
  nome: string
  /** 2 ou 3 frases explicando a técnica. */
  descricao: string
  /** Três pontos de atenção. */
  dicas: string[]
  /** Dois erros frequentes. */
  errosComuns: string[]
  nivel: Nivel
}

export const CATEGORIAS: Categoria[] = [
  { id: 'footwork', nome: 'Footwork', icone: 'ph-footprints' },
  { id: 'esquivas-cabeca', nome: 'Esquivas de cabeça', icone: 'ph-user-focus' },
  { id: 'esquivas-tronco', nome: 'Esquivas de tronco', icone: 'ph-person-simple' },
  { id: 'golpes', nome: 'Golpes', icone: 'ph-boxing-glove' },
  { id: 'combinacoes', nome: 'Combinações', icone: 'ph-list-numbers' },
]

export const EXERCICIOS: Exercicio[] = [
  // ── Footwork (movimentação) ───────────────────────────────
  {
    id: 'passo-lateral', categoria: 'footwork', nome: 'Passo lateral (shuffle step)', nivel: 'iniciante',
    descricao: 'Deslize para o lado empurrando o chão com o pé do lado oposto ao destino e movendo primeiro o pé que está do lado para onde você vai. Os pés andam como uma sanfona, na mesma distância de antes, sem se cruzar e sem abrir a guarda.',
    dicas: [
      'Mova primeiro o pé do lado do destino e só depois traga o outro, mantendo sempre a mesma distância entre os pés.',
      'Joelhos levemente flexionados e peso distribuído entre os dois pés, sem pular e sem se levantar.',
      'Mãos na guarda e queixo baixo durante todo o deslize.',
    ],
    errosComuns: [
      'Cruzar os pés, o que tira o equilíbrio e impede o golpe seguinte.',
      'Dar passos largos demais e ficar com a base aberta e lenta.',
    ],
  },
  {
    id: 'passo-em-l', categoria: 'footwork', nome: 'Passo em L (L-step)', nivel: 'intermediario',
    descricao: 'Combine um passo lateral com um recuo curto, desenhando um L no chão. É a forma de sair da linha reta de ataque e criar um ângulo para contra-atacar.',
    dicas: [
      'Faça o passo para o lado e o recuo em dois tempos curtos, quase sem pausa.',
      'Gire levemente o quadril junto com o passo para ganhar o ângulo.',
      'Termine sempre em postura de guarda, pronto para golpear.',
    ],
    errosComuns: [
      'Recuar em linha reta e continuar na linha de ataque do adversário.',
      'Cruzar os pés na perna do L, perdendo a base.',
    ],
  },
  {
    id: 'pivot', categoria: 'footwork', nome: 'Pivot', nivel: 'intermediario',
    descricao: 'Gire sobre o pé da frente, que funciona como eixo, e leve o pé de trás para um novo ângulo de 45° ou 90°. Você muda de lado em relação ao adversário sem sair do lugar.',
    dicas: [
      'Apoie o peso na bola do pé da frente e gire sobre ela, sem arrastar o pé: o calcanhar sai do chão e o joelho acompanha o pé.',
      'O giro vem dos pés e do quadril, com a guarda fechada e os braços quietos.',
      'Use 45° para um ângulo curto e 90° para sair completamente da linha de ataque.',
    ],
    errosComuns: [
      'Prender o pé no chão e torcer o joelho, em vez de girar sobre a bola do pé.',
      'Girar demais e acabar de costas para o adversário.',
    ],
  },
  {
    id: 'in-and-out', categoria: 'footwork', nome: 'In-and-out', nivel: 'intermediario',
    descricao: 'Entre rápido na distância para atacar e saia logo em seguida da linha de ataque, antes que o adversário responda. O ritmo é entrada, golpe e saída, tudo num movimento só.',
    dicas: [
      'Entre com o jab ou com um passo curto, sempre com a guarda fechada.',
      'Saia no mesmo ritmo da entrada: quem demora na saída leva o contra-ataque.',
      'Prefira sair de lado ou em ângulo, e não em linha reta para trás.',
    ],
    errosComuns: [
      'Ficar parado na distância depois de golpear.',
      'Entrar com o queixo levantado e sem cobertura.',
    ],
  },

  // ── Esquivas de cabeça ────────────────────────────────────
  {
    id: 'slip-externo', categoria: 'esquivas-cabeca', nome: 'Slip externo', nivel: 'intermediario',
    descricao: 'Incline a cabeça para fora do braço que lança o jab, girando levemente o tronco. O golpe passa rente ao seu rosto e você fica em posição para responder.',
    dicas: [
      'Dobre os joelhos para descer pouco e rápido, sem curvar a coluna.',
      'Mantenha os olhos no adversário durante todo o movimento.',
      'Deixe a mão de trás junto ao queixo para proteger o outro lado do rosto.',
    ],
    errosComuns: [
      'Afastar demais a cabeça e perder o equilíbrio.',
      'Fechar os olhos ou olhar para o chão na hora da esquiva.',
    ],
  },
  {
    id: 'slip-interno', categoria: 'esquivas-cabeca', nome: 'Slip interno', nivel: 'avancado',
    descricao: 'Incline a cabeça para dentro, pelo lado de dentro do braço que golpeia. Você fica mais perto e abre espaço para o contra-ataque, mas o movimento exige bom timing.',
    dicas: [
      'Só treine depois de dominar o slip externo.',
      'Contra-ataque na hora: o slip interno existe para abrir o golpe de volta.',
      'Gire o quadril junto com a cabeça para sair já em posição de golpear.',
    ],
    errosComuns: [
      'Esquecer da mão de trás do adversário, que fica livre para o golpe seguinte.',
      'Demorar: o slip interno é mais arriscado que o externo quando sai atrasado.',
    ],
  },
  {
    id: 'duck', categoria: 'esquivas-cabeca', nome: 'Duck', nivel: 'intermediario',
    descricao: 'Agache abaixo de um gancho, dobrando os joelhos e mantendo as costas retas. Quando o golpe passa por cima, você volta já pronto para golpear.',
    dicas: [
      'Desça com os joelhos e não com a cintura.',
      'Mantenha a guarda alta durante o agachamento.',
      'Suba já golpeando, ao corpo ou com um gancho.',
    ],
    errosComuns: [
      'Abaixar curvando as costas e olhando para o chão.',
      'Agachar tarde e ainda levar o gancho de cima para baixo.',
    ],
  },
  {
    id: 'bob-and-weave', categoria: 'esquivas-cabeca', nome: 'Bob and weave', nivel: 'avancado',
    descricao: 'Desenhe um U com a cabeça: desça por baixo do golpe, passe por baixo do braço do adversário e suba pelo outro lado, entrando por dentro. É o movimento básico de quem pressiona.',
    dicas: [
      'O movimento vem das pernas: flexione e estenda os joelhos.',
      'Mantenha a cabeça em movimento contínuo, sem parar no meio do U.',
      'Termine a entrada já com golpes curtos, para não ficar parado na curta distância.',
    ],
    errosComuns: [
      'Mexer só a cabeça e deixar o tronco reto.',
      'Fazer o U olhando para baixo, sem acompanhar o adversário.',
    ],
  },

  // ── Esquivas de tronco ────────────────────────────────────
  {
    id: 'shoulder-roll', categoria: 'esquivas-tronco', nome: 'Shoulder roll', nivel: 'avancado',
    descricao: 'Gire o ombro da frente para cima e para dentro, usando-o como escudo contra o direto e outros golpes retos, com o queixo escondido atrás dele. A mão de trás protege o outro lado do rosto.',
    dicas: [
      'Queixo baixo, escondido atrás do ombro da frente.',
      'Cotovelo de trás junto às costelas, protegendo o corpo.',
      'Gire o tronco e não só o ombro, para voltar rápido com o contra-golpe.',
    ],
    errosComuns: [
      'Deixar a mão de trás cair e ficar sem guarda para o gancho.',
      'Rolar o ombro sem girar o quadril e perder a potência do contra-ataque.',
    ],
  },
  {
    id: 'pull-back', categoria: 'esquivas-tronco', nome: 'Pull back', nivel: 'intermediario',
    descricao: 'Recue o tronco para fora do alcance do golpe, passando o peso para o pé de trás, e volte logo com um contra-golpe. Funciona contra golpes de longa distância.',
    dicas: [
      'Recue só o necessário: o golpe deve passar perto, sem acertar.',
      'Mantenha as mãos em guarda e o queixo baixo.',
      'Volte rápido com o jab ou o direto, que é o momento em que o adversário está mais aberto.',
    ],
    errosComuns: [
      'Recuar em linha reta várias vezes seguidas: o adversário te alcança.',
      'Esticar o pescoço para trás em vez de recuar o tronco inteiro.',
    ],
  },
  {
    id: 'lean-back', categoria: 'esquivas-tronco', nome: 'Lean back', nivel: 'avancado',
    descricao: 'Incline o tronco para trás com o peso no pé de trás, sem sair do lugar, e deixe o golpe passar na frente do rosto. É arriscado e exige equilíbrio, por isso use com moderação.',
    dicas: [
      'Passe o peso para o pé de trás e mantenha os joelhos flexionados.',
      'Mantenha a guarda fechada e os olhos no adversário.',
      'Volte já com um golpe, antes que ele emende outro.',
    ],
    errosComuns: [
      'Inclinar demais e perder o equilíbrio.',
      'Abusar da esquiva: o adversário percebe e fecha a distância.',
    ],
  },

  // ── Golpes fundamentais ───────────────────────────────────
  {
    id: 'jab', categoria: 'golpes', nome: 'Jab', nivel: 'iniciante',
    descricao: 'É o golpe de alcance, dado com a mão da frente: o mais rápido e o mais usado. Mede a distância, atrapalha o adversário e prepara as combinações.',
    dicas: [
      'Estique o braço girando o punho até a palma ficar para baixo no fim do golpe, sem travar o cotovelo.',
      'Volte a mão à guarda pelo mesmo caminho, tão rápido quanto saiu, soltando o ar a cada golpe.',
      'Deixe a mão de trás junto ao queixo durante o golpe.',
    ],
    errosComuns: [
      'Baixar a mão de trás ao golpear.',
      'Deixar a mão da frente pendurada na volta, sem retornar à guarda.',
    ],
  },
  {
    id: 'direto', categoria: 'golpes', nome: 'Direto (Cross)', nivel: 'iniciante',
    descricao: 'É o golpe de potência dado com a mão de trás. A força sai do pé de trás, passa pelo quadril e pelo ombro e termina no punho.',
    dicas: [
      'Gire o pé de trás, o quadril e o ombro juntos, em um só movimento: o calcanhar sai do chão e o joelho acompanha o pé.',
      'Mantenha o queixo baixo e a mão da frente protegendo o rosto, e estique o braço sem travar o cotovelo.',
      'Volte à guarda logo depois do impacto, soltando o ar junto com o golpe.',
    ],
    errosComuns: [
      'Golpear só com o braço, sem girar o quadril.',
      'Inclinar o corpo demais para a frente e perder o equilíbrio.',
    ],
  },
  {
    id: 'gancho', categoria: 'golpes', nome: 'Gancho (Hook)', nivel: 'intermediario',
    descricao: 'É um golpe circular e curto, com o cotovelo a cerca de 90° e o punho na altura do alvo, cabeça ou corpo. A potência vem do giro do corpo, e não do braço.',
    dicas: [
      'Mantenha o cotovelo dobrado e firme a 90° durante todo o golpe.',
      'Gire o pé da frente e o quadril para gerar a força: o calcanhar sai do chão e o joelho acompanha o pé.',
      'Deixe a outra mão junto ao queixo para se proteger.',
    ],
    errosComuns: [
      'Armar o gancho para trás antes de sair, avisando o adversário.',
      'Abrir demais o braço e perder a precisão.',
    ],
  },
  {
    id: 'uppercut', categoria: 'golpes', nome: 'Uppercut', nivel: 'intermediario',
    descricao: 'É um golpe curto, de baixo para cima, que sobe pelo meio da guarda. Funciona melhor na curta distância, no clinch ou contra quem está agachado.',
    dicas: [
      'Flexione levemente os joelhos e estenda as pernas ao subir, para empurrar o golpe.',
      'Mantenha o golpe curto e vertical, com o punho virado para você.',
      'Proteja o queixo com a outra mão.',
    ],
    errosComuns: [
      'Baixar demais a mão antes de golpear e avisar o adversário.',
      'Usar o golpe de longe: sem alcance, você só se expõe a um contra-ataque.',
    ],
  },
  {
    id: 'body-shot', categoria: 'golpes', nome: 'Body shot', nivel: 'intermediario',
    descricao: 'É o golpe ao corpo: ao fígado, do lado direito do adversário, ou ao plexo, na boca do estômago. Desgasta o adversário e abre a guarda para a cabeça.',
    dicas: [
      'Flexione os joelhos para descer, em vez de curvar a coluna.',
      'Mantenha a cabeça fora da linha de ataque do adversário.',
      'Combine com um golpe à cabeça para abrir a defesa.',
    ],
    errosComuns: [
      'Baixar a cabeça e a guarda ao golpear o corpo.',
      'Golpear sem flexionar os joelhos, curvando as costas.',
    ],
  },

  // ── Combinações ───────────────────────────────────────────
  {
    id: 'combo-1-2', categoria: 'combinacoes', nome: '1-2 (Jab + Direto)', nivel: 'iniciante',
    descricao: 'É a combinação base: o jab abre e mede a distância, e o direto vem logo atrás com potência. Dois golpes em um só ritmo.',
    dicas: [
      'Solte o direto assim que o jab volta, sem pausa entre os dois.',
      'Deixe o jab leve e rápido e guarde a potência para o direto.',
      'Termine sempre voltando à guarda, soltando o ar a cada golpe.',
    ],
    errosComuns: [
      'Fazer uma pausa entre o jab e o direto.',
      'Dar o direto sem girar o quadril por causa da pressa.',
    ],
  },
  {
    id: 'combo-1-2-3', categoria: 'combinacoes', nome: '1-2-3 (Jab + Direto + Gancho)', nivel: 'intermediario',
    descricao: 'Depois do jab e do direto a guarda do adversário se abre, e o gancho com a mão da frente entra por esse espaço. São três golpes encadeados no mesmo giro do corpo.',
    dicas: [
      'Aproveite o giro que o direto deixou para sair o gancho.',
      'Mantenha o cotovelo do gancho a 90°.',
      'Depois do gancho, volte à guarda ou saia em ângulo.',
    ],
    errosComuns: [
      'Perder o equilíbrio ao encadear o terceiro golpe.',
      'Soltar o gancho de longe, sem estar perto o bastante.',
    ],
  },
  {
    id: 'combo-1-1-2', categoria: 'combinacoes', nome: '1-1-2 (Jab duplo + Direto)', nivel: 'intermediario',
    descricao: 'O primeiro jab mede a distância, o segundo chega no tempo certo e o direto fecha a sequência. Quebra o ritmo previsível do 1-2.',
    dicas: [
      'Dê o segundo jab com um pouco mais de força, para fixar o adversário.',
      'Avance com o pé da frente no segundo jab.',
      'Solte o direto só depois que o segundo jab sair.',
    ],
    errosComuns: [
      'Fazer os dois jabs com a mesma velocidade e sempre no mesmo ritmo.',
      'Avançar sem cobertura, com o queixo exposto.',
    ],
  },
  {
    id: 'combo-1-2-3-2', categoria: 'combinacoes', nome: '1-2-3-2 (Jab + Direto + Gancho + Direto)', nivel: 'avancado',
    descricao: 'É uma combinação de quatro tempos: o jab, o direto e o gancho abrem o caminho para o segundo direto. Ele costuma pegar a defesa do adversário fora de posição.',
    dicas: [
      'Use o giro do gancho para lançar o direto final.',
      'Termine com a cabeça fora da linha de ataque.',
      'Treine devagar até virar um movimento só.',
    ],
    errosComuns: [
      'Perder o equilíbrio no direto final por usar força demais.',
      'Esquecer de proteger o queixo no meio da combinação.',
    ],
  },
]

export const exercicioPorId = (id: string | null | undefined): Exercicio | null => EXERCICIOS.find(e => e.id === id) ?? null

export const exerciciosDaCategoria = (categoria: CategoriaDeExercicio): Exercicio[] => EXERCICIOS.filter(e => e.categoria === categoria)
