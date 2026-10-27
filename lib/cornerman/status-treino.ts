// Status de treino de um aluno com conta: só os dias de calendário (fuso de São Paulo) desde o último treino.
// Puro: recebe o instante do último treino e o "agora"; não lê relógio nem banco.

export type CorDeStatus = 'verde' | 'amarelo' | 'vermelho' | 'cinza'

export interface StatusDeTreino {
  cor: CorDeStatus
  /** Dias de calendário desde o último treino; `null` quando não há treino. */
  dias: number | null
  /** O banco não conseguiu dizer o último treino: não é o mesmo que "sem treinos". */
  indisponivel?: true
}

export const SEM_DADOS: StatusDeTreino = { cor: 'cinza', dias: null }
export const INDISPONIVEL: StatusDeTreino = { cor: 'cinza', dias: null, indisponivel: true }

const FUSO = 'America/Sao_Paulo'
const DIA_MS = 24 * 60 * 60 * 1000

// `en-CA` escreve a data como YYYY-MM-DD.
const formatoDoDia = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' })

/** O dia de calendário de São Paulo em que o instante cai, como número de dias desde 1970 (para subtrair sem fuso no meio). */
function diaEmSaoPaulo(instante: Date): number {
  const [a, m, d] = formatoDoDia.format(instante).split('-').map(Number)
  return Date.UTC(a, m - 1, d) / DIA_MS
}

/** 0 a 2 dias: verde. 3 a 6: amarelo. 7 ou mais: vermelho. Sem treino (ou data ilegível): cinza. Treino "no futuro" conta como hoje. */
export function statusDeTreino(ultimoTreino: string | null, agora: Date): StatusDeTreino {
  if (ultimoTreino === null) return SEM_DADOS
  const instante = new Date(ultimoTreino)
  if (Number.isNaN(instante.getTime())) return SEM_DADOS

  const dias = Math.max(0, diaEmSaoPaulo(agora) - diaEmSaoPaulo(instante))
  return { cor: dias <= 2 ? 'verde' : dias <= 6 ? 'amarelo' : 'vermelho', dias }
}

export function textoDoStatus(s: StatusDeTreino): string {
  if (s.indisponivel) return 'Status indisponível'
  if (s.dias === null) return 'Sem treinos registrados'
  if (s.dias === 0) return 'Treinou hoje'
  if (s.dias === 1) return 'Treinou ontem'
  return `Treinou há ${s.dias} dias`
}
