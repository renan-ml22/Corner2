import { chaveDia, diferencaDias, inicioDaSemana, inicioDoDia, somarDias } from './datas'
import { treinosEntre } from './treinos'
import { REGIOES, type Checkin, type Lesao, type RegType, type WorkoutEntry } from './tipos'

// ── Carga de treino (método da "RPE da sessão") ──────────────
// carga = RPE × minutos de rounds; compara-se os últimos 7 dias com a média das semanas anteriores.

export function cargaDaSessao(t: WorkoutEntry): number {
  return Math.round(t.rpe * t.rounds * t.minPorRound)
}

function somaCarga(historico: WorkoutEntry[], inicio: Date, fimExclusivo: Date): number {
  return treinosEntre(historico, inicio, fimExclusivo).reduce((s, t) => s + cargaDaSessao(t), 0)
}

export type StatusCarga = 'baixa' | 'ideal' | 'atencao' | 'alta'

export interface Carga {
  aguda: number
  cronica: number
  razao: number
  status: StatusCarga
}

export const STATUS_CARGA_TEXTO: Record<StatusCarga, { titulo: string; texto: string; icone: string }> = {
  baixa: { titulo: 'Abaixo do seu normal', texto: 'Você treinou menos que de costume. Tudo bem se foi descanso planejado.', icone: 'ph-arrow-down' },
  ideal: { titulo: 'Na faixa ideal', texto: 'A carga recente está compatível com o que seu corpo já tolera.', icone: 'ph-check-circle' },
  atencao: { titulo: 'Subindo rápido', texto: 'A carga passou do seu normal. Evite aumentar mais nesta semana.', icone: 'ph-warning' },
  alta: { titulo: 'Carga alta demais', texto: 'O salto é grande e aumenta o risco de lesão. Reduza o volume ou a intensidade.', icone: 'ph-warning-octagon' },
}

/** Devolve `null` quando ainda não há histórico suficiente (menos de duas semanas). */
export function calcularCarga(historico: WorkoutEntry[], hoje: Date): Carga | null {
  if (historico.length === 0) return null
  const fim = somarDias(inicioDoDia(hoje), 1)
  const primeiro = historico.reduce((m, t) => Math.min(m, new Date(t.data).getTime()), Infinity)
  const diasDeHistorico = diferencaDias(hoje, new Date(primeiro)) + 1
  const anteriores = Math.min(4, Math.floor(diasDeHistorico / 7) - 1)
  if (anteriores < 1) return null

  const aguda = somaCarga(historico, somarDias(fim, -7), fim)
  let total = 0
  for (let k = 1; k <= anteriores; k++) {
    total += somaCarga(historico, somarDias(fim, -7 * (k + 1)), somarDias(fim, -7 * k))
  }
  const cronica = total / anteriores
  if (cronica === 0) return null

  const razao = aguda / cronica
  const status: StatusCarga = razao < 0.8 ? 'baixa' : razao <= 1.3 ? 'ideal' : razao <= 1.5 ? 'atencao' : 'alta'
  return { aguda: Math.round(aguda), cronica: Math.round(cronica), razao, status }
}

/** Carga total por semana (segunda a domingo) nas últimas `n` semanas. */
export function cargaSemanal(historico: WorkoutEntry[], hoje: Date, n = 8): number[] {
  const segundaAtual = inicioDaSemana(hoje)
  return Array.from({ length: n }, (_, i) => {
    const segunda = somarDias(segundaAtual, -7 * (n - 1 - i))
    return somaCarga(historico, segunda, somarDias(segunda, 7))
  })
}

// ── Check-in diário e ajuste do treino ───────────────────────

/** 1 (pior) a 5 (melhor): média de sono, energia e ausência de dor. */
export function prontidao(c: Checkin): number {
  return (c.sono + c.energia + (6 - c.dor)) / 3
}

export type NivelAjuste = 'normal' | 'reduzir' | 'leve' | 'descanso'

export interface AjusteSugerido {
  nivel: NivelAjuste
  tipo: RegType
  rounds: number
  score: number
  titulo: string
  motivo: string
}

