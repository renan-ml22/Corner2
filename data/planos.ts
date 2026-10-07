import type { RegType } from '@/lib/tipos'

export type Nivel = 'iniciante' | 'intermediario' | 'avancado'

export interface SessaoPlano {
  id: string
  /** Dia da semana no padrão do JS: 0 = domingo, 1 = segunda … 6 = sábado */
  diaSemana: number
  tipo: RegType
  titulo: string
  rounds: number
  minPorRound: number
  descansoSeg: number
  descricao: string
  /** Itens do checklist mostrados na tela Hoje */
  checklist: string[]
  /** Semanas do plano em que a sessão acontece (inclusive). Ausente = todas. */
  semanas?: [number, number]
}

export interface Plano {
  id: string
  nome: string
  nivel: Nivel
  /** Rótulo de nível para exibição (ex.: "Intermediário/Avançado") */
  nivelLabel: string
  semanas: number
  diasPorSemana: number
  resumo: string
  sessoes: SessaoPlano[]
}

export const NIVEL_LABEL: Record<Nivel, string> = {
  iniciante: 'Iniciante',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
}

// Aplica o mesmo intervalo de semanas a um grupo de sessões.
function fase(semanas: [number, number], sessoes: Omit<SessaoPlano, 'semanas'>[]): SessaoPlano[] {
  return sessoes.map(s => ({ ...s, semanas }))
}

const fundamentos: Plano = {
  id: 'fundamentos',
  nome: 'Fundamentos',
  nivel: 'iniciante',
  nivelLabel: 'Iniciante',
  semanas: 4,
  diasPorSemana: 3,
  resumo: 'Guarda, base e golpes retos. Shadowboxing nas primeiras semanas, saco e manopla no fim.',
  sessoes: [
    ...fase([1, 2], [
      {
        id: 'fun-s1-seg', diaSemana: 1, tipo: 'tec', titulo: 'Guarda, base e jab',
        rounds: 4, minPorRound: 2, descansoSeg: 60,
        descricao: 'Shadowboxing lento no espelho: base firme, queixo protegido e jab voltando para a guarda.',
        checklist: ['Aquecimento: 5 min de mobilidade e corda leve', '4 rounds de shadowboxing só com jab', 'Base: 20 passos à frente/atrás sem cruzar os pés', 'Alongamento final'],
      },
      {
        id: 'fun-s1-qua', diaSemana: 3, tipo: 'tec', titulo: 'Jab-direto e deslocamento',
        rounds: 4, minPorRound: 2, descansoSeg: 60,
        descricao: 'Combine jab e direto (1-2) enquanto se desloca. Gire o quadril no direto e volte para a guarda.',
        checklist: ['Aquecimento: 5 min', '2 rounds de 1-2 parado', '2 rounds de 1-2 em movimento', 'Alongamento final'],
      },
      {
        id: 'fun-s1-sex', diaSemana: 5, tipo: 'con', titulo: 'Shadowboxing + corda',
        rounds: 4, minPorRound: 2, descansoSeg: 60,
        descricao: 'Rounds alternando corda e shadowboxing livre para ganhar ritmo e resistência.',
        checklist: ['2 rounds de corda', '2 rounds de shadowboxing livre', '3 séries de 15 abdominais', 'Alongamento final'],
      },
    ]),
    ...fase([3, 4], [
      {
        id: 'fun-s3-seg', diaSemana: 1, tipo: 'tec', titulo: 'Saco: golpes retos',
        rounds: 4, minPorRound: 2, descansoSeg: 60,
        descricao: 'Leve o jab e o direto para o saco. Foque em distância e em voltar para a guarda, não em força.',
        checklist: ['Aquecimento + 1 round de shadow', '4 rounds de saco: jab e 1-2', 'Bater e sair: 1-2 + passo para trás', 'Alongamento final'],
      },
      {
        id: 'fun-s3-qua', diaSemana: 3, tipo: 'tec', titulo: 'Manopla: precisão',
        rounds: 4, minPorRound: 2, descansoSeg: 60,
        descricao: 'Trabalho de manopla com parceiro ou treinador: 1-2, 1-1-2 e esquiva simples.',
        checklist: ['Aquecimento: 5 min', '4 rounds de manopla', 'Esquiva lateral após o 1-2', 'Alongamento final'],
      },
      {
        id: 'fun-s3-sex', diaSemana: 5, tipo: 'con', titulo: 'Saco em ritmo',
        rounds: 4, minPorRound: 2, descansoSeg: 60,
        descricao: 'Rounds contínuos no saco, mantendo ritmo constante do primeiro ao último segundo.',
        checklist: ['2 rounds de corda', '4 rounds de saco em ritmo constante', 'Prancha 3 × 30 s', 'Alongamento final'],
      },
    ]),
  ],
}

