// Datas sempre no fuso local do aparelho. "Chave de dia" = YYYY-MM-DD.

const DIA_MS = 24 * 60 * 60 * 1000

export const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export const DIAS_LONGOS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
export const DIAS_LETRA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

export function chaveDia(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

export function deChave(chave: string): Date {
  const [y, m, d] = chave.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function inicioDoDia(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function somarDias(d: Date, dias: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + dias)
  return r
}

/** Segunda-feira da semana de `d` (semanas de treino vão de segunda a domingo). */
export function inicioDaSemana(d: Date): Date {
  const dia = inicioDoDia(d)
  const offset = (dia.getDay() + 6) % 7
  return somarDias(dia, -offset)
}

export function diferencaDias(a: Date, b: Date): number {
  return Math.round((inicioDoDia(a).getTime() - inicioDoDia(b).getTime()) / DIA_MS)
}

/** Data da sessão `diaSemana` (0 = domingo) dentro da semana que começa em `segunda`. */
export function dataNaSemana(segunda: Date, diaSemana: number): Date {
  return somarDias(segunda, (diaSemana + 6) % 7)
}

export function mesmoDia(a: Date, b: Date): boolean {
  return chaveDia(a) === chaveDia(b)
}

export function formatarDataLonga(d: Date): string {
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
}

export function formatarDataCurta(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
}

export function nomeDoMes(d: Date): string {
  const s = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
