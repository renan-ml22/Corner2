import type { Nivel } from './planos'
import type { Postura, RegType } from '@/lib/tipos'

/** "Mão da frente" é a esquerda no ortodoxo e a direita no canhoto. */
export function maoDaFrente(p: Postura): string {
  return p === 'ortodoxo' ? 'esquerda' : 'direita'
}
export function maoDeTras(p: Postura): string {
  return p === 'ortodoxo' ? 'direita' : 'esquerda'
}

export interface Golpe {
  numero: string
  nome: string
  resumo: string
  dica: string
}

/** Numeração padrão dos golpes: vale igual para destros e canhotos (frente/trás). */
export const GOLPES: Golpe[] = [
  { numero: '1', nome: 'Jab', resumo: 'Direto de mão da frente.', dica: 'Sai do ombro, com rotação pequena. Volte pelo mesmo caminho e mantenha o queixo baixo.' },
  { numero: '2', nome: 'Direto (cross)', resumo: 'Direto de mão de trás.', dica: 'O pé de trás gira, o quadril e o ombro acompanham. O calcanhar de trás levanta.' },
  { numero: '3', nome: 'Gancho de mão da frente', resumo: 'Golpe curvo com a mão da frente.', dica: 'Cotovelo perto de 90°, pivô no pé da frente. O giro vem do tronco, não do braço.' },
  { numero: '4', nome: 'Gancho de mão de trás', resumo: 'Golpe curvo com a mão de trás.', dica: 'Pivô no pé de trás e transferência de peso. Volte à guarda antes de golpear de novo.' },
  { numero: '5', nome: 'Uppercut de mão da frente', resumo: 'Golpe de baixo para cima.', dica: 'Flexione os joelhos e suba junto com o golpe. Trajetória curta, sem baixar a mão de trás.' },
  { numero: '6', nome: 'Uppercut de mão de trás', resumo: 'Golpe de baixo para cima.', dica: 'Gire o quadril e empurre o chão com o pé de trás. Cuidado para não abrir a guarda.' },
]

export const NOTACAO_CORPO = 'Adicione "c" ao número para golpes ao corpo: 3c é o gancho de mão da frente no corpo.'

export interface Defesa {
  nome: string
  resumo: string
  dica: string
}

export const DEFESAS: Defesa[] = [
  { nome: 'Guarda alta e bloqueio', resumo: 'Mãos coladas no rosto, cotovelos no corpo.', dica: 'Receba o golpe nas luvas e antebraços, nunca com os braços esticados.' },
  { nome: 'Desvio (parry)', resumo: 'Toque curto com a palma para desviar o jab.', dica: 'Movimento de poucos centímetros; já prepare o contra-ataque.' },
  { nome: 'Esquiva (slip)', resumo: 'Tira a cabeça da linha do golpe.', dica: 'Flexione os joelhos e deslize para fora. Não incline só o tronco.' },
  { nome: 'Pêndulo (bob and weave)', resumo: 'Movimento em U por baixo dos ganchos.', dica: 'Dobre os joelhos para baixo, sem curvar a coluna, e saia pelo lado oposto.' },
  { nome: 'Passo atrás (pull)', resumo: 'Recua o tronco ou o passo para fora do alcance.', dica: 'Mantenha a base e o queixo. Volte rápido com o contra-ataque.' },
  { nome: 'Giro de ombro (shoulder roll)', resumo: 'Usa o ombro da frente para absorver golpes retos.', dica: 'É avançado: treine devagar no shadow antes de usar no sparring.' },
]

export interface Combinacao {
  notacao: string
  nome: string
  nivel: Nivel
  descricao: string
}