const baseAerobica: Plano = {
  id: 'base-aerobica',
  nome: 'Base Aeróbica',
  nivel: 'intermediario',
  nivelLabel: 'Intermediário',
  semanas: 6,
  diasPorSemana: 4,
  resumo: 'Condicionamento cardiovascular para aguentar rounds longos: saco, corda, shadowboxing e circuito.',
  sessoes: [
    {
      id: 'aer-seg', diaSemana: 1, tipo: 'con', titulo: 'Saco contínuo',
      rounds: 6, minPorRound: 3, descansoSeg: 60,
      descricao: 'Rounds de saco em volume moderado, sem parar de se mexer. Respire a cada golpe.',
      checklist: ['Aquecimento: 3 min de corda', '6 rounds de saco em ritmo moderado', 'Últimos 30 s de cada round em explosão', 'Alongamento final'],
    },
    {
      id: 'aer-ter', diaSemana: 2, tipo: 'tec', titulo: 'Shadowboxing técnico',
      rounds: 6, minPorRound: 3, descansoSeg: 60,
      descricao: 'Shadowboxing com foco em movimentação de pernas e combinações de 3 golpes.',
      checklist: ['Aquecimento: 5 min', '6 rounds de shadowboxing', 'Combinações 1-2-3 e 1-2-esquiva', 'Alongamento final'],
    },
    {
      id: 'aer-qui', diaSemana: 4, tipo: 'con', titulo: 'Corda intervalada',
      rounds: 6, minPorRound: 3, descansoSeg: 60,
      descricao: 'Rounds de corda alternando 30 s rápidos e 30 s leves. Termine com core.',
      checklist: ['6 rounds de corda (30 s forte / 30 s leve)', 'Core: 3 × 40 s de prancha', 'Alongamento final'],
    },
    {
      id: 'aer-sab', diaSemana: 6, tipo: 'con', titulo: 'Circuito de boxe',
      rounds: 6, minPorRound: 3, descansoSeg: 60,
      descricao: 'Cada round é uma estação: saco, burpees, corda, shadow com halteres leves, sprawl, saco.',
      checklist: ['Aquecimento: 5 min', 'Circuito: 6 estações de 3 min', 'Desaceleração: 5 min de caminhada', 'Alongamento final'],
    },
  ],
}