export function sugerirAjuste(c: Checkin | null, tipo: RegType, rounds: number): AjusteSugerido | null {
  if (!c) return null
  const score = prontidao(c)
  const base = { score }

  // Dor forte pesa mais do que a média: ela limita o nível, não importa o sono ou a energia.
  if (score < 2.3 || c.dor >= 5) {
    return { ...base, nivel: 'descanso', tipo, rounds: 0, titulo: 'Hoje é dia de descansar', motivo: 'Seu corpo pede recuperação. Treinar assim aumenta o risco de lesão e rende pouco. Descanse, durma bem e hidrate-se.' }
  }
  if (score < 3 || c.dor >= 4) {
    return { ...base, nivel: 'leve', tipo: tipo === 'spa' ? 'tec' : tipo, rounds: Math.max(2, Math.round(rounds * 0.5)), titulo: 'Faça um treino leve', motivo: tipo === 'spa' ? 'Sparring não é indicado nesse estado. Troque por técnica leve, com metade dos rounds.' : 'Reduza para metade dos rounds e trabalhe a 50% do esforço.' }
  }
  if (score < 3.7) {
    return { ...base, nivel: 'reduzir', tipo, rounds: Math.max(2, Math.round(rounds * 0.75)), titulo: 'Reduza um pouco o volume', motivo: 'Você está um pouco abaixo do ideal. Diminuir cerca de 25% dos rounds mantém o estímulo sem sobrecarregar.' }
  }
  return { ...base, nivel: 'normal', tipo, rounds, titulo: 'Você está pronto', motivo: 'Sono, energia e dor estão em boa condição. Siga o treino como planejado.' }
}

// ── Alertas ──────────────────────────────────────────────────

export type NivelAlerta = 'info' | 'atencao' | 'critico'

export interface Alerta {
  id: string
  nivel: NivelAlerta
  titulo: string
  texto: string
  icone: string
}

const ORDEM_ALERTA: Record<NivelAlerta, number> = { critico: 0, atencao: 1, info: 2 }

interface EntradaAlertas {
  historico: WorkoutEntry[]
  lesoes: Lesao[]
  /** Tipo da sessão prevista para hoje, se houver */
  sessaoHojeTipo: RegType | null
  metaSemanal: number
  hoje: Date
}

