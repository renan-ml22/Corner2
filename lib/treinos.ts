import { sessoesDaSemana, type Plano, type SessaoPlano } from '@/data/planos'
import { chaveDia, dataNaSemana, deChave, diferencaDias, inicioDaSemana, inicioDoDia, somarDias } from './datas'
import { TIPOS, type PlanoAtivo, type RegType, type WorkoutEntry } from './tipos'

export type StatusSessao = 'feita' | 'perdida' | 'hoje' | 'futura'

export interface SessaoComStatus {
  sessao: SessaoPlano
  data: Date
  status: StatusSessao
  treino?: WorkoutEntry
}

/** Semana do plano (1-based) em que `hoje` cai. Pode passar do total quando o plano acabou. */
export function semanaAtualDoPlano(ativo: PlanoAtivo, hoje: Date): number {
  return Math.floor(diferencaDias(hoje, deChave(ativo.inicio)) / 7) + 1
}

export function segundaDaSemanaDoPlano(ativo: PlanoAtivo, semana: number): Date {
  return somarDias(deChave(ativo.inicio), (semana - 1) * 7)
}

export function treinosEntre(historico: WorkoutEntry[], inicio: Date, fimExclusivo: Date): WorkoutEntry[] {
  const a = inicio.getTime()
  const b = fimExclusivo.getTime()
  return historico.filter(t => {
    const ms = new Date(t.data).getTime()
    return ms >= a && ms < b
  })
}

/**
 * Cruza as sessões de uma semana do plano com o histórico.
 * Um treino conta para a sessão do mesmo tipo — de preferência no mesmo dia,
 * senão em qualquer dia daquela semana (treinar na terça a sessão de segunda vale).
 */
export function sessoesComStatus(
  plano: Plano, ativo: PlanoAtivo, semana: number, historico: WorkoutEntry[], hoje: Date,
): SessaoComStatus[] {
  const segunda = segundaDaSemanaDoPlano(ativo, semana)
  const daSemana = treinosEntre(historico, segunda, somarDias(segunda, 7))
  const usados = new Set<string>()
  const sessoes = sessoesDaSemana(plano, semana).map(sessao => ({ sessao, data: dataNaSemana(segunda, sessao.diaSemana) }))

  const pegar = (filtro: (t: WorkoutEntry) => boolean) => {
    const t = daSemana.find(x => !usados.has(x.id) && filtro(x))
    if (t) usados.add(t.id)
    return t
  }

  const feitos = new Map<string, WorkoutEntry>()
  // 1ª passada: mesmo tipo e mesmo dia. 2ª: mesmo tipo em qualquer dia da semana.
  for (const { sessao, data } of sessoes) {
    const t = pegar(x => x.tipo === sessao.tipo && chaveDia(new Date(x.data)) === chaveDia(data))
    if (t) feitos.set(sessao.id, t)
  }
  for (const { sessao } of sessoes) {
    if (feitos.has(sessao.id)) continue
    const t = pegar(x => x.tipo === sessao.tipo)
    if (t) feitos.set(sessao.id, t)
  }

  const hojeKey = chaveDia(hoje)
  return sessoes.map(({ sessao, data }) => {
    const treino = feitos.get(sessao.id)
    const key = chaveDia(data)
    const status: StatusSessao = treino ? 'feita' : key === hojeKey ? 'hoje' : key < hojeKey ? 'perdida' : 'futura'
    return { sessao, data, status, treino }
  })
}

export interface ProximaSessao extends SessaoComStatus {
  semana: number
}

/** Próxima sessão pendente a partir de hoje (inclusive), olhando a semana atual e as seguintes. */
export function proximaSessao(plano: Plano, ativo: PlanoAtivo, historico: WorkoutEntry[], hoje: Date): ProximaSessao | null {
  const atual = Math.max(1, semanaAtualDoPlano(ativo, hoje))
  for (let semana = atual; semana <= plano.semanas; semana++) {
    const s = sessoesComStatus(plano, ativo, semana, historico, hoje).find(x => x.status === 'hoje' || x.status === 'futura')
    if (s) return { ...s, semana }
  }
  return null
}

/** Sessão marcada para hoje no plano (feita ou não), se houver. */
export function sessaoDeHoje(plano: Plano, ativo: PlanoAtivo, historico: WorkoutEntry[], hoje: Date): SessaoComStatus | null {
  const semana = semanaAtualDoPlano(ativo, hoje)
  if (semana < 1 || semana > plano.semanas) return null
  const hojeKey = chaveDia(hoje)
  return sessoesComStatus(plano, ativo, semana, historico, hoje).find(s => chaveDia(s.data) === hojeKey) ?? null
}