export const COMBINACOES: Combinacao[] = [
  // Iniciante
  { notacao: '1', nome: 'Jab simples', nivel: 'iniciante', descricao: 'Medir a distância e treinar o retorno à guarda.' },
  { notacao: '1-1', nome: 'Jab duplo', nivel: 'iniciante', descricao: 'O segundo jab avança um passo; o primeiro mede.' },
  { notacao: '1-2', nome: 'Clássico', nivel: 'iniciante', descricao: 'A base do boxe: jab e direto em sequência fluida.' },
  { notacao: '1-2-1', nome: 'Jab, direto, jab', nivel: 'iniciante', descricao: 'Fecha a sequência com o jab para sair em segurança.' },
  { notacao: '1-2-3', nome: 'Jab, direto, gancho', nivel: 'iniciante', descricao: 'Terceiro golpe curvo, aproveitando o giro do direto.' },
  { notacao: '2-3-2', nome: 'Direto, gancho, direto', nivel: 'iniciante', descricao: 'Boa para treinar a troca de apoio entre os pés.' },
  // Intermediário
  { notacao: '1-1-2', nome: 'Jab duplo e direto', nivel: 'intermediario', descricao: 'O duplo jab "esconde" o direto.' },
  { notacao: '1-2-3-2', nome: 'Jab, direto, gancho, direto', nivel: 'intermediario', descricao: 'Sequência de quatro com ritmo contínuo.' },
  { notacao: '3-2-3', nome: 'Gancho, direto, gancho', nivel: 'intermediario', descricao: 'Para curta distância, com giro de tronco constante.' },
  { notacao: '1-2-5-2', nome: 'Jab, direto, uppercut, direto', nivel: 'intermediario', descricao: 'Muda o ângulo no terceiro golpe.' },
  { notacao: '1-6-3-2', nome: 'Jab, uppercut, gancho, direto', nivel: 'intermediario', descricao: 'Clássica para entrar na guarda fechada.' },
  { notacao: '1-2-esquiva-2', nome: 'Jab, direto, esquiva, direto', nivel: 'intermediario', descricao: 'Defesa no meio da combinação: golpeie, saia da linha e golpeie.' },
  // Avançado
  { notacao: '1-2-3-6-3', nome: 'Jab, direto, gancho, uppercut, gancho', nivel: 'avancado', descricao: 'Cinco golpes alternando alturas e lados.' },
  { notacao: '1-2-3c-3', nome: 'Gancho ao corpo e à cabeça', nivel: 'avancado', descricao: 'Muda o nível: o gancho ao corpo abre o gancho à cabeça.' },
  { notacao: '1-2-3-2-esquiva-3', nome: 'Combinação com saída', nivel: 'avancado', descricao: 'Quatro golpes, esquiva e gancho de contra-ataque.' },
  { notacao: 'esquiva-2', nome: 'Esquiva e contra de direto', nivel: 'avancado', descricao: 'Esquive do jab pelo lado de fora e responda de imediato.' },
  { notacao: 'bloqueio-3-2', nome: 'Bloqueio e contra', nivel: 'avancado', descricao: 'Bloqueie o direto e devolva gancho e direto.' },
  { notacao: 'passo atrás-1-2', nome: 'Puxada e contra', nivel: 'avancado', descricao: 'Recue para o golpe passar e devolva o 1-2 na volta.' },
]

const ORDEM_NIVEL: Record<Nivel, number> = { iniciante: 0, intermediario: 1, avancado: 2 }

export function combosAteNivel(nivel: Nivel): Combinacao[] {
  return COMBINACOES.filter(c => ORDEM_NIVEL[c.nivel] <= ORDEM_NIVEL[nivel])
}

// ── Preparação e recuperação ─────────────────────────────────

export interface PassoGuia {
  titulo: string
  texto: string
}

export const AQUECIMENTO: PassoGuia[] = [
  { titulo: 'Mobilidade (2 min)', texto: 'Círculos de pescoço, ombros, quadril e tornozelos. Movimentos amplos e sem pressa.' },
  { titulo: 'Corda leve (3 min)', texto: 'Ritmo confortável, só para subir a temperatura do corpo.' },
  { titulo: 'Ativação de ombros (1 min)', texto: 'Círculos de braço e rotações com os cotovelos fechados.' },
  { titulo: 'Shadowboxing lento (1 round)', texto: 'Jab e direto a 50%, sentindo a base e o equilíbrio.' },
]

export const BANDAGEM: PassoGuia[] = [
  { titulo: '1. Alça no polegar', texto: 'Passe a alça no polegar com a faixa por cima do dorso da mão.' },
  { titulo: '2. Pulso', texto: 'Dê 2 a 3 voltas no pulso. Ele precisa ficar firme, sem cortar a circulação.' },
  { titulo: '3. Dorso da mão', texto: 'Cubra o dorso da mão e as articulações dos dedos com 2 a 3 voltas.' },
  { titulo: '4. Entre os dedos', texto: 'Passe a faixa entre os dedos, em X, para prender a mão.' },
  { titulo: '5. Polegar', texto: 'Dê uma volta no polegar para protegê-lo e volte ao pulso.' },
  { titulo: '6. Fechamento', texto: 'Termine no pulso e feche o velcro. Feche o punho: não pode haver dor, formigamento ou dedos roxos.' },
]