export function gerarAlertas({ historico, lesoes, sessaoHojeTipo, metaSemanal, hoje }: EntradaAlertas): Alerta[] {
  const alertas: Alerta[] = []
  const ordenado = [...historico].sort((a, b) => b.data.localeCompare(a.data))
  const horasDesde = (iso: string) => (hoje.getTime() - new Date(iso).getTime()) / 3_600_000

  // Pancadas fortes na cabeça
  const forte = ordenado.find(t => t.sparring?.cabeca === 'fortes')
  if (forte) {
    const dias = diferencaDias(hoje, new Date(forte.data))
    const sintomas = 'Se tiver dor de cabeça persistente, tontura, náusea, visão turva ou confusão, procure atendimento médico.'
    if (dias < 7) {
      alertas.push({ id: 'cabeca-recente', nivel: 'critico', icone: 'ph-first-aid', titulo: 'Pancadas fortes na cabeça', texto: `Você registrou pancadas fortes há ${dias === 0 ? 'poucas horas' : `${dias} ${dias === 1 ? 'dia' : 'dias'}`}. Evite sparring por mais ${7 - dias} ${7 - dias === 1 ? 'dia' : 'dias'}. ${sintomas}` })
    } else if (dias < 14) {
      alertas.push({ id: 'cabeca-retorno', nivel: 'atencao', icone: 'ph-first-aid', titulo: 'Volte ao sparring aos poucos', texto: `Houve pancadas fortes na cabeça há ${dias} dias. Retome com intensidade leve e poucos rounds. ${sintomas}` })
    }
  }

  // Lesões ativas
  for (const l of lesoes.filter(x => !x.resolvidaEm && x.intensidade >= 3)) {
    alertas.push({
      id: `lesao-${l.id}`, nivel: l.intensidade >= 4 ? 'critico' : 'atencao', icone: 'ph-bandaids',
      titulo: `Lesão ativa: ${REGIOES[l.regiao]} (${l.intensidade}/5)`,
      texto: l.intensidade >= 4 ? 'Evite golpear com carga e procure um fisioterapeuta ou médico antes de voltar ao treino pesado.' : 'Adapte o treino para poupar essa região e acompanhe. Se piorar, procure um profissional.',
    })
  }

  // Sparring em intervalo curto
  const ultimoSparring = ordenado.find(t => t.tipo === 'spa')
  if (sessaoHojeTipo === 'spa' && ultimoSparring && horasDesde(ultimoSparring.data) < 48) {
    alertas.push({ id: 'sparring-intervalo', nivel: 'atencao', icone: 'ph-timer', titulo: 'Intervalo curto entre sparrings', texto: 'O ideal é esperar ao menos 48 horas entre sparrings. Considere trocar o de hoje por técnica leve.' })
  }

  // Carga subindo rápido
  const carga = calcularCarga(historico, hoje)
  if (carga && (carga.status === 'atencao' || carga.status === 'alta')) {
    alertas.push({
      id: 'carga', nivel: carga.status === 'alta' ? 'critico' : 'atencao', icone: STATUS_CARGA_TEXTO[carga.status].icone,
      titulo: STATUS_CARGA_TEXTO[carga.status].titulo,
      texto: `Sua carga dos últimos 7 dias está ${carga.razao.toFixed(1).replace('.', ',')}× acima da sua média recente. ${STATUS_CARGA_TEXTO[carga.status].texto}`,
    })
  }

  // Último treino muito intenso
  const ultimo = ordenado[0]
  if (ultimo && ultimo.rpe >= 9 && horasDesde(ultimo.data) < 48) {
    alertas.push({ id: 'rpe-alto', nivel: 'atencao', icone: 'ph-battery-low', titulo: 'Último treino foi muito intenso', texto: `Você marcou esforço ${ultimo.rpe}/10. Priorize recuperação: técnica leve ou descanso antes de forçar de novo.` })
  }

  // Meta semanal
  const feitos = treinosEntre(historico, inicioDaSemana(hoje), somarDias(inicioDaSemana(hoje), 7)).length
  const diasRestantes = 7 - ((hoje.getDay() + 6) % 7)
  if (feitos >= metaSemanal) {
    alertas.push({ id: 'meta-batida', nivel: 'info', icone: 'ph-trophy', titulo: 'Meta da semana batida', texto: `Você fez ${feitos} ${feitos === 1 ? 'treino' : 'treinos'} e a meta era ${metaSemanal}. Qualquer treino extra é bônus; ouça o corpo.` })
  } else if (diasRestantes <= metaSemanal - feitos) {
    const faltam = metaSemanal - feitos
    alertas.push({ id: 'meta-risco', nivel: 'info', icone: 'ph-target', titulo: 'A meta da semana está apertada', texto: `Faltam ${faltam} ${faltam === 1 ? 'treino' : 'treinos'} e restam ${diasRestantes} ${diasRestantes === 1 ? 'dia' : 'dias'}. Treinar hoje mantém a sequência viva.` })
  }

  return alertas.sort((a, b) => ORDEM_ALERTA[a.nivel] - ORDEM_ALERTA[b.nivel])
}

// ── Impactos na cabeça ───────────────────────────────────────

export interface ResumoCabeca {
  sparrings: number
  leves: number
  fortes: number
  ultimoForte: Date | null
}

export function resumoCabeca(historico: WorkoutEntry[], hoje: Date, dias = 30): ResumoCabeca {
  const recentes = treinosEntre(historico, somarDias(inicioDoDia(hoje), -(dias - 1)), somarDias(inicioDoDia(hoje), 1)).filter(t => t.tipo === 'spa')
  const fortes = recentes.filter(t => t.sparring?.cabeca === 'fortes')
  const ultimo = fortes.sort((a, b) => b.data.localeCompare(a.data))[0]
  return {
    sparrings: recentes.length,
    leves: recentes.filter(t => t.sparring?.cabeca === 'leves').length,
    fortes: fortes.length,
    ultimoForte: ultimo ? new Date(ultimo.data) : null,
  }
}

export function checkinDeHoje(checkins: Checkin[], hoje: Date): Checkin | null {
  const chave = chaveDia(hoje)
  return checkins.find(c => c.data === chave) ?? null
}
