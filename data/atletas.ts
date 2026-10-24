// Atletas do quiz de estilo. Os textos descrevem o ESTILO de luta de cada um (e não prometem nada em nome deles).
// O Corner não tem vínculo com os atletas nem com seus representantes, e não usa foto: cada um aparece como uma bolinha
// com a sua cor e as suas iniciais.

/**
 * Tags de estilo. As que as perguntas do quiz pontuam estão em data/quiz.ts; as demais (alcance, físico, adaptação,
 * reflexo, combinações) descrevem o atleta, mas nenhuma resposta as pontua.
 */
export const TAGS_DE_ESTILO = [
  'footwork', 'pressao', 'counter', 'velocidade', 'potencia', 'tecnica', 'resistencia', 'defesa', 'inside-fighting', 'corpo',
  'alcance', 'fisico', 'adaptacao', 'reflexo', 'combinacoes',
] as const
export type TagDeEstilo = (typeof TAGS_DE_ESTILO)[number]

export interface Atleta {
  id: string
  nome: string
  estilo: string
  descricao: string
  caracteristicas: string[]
  /** Em que o estilo do atleta se destaca (cruzado com as respostas do quiz). */
  pontosFortes: TagDeEstilo[]
  /** Cor da bolinha do atleta, em oklch. */
  corPrimaria: string
}

export const ATLETAS: Atleta[] = [
  {
    id: 'ali',
    nome: 'Muhammad Ali',
    estilo: 'Out-boxer',
    descricao: 'O maior. Velocidade, footwork e inteligência. Float like a butterfly, sting like a bee.',
    caracteristicas: ['Footwork excepcional', 'Jab longo e rápido', 'Rope-a-dope', 'Movimento constante'],
    pontosFortes: ['velocidade', 'tecnica', 'footwork'],
    corPrimaria: 'oklch(0.75 0.15 50)',
  },
  {
    id: 'tyson',
    nome: 'Mike Tyson',
    estilo: 'Swarmer',
    descricao: 'Explosão pura. Peek-a-boo style, pressão constante e nocautes devastadores.',
    caracteristicas: ['Peek-a-boo defense', 'Uppercut letal', 'Pressão constante', 'Head movement'],
    pontosFortes: ['potencia', 'pressao', 'inside-fighting'],
    corPrimaria: 'oklch(0.63 0.21 25)',
  },
  {
    id: 'mayweather',
    nome: 'Floyd Mayweather Jr.',
    estilo: 'Counter-puncher',
    descricao: 'Invicto e perfeito. Shoulder roll, eficiência máxima e defesa impenetrável.',
    caracteristicas: ['Shoulder roll', 'Contra-golpes precisos', 'Controle de distância', 'Defesa ativa'],
    pontosFortes: ['defesa', 'tecnica', 'counter'],
    corPrimaria: 'oklch(0.75 0.18 255)',
  },
  {
    id: 'pacquiao',
    nome: 'Manny Pacquiao',
    estilo: 'Southpaw agressivo',
    descricao: 'Combinações explosivas, ângulos imprevisíveis e pressão que não para.',
    caracteristicas: ['Combinações rápidas', 'Ângulos southpaw', 'Pressão lateral', 'Velocidade de mãos'],
    pontosFortes: ['velocidade', 'pressao', 'combinacoes'],
    corPrimaria: 'oklch(0.72 0.15 150)',
  },
  {
    id: 'stevenson',
    nome: 'Teófilo Stevenson',
    estilo: 'Power puncher',
    descricao: 'Três vezes campeão olímpico. Direto de direita devastador e domínio físico total.',
    caracteristicas: ['Direto de direita', 'Domínio físico', 'Guarda alta', 'Nocaute em 1 golpe'],
    pontosFortes: ['potencia', 'alcance', 'fisico'],
    corPrimaria: 'oklch(0.66 0.16 258)',
  },
  {
    id: 'robinson',
    nome: 'Sugar Ray Robinson',
    estilo: 'All-around',
    descricao: 'Considerado o melhor de todos os tempos por muitos. Completo, fluido e elegante.',
    caracteristicas: ['Combinações fluidas', 'Adaptação tática', 'Velocidade e potência', 'Counter-punching'],
    pontosFortes: ['tecnica', 'velocidade', 'adaptacao'],
    corPrimaria: 'oklch(0.75 0.12 340)',
  },
  {
    id: 'frazier',
    nome: 'Joe Frazier',
    estilo: 'Swarmer resistente',
    descricao: 'Coração indomável. Head movement constante e gancho de esquerda histórico.',
    caracteristicas: ['Head movement', 'Gancho de esquerda', 'Volume de golpes', 'Resistência extrema'],
    pontosFortes: ['resistencia', 'pressao', 'inside-fighting'],
    corPrimaria: 'oklch(0.7 0.14 200)',
  },
  {
    id: 'foreman',
    nome: 'George Foreman',
    estilo: 'Slugger',
    descricao: 'Pressão implacável e poder bruto. Dois reinados como campeão com 20 anos de diferença.',
    caracteristicas: ['Pressão de cima', 'Golpes ao corpo', 'Força devastadora', 'Resistência ao nocaute'],
    pontosFortes: ['potencia', 'fisico', 'pressao'],
    corPrimaria: 'oklch(0.68 0.18 35)',
  },
  {
    id: 'canelo',
    nome: 'Canelo Álvarez',
    estilo: 'Counter-puncher moderno',
    descricao: 'O melhor da geração atual. Esquivas de tronco, timing perfeito e golpes ao corpo.',
    caracteristicas: ['Esquiva de tronco', 'Golpes ao corpo', 'Timing preciso', 'Adaptação tática'],
    pontosFortes: ['defesa', 'counter', 'corpo'],
    corPrimaria: 'oklch(0.7 0.18 50)',
  },
  {
    id: 'conceicao',
    nome: 'Robson Conceição',
    estilo: 'Boxeador veloz',
    descricao: 'Campeão olímpico brasileiro. Velocidade explosiva, reflexos e combinações imprevisíveis.',
    caracteristicas: ['Velocidade extrema', 'Reflexos rápidos', 'Ângulos inesperados', 'Combinações criativas'],
    pontosFortes: ['velocidade', 'reflexo', 'combinacoes'],
    corPrimaria: 'oklch(0.72 0.15 105)',
  },
]

export const atletaPorId = (id: string | null | undefined): Atleta | null => ATLETAS.find(a => a.id === id) ?? null

/** "Floyd Mayweather Jr." -> "FM": a primeira letra do primeiro e do último nome (sem "Jr."). */
export function iniciaisDoAtleta(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter(p => p && !/^(jr|sr|filho|neto)\.?$/i.test(p))
  if (palavras.length === 0) return ''
  const primeira = [...palavras[0]][0].toUpperCase()
  return palavras.length === 1 ? primeira : primeira + [...palavras[palavras.length - 1]][0].toUpperCase()
}