export const DESAQUECIMENTO: PassoGuia[] = [
  { titulo: 'Desaceleração (3 a 5 min)', texto: 'Caminhe e respire pelo nariz até a respiração normalizar.' },
  { titulo: 'Peitoral e ombros', texto: 'Alongue 30 segundos cada lado, sem balançar.' },
  { titulo: 'Punhos e antebraços', texto: 'Estenda o braço e puxe os dedos para trás e para baixo, 20 segundos cada.' },
  { titulo: 'Pernas e quadril', texto: 'Panturrilhas, posteriores e flexores do quadril, 30 segundos cada.' },
  { titulo: 'Hidratação', texto: 'Beba água e faça uma refeição com proteína e carboidrato em até 1 hora.' },
]

// ── Foco de cada round ───────────────────────────────────────

export interface FocoRound {
  numero: number
  titulo: string
  texto: string
  combos: string[]
}

/** Define o que fazer em cada round, de forma determinística a partir do tipo e do nível. */
export function focoDosRounds(tipo: RegType, rounds: number, nivel: Nivel): FocoRound[] {
  const pool = combosAteNivel(nivel)
  const doNivel = pool.filter(c => c.nivel === nivel)
  const base = (doNivel.length >= 3 ? doNivel : pool).map(c => c.notacao)

  return Array.from({ length: rounds }, (_, i) => {
    const numero = i + 1
    const primeiro = numero === 1
    const ultimo = numero === rounds && rounds > 1

    if (tipo === 'tec') {
      if (primeiro && rounds >= 4) {
        return { numero, titulo: 'Aquecimento técnico', texto: 'Shadowboxing leve, só com jab. Foque na guarda, na base e na respiração.', combos: ['1'] }
      }
      if (ultimo && rounds >= 4) {
        return { numero, titulo: 'Round livre', texto: 'Junte as combinações que praticou, sem parar de se mover. Termine sempre na guarda.', combos: [] }
      }
      const combo = base[(i - 1 + base.length) % base.length]
      return { numero, titulo: `Combinação ${combo}`, texto: `Repita ${combo} a 60% da velocidade, buscando precisão. Nos últimos 20 segundos, acelere para ritmo de luta.`, combos: [combo] }
    }

    if (tipo === 'con') {
      if (primeiro) return { numero, titulo: 'Aquecimento ativo', texto: 'Ritmo a 50%, aumentando a cada 30 segundos.', combos: [] }
      if (ultimo) return { numero, titulo: 'Fechamento', texto: 'Ritmo forte até o sino. Mantenha a técnica mesmo cansado.', combos: [] }
      const padrao = (i - 1) % 3
      if (padrao === 0) return { numero, titulo: 'Ritmo constante', texto: 'Mantenha 70% do esforço, sem queda de ritmo. Respire a cada golpe.', combos: [] }
      if (padrao === 1) return { numero, titulo: 'Picos de intensidade', texto: 'Nos últimos 20 segundos de cada minuto, explosão máxima. No resto, recupere o ritmo.', combos: [] }
      return { numero, titulo: 'Volume', texto: 'O maior número possível de golpes limpos, com a guarda sempre voltando.', combos: [] }
    }

    // Sparring
    if (primeiro) return { numero, titulo: 'Estudar o parceiro', texto: 'Use o jab para medir distância e ritmo. Intensidade a 50%, sem buscar o nocaute.', combos: ['1'] }
    if (ultimo) return { numero, titulo: 'Controle', texto: 'Termine com defesa sólida e golpes curtos. Sem exagero: o objetivo é sair bem.', combos: [] }
    const combo = base[(i - 1) % base.length]
    return { numero, titulo: `Objetivo: ${combo} e uma defesa`, texto: `Aplique ${combo} ao menos três vezes e use uma esquiva ou um bloqueio antes de cada troca.`, combos: [combo] }
  })
}