/** Dias da semana atual (segunda → domingo) com pelo menos um treino. */
export function diasTreinadosNaSemana(historico: WorkoutEntry[], hoje: Date): boolean[] {
  const segunda = inicioDaSemana(hoje)
  const dias = new Set(treinosEntre(historico, segunda, somarDias(segunda, 7)).map(t => chaveDia(new Date(t.data))))
  return Array.from({ length: 7 }, (_, i) => dias.has(chaveDia(somarDias(segunda, i))))
}

/**
 * Sequência = semanas seguidas batendo a meta semanal de treinos.
 * A semana atual só soma quando a meta já foi batida; enquanto não bate, ela não quebra a sequência.
 */
export function sequenciaDeSemanas(historico: WorkoutEntry[], metaSemanal: number, hoje: Date): number {
  const meta = Math.max(1, metaSemanal) // meta 0 faria o laço abaixo nunca parar
  const segundaAtual = inicioDaSemana(hoje)
  const contagem = (segunda: Date) => treinosEntre(historico, segunda, somarDias(segunda, 7)).length
  let seq = contagem(segundaAtual) >= meta ? 1 : 0
  for (let s = somarDias(segundaAtual, -7); ; s = somarDias(s, -7)) {
    if (contagem(s) < meta) break
    seq++
  }
  return seq
}

export function treinosNaSemanaAtual(historico: WorkoutEntry[], hoje: Date): number {
  const segunda = inicioDaSemana(hoje)
  return treinosEntre(historico, segunda, somarDias(segunda, 7)).length
}

export interface EstatisticasMes {
  treinos: number
  rounds: number
  minutos: number
  rpeMedio: number | null
  porTipo: Record<RegType, number>
}

export function estatisticasDoMes(historico: WorkoutEntry[], hoje: Date): EstatisticasMes {
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1)
  const doMes = treinosEntre(historico, inicio, fim)
  const porTipo = Object.fromEntries(TIPOS.map(t => [t, 0])) as Record<RegType, number>
  doMes.forEach(t => { porTipo[t.tipo]++ })
  return {
    treinos: doMes.length,
    rounds: doMes.reduce((s, t) => s + t.rounds, 0),
    minutos: doMes.reduce((s, t) => s + t.rounds * t.minPorRound, 0),
    rpeMedio: doMes.length ? doMes.reduce((s, t) => s + t.rpe, 0) / doMes.length : null,
    porTipo,
  }
}

export interface VolumeSemana {
  segunda: Date
  rounds: number
  treinos: number
  atual: boolean
}

/** Rounds por semana nas últimas `n` semanas (da mais antiga para a atual). */
export function volumeSemanal(historico: WorkoutEntry[], hoje: Date, n = 8): VolumeSemana[] {
  const segundaAtual = inicioDaSemana(hoje)
  return Array.from({ length: n }, (_, i) => {
    const segunda = somarDias(segundaAtual, -7 * (n - 1 - i))
    const treinos = treinosEntre(historico, segunda, somarDias(segunda, 7))
    return { segunda, rounds: treinos.reduce((s, t) => s + t.rounds, 0), treinos: treinos.length, atual: i === n - 1 }
  })
}

export interface Sugestao {
  tipo: RegType
  rounds: number
  minPorRound: number
  motivo: string
}

const PADRAO_POR_TIPO: Record<RegType, { rounds: number; minPorRound: number }> = {
  tec: { rounds: 6, minPorRound: 3 },
  con: { rounds: 6, minPorRound: 3 },
  spa: { rounds: 4, minPorRound: 2 },
}

/** Sem plano ativo: sugere o tipo menos treinado nos últimos 7 dias. */
export function sugestaoSemPlano(historico: WorkoutEntry[], hoje: Date): Sugestao {
  const recentes = treinosEntre(historico, somarDias(inicioDoDia(hoje), -6), somarDias(inicioDoDia(hoje), 1))
  const ordem: RegType[] = ['tec', 'con', 'spa']
  const contagem = (t: RegType) => recentes.filter(r => r.tipo === t).length
  const tipo = [...ordem].sort((a, b) => contagem(a) - contagem(b))[0]
  const motivo = recentes.length === 0
    ? 'Comece pela base: técnica primeiro.'
    : `É o tipo que você menos treinou nos últimos 7 dias (${contagem(tipo)}×).`
  return { tipo, ...PADRAO_POR_TIPO[tipo], motivo }
}