const tecnicaAvancada: Plano = {
  id: 'tecnica-avancada',
  nome: 'Técnica Avançada',
  nivel: 'avancado',
  nivelLabel: 'Intermediário/Avançado',
  semanas: 4,
  diasPorSemana: 4,
  resumo: 'Combinações, defesa e contra-ataque, com um sparring técnico por semana.',
  sessoes: [
    ...fase([1, 2], [
      {
        id: 'tav-s1-seg', diaSemana: 1, tipo: 'tec', titulo: 'Combinações em manopla',
        rounds: 6, minPorRound: 3, descansoSeg: 60,
        descricao: 'Sequências de 4 a 6 golpes alternando altura (cabeça/corpo) e terminando com saída lateral.',
        checklist: ['Aquecimento + 2 rounds de shadow', '6 rounds de manopla', 'Combinações com golpe no corpo', 'Alongamento final'],
      },
      {
        id: 'tav-s1-qua', diaSemana: 3, tipo: 'tec', titulo: 'Defesa e contra-ataque',
        rounds: 6, minPorRound: 3, descansoSeg: 60,
        descricao: 'Bloqueio, esquiva e pêndulo, sempre respondendo com contra-ataque imediato.',
        checklist: ['Aquecimento: 5 min', '3 rounds de esquiva + contra no saco', '3 rounds de defesa com parceiro', 'Alongamento final'],
      },
      {
        id: 'tav-s1-qui', diaSemana: 4, tipo: 'con', titulo: 'Saco de alta intensidade',
        rounds: 6, minPorRound: 3, descansoSeg: 60,
        descricao: 'Rounds de saco com picos de 20 s em velocidade máxima a cada minuto.',
        checklist: ['Aquecimento: 3 min de corda', '6 rounds de saco com picos', 'Core: 3 séries', 'Alongamento final'],
      },
      {
        id: 'tav-s1-sab', diaSemana: 6, tipo: 'spa', titulo: 'Sparring técnico',
        rounds: 6, minPorRound: 3, descansoSeg: 60,
        descricao: 'Sparring a 50% de intensidade. Objetivo: aplicar as combinações e defesas da semana.',
        checklist: ['Aquecimento completo', 'Bandagem e protetor bucal', '6 rounds de sparring técnico', 'Conversa com o parceiro: o que funcionou'],
      },
    ]),
    ...fase([3, 4], [
      {
        id: 'tav-s3-seg', diaSemana: 1, tipo: 'tec', titulo: 'Combinações em manopla',
        rounds: 8, minPorRound: 3, descansoSeg: 60,
        descricao: 'Mesmo trabalho das semanas anteriores, com mais rounds e ritmo de luta.',
        checklist: ['Aquecimento + 2 rounds de shadow', '8 rounds de manopla', 'Finalizar cada round com 15 s de explosão', 'Alongamento final'],
      },
      {
        id: 'tav-s3-qua', diaSemana: 3, tipo: 'tec', titulo: 'Defesa sob pressão',
        rounds: 8, minPorRound: 3, descansoSeg: 60,
        descricao: 'O parceiro pressiona e você defende nas cordas, saindo com contra-ataque e giro.',
        checklist: ['Aquecimento: 5 min', '4 rounds de defesa nas cordas', '4 rounds de contra-ataque', 'Alongamento final'],
      },
      {
        id: 'tav-s3-qui', diaSemana: 4, tipo: 'con', titulo: 'Saco de alta intensidade',
        rounds: 8, minPorRound: 3, descansoSeg: 60,
        descricao: 'Rounds de saco com picos de 20 s em velocidade máxima a cada minuto.',
        checklist: ['Aquecimento: 3 min de corda', '8 rounds de saco com picos', 'Core: 3 séries', 'Alongamento final'],
      },
      {
        id: 'tav-s3-sab', diaSemana: 6, tipo: 'spa', titulo: 'Sparring técnico',
        rounds: 8, minPorRound: 3, descansoSeg: 60,
        descricao: 'Sparring a 60–70%. Teste as defesas sob pressão e as saídas laterais.',
        checklist: ['Aquecimento completo', 'Bandagem e protetor bucal', '8 rounds de sparring técnico', 'Conversa com o parceiro: o que funcionou'],
      },
    ]),
  ],
}

