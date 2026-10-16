// Tabela das coisas que o Corner guarda: nome, valor inicial e regras de cada uma.
// O repositório, o backup e a migração leem esta tabela; nenhum deles conhece as entidades por conta própria.

import type {
  AjusteDoDia, Checkin, ChecklistDoDia, Configuracoes, Lesao, PesoRegistro, PlanoAtivo, Reagendamentos, WorkoutEntry,
} from '@/lib/tipos'
import {
  isAjuste, isArrayDe, isAssinaturaGuardada, isCheckin, isChecklist, isConfigParcial, isLembrete, isLesao, isPesoRegistro, isPlanoAtivo, isReag,
  isWorkoutEntry, limparConfig, limparLista, type AssinaturaGuardada,
} from './contrato'

export interface DadosDoApp {
  historico: WorkoutEntry[]
  plano: PlanoAtivo | null
  config: Partial<Configuracoes>
  checklist: ChecklistDoDia
  checkins: Checkin[]
  lesoes: Lesao[]
  pesos: PesoRegistro[]
  ajuste: AjusteDoDia
  reag: Reagendamentos
  /** Data (YYYY-MM-DD) do último lembrete diário disparado */
  lembrete: string
  /** Último estado da assinatura informado pelo servidor (cópia local; quem manda é o Stripe) */
  assinatura: AssinaturaGuardada | null
}

export type NomeEntidade = keyof DadosDoApp

export interface Entidade<T> {
  /** Valor quando nada foi salvo ou o salvo é irrecuperável. Sempre a mesma referência (snapshot estável). */
  inicial: T
  validar: (v: unknown) => v is T
  /** Leitura tolerante: aproveita o que for válido de um valor parcialmente ruim. `null` = irrecuperável. */
  limpar?: (v: unknown) => T | null
  /** Mensagem de erro quando esta entidade vem inválida num backup. Só entidades com mensagem entram no backup. */
  erroBackup?: string
}

const LISTA_VAZIA: never[] = []

export const ENTIDADES: { [N in NomeEntidade]: Entidade<DadosDoApp[N]> } = {
  historico: { inicial: LISTA_VAZIA, validar: isArrayDe(isWorkoutEntry), limpar: limparLista(isWorkoutEntry), erroBackup: 'O histórico do backup está corrompido.' },
  plano: { inicial: null, validar: isPlanoAtivo, erroBackup: 'O plano do backup é inválido.' },
  config: { inicial: {}, validar: isConfigParcial, limpar: limparConfig, erroBackup: 'As configurações do backup são inválidas.' },
  checklist: { inicial: { data: '', itens: {} }, validar: isChecklist },
  checkins: { inicial: LISTA_VAZIA, validar: isArrayDe(isCheckin), limpar: limparLista(isCheckin), erroBackup: 'Os check-ins do backup estão corrompidos.' },
  lesoes: { inicial: LISTA_VAZIA, validar: isArrayDe(isLesao), limpar: limparLista(isLesao), erroBackup: 'As lesões do backup estão corrompidas.' },
  pesos: { inicial: LISTA_VAZIA, validar: isArrayDe(isPesoRegistro), limpar: limparLista(isPesoRegistro), erroBackup: 'Os registros de peso do backup estão corrompidos.' },
  ajuste: { inicial: { data: '', aplicado: false }, validar: isAjuste },
  reag: { inicial: {}, validar: isReag, erroBackup: 'Os reagendamentos do backup são inválidos.' },
  lembrete: { inicial: '', validar: isLembrete },
  assinatura: { inicial: null, validar: isAssinaturaGuardada },
}

export const NOMES_ENTIDADES = Object.keys(ENTIDADES) as NomeEntidade[]

/** O que vai para o arquivo de backup (o que é só do dia, como checklist e ajuste, fica de fora). */
export const NOMES_NO_BACKUP = NOMES_ENTIDADES.filter(n => ENTIDADES[n].erroBackup !== undefined)