// Pré-competição: volume e intensidade sobem a cada bloco de 2 semanas (8 → 10 → 12 rounds).
function blocoPreCompeticao(semanas: [number, number], rounds: number, intensidade: string): SessaoPlano[] {
  const s = `s${semanas[0]}`
  return fase(semanas, [
    {
      id: `pre-${s}-seg`, diaSemana: 1, tipo: 'tec', titulo: 'Manopla de estratégia',
      rounds, minPorRound: 3, descansoSeg: 60,
      descricao: `Trabalho de manopla simulando o plano de luta, em intensidade ${intensidade}.`,
      checklist: ['Aquecimento + shadow', `${rounds} rounds de manopla`, 'Revisar plano de luta com o treinador', 'Alongamento final'],
    },
    {
      id: `pre-${s}-ter`, diaSemana: 2, tipo: 'spa', titulo: 'Sparring',
      rounds, minPorRound: 3, descansoSeg: 60,
      descricao: `Sparring com parceiros diferentes a cada 2 rounds. Intensidade ${intensidade}.`,
      checklist: ['Aquecimento completo', 'Bandagem e protetor bucal', `${rounds} rounds de sparring`, 'Anotar o que ajustar'],
    },
    {
      id: `pre-${s}-qua`, diaSemana: 3, tipo: 'con', titulo: 'Condicionamento de luta',
      rounds, minPorRound: 3, descansoSeg: 60,
      descricao: 'Saco e circuitos em ritmo de luta, com descanso de 1 min igual ao da competição.',
      checklist: ['Aquecimento: corda', `${rounds} rounds de saco/circuito`, 'Core e pescoço', 'Alongamento final'],
    },
    {
      id: `pre-${s}-qui`, diaSemana: 4, tipo: 'tec', titulo: 'Técnica e velocidade',
      rounds, minPorRound: 3, descansoSeg: 60,
      descricao: 'Saco de velocidade, esquivas e combinações curtas e rápidas. Dia mais leve.',
      checklist: ['Aquecimento: 5 min', `${rounds} rounds de técnica`, 'Saco de velocidade', 'Alongamento final'],
    },
    {
      id: `pre-${s}-sab`, diaSemana: 6, tipo: 'spa', titulo: 'Sparring de simulação',
      rounds, minPorRound: 3, descansoSeg: 60,
      descricao: `Simulação de luta completa, com tempo e regras de competição. Intensidade ${intensidade}.`,
      checklist: ['Aquecimento completo', 'Bandagem e protetor bucal', `${rounds} rounds de simulação`, 'Recuperação: gelo e hidratação'],
    },
  ])
}

const preCompeticao: Plano = {
  id: 'pre-competicao',
  nome: 'Pré-competição',
  nivel: 'avancado',
  nivelLabel: 'Avançado',
  semanas: 6,
  diasPorSemana: 5,
  resumo: 'Volume alto e intensidade progressiva, com dois sparrings por semana até a luta.',
  sessoes: [
    ...blocoPreCompeticao([1, 2], 8, 'moderada'),
    ...blocoPreCompeticao([3, 4], 10, 'alta'),
    ...blocoPreCompeticao([5, 6], 12, 'de luta'),
  ],
}

export const PLANOS: Plano[] = [fundamentos, baseAerobica, tecnicaAvancada, preCompeticao]

export function getPlano(id: string | null | undefined): Plano | null {
  return PLANOS.find(p => p.id === id) ?? null
}

/** Sessões de uma semana do plano (1-based), ordenadas de segunda a domingo. */
export function sessoesDaSemana(plano: Plano, semana: number): SessaoPlano[] {
  const ordem = (d: number) => (d === 0 ? 7 : d)
  return plano.sessoes
    .filter(s => !s.semanas || (semana >= s.semanas[0] && semana <= s.semanas[1]))
    .sort((a, b) => ordem(a.diaSemana) - ordem(b.diaSemana))
}

/** Faixa de rounds do plano, para exibição (ex.: "8–12 × 3 min"). */
export function resumoRounds(plano: Plano): string {
  const rounds = plano.sessoes.map(s => s.rounds)
  const min = Math.min(...rounds)
  const max = Math.max(...rounds)
  const mins = plano.sessoes[0]?.minPorRound ?? 3
  return `${min === max ? min : `${min}–${max}`} rounds de ${mins} min`
}
