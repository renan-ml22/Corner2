// Liga uma entidade do repositório ao formato que o `useSyncExternalStore` do React espera.
// Fica fora do hook para poder ser testado sem navegador.

import { ENTIDADES, type DadosDoApp, type NomeEntidade } from './entidades'
import type { Repositorio } from './repositorio'

export interface Fonte<T> {
  assinar: (ouvinte: () => void) => () => void
  /** Snapshot do cliente. */
  obter: () => T
  /** Snapshot do servidor e da hidratação: sempre o valor inicial (evita erro de hidratação). */
  obterNoServidor: () => T
  /** Aceita o valor novo ou uma função do valor mais recente (atualizações em sequência não se perdem). */
  definir: (novo: T | ((anterior: T) => T)) => void
}

export function criarFonte<N extends NomeEntidade>(repo: Repositorio, nome: N): Fonte<DadosDoApp[N]> {
  type T = DadosDoApp[N]
  return {
    assinar: repo.assinar,
    obter: () => repo.obter(nome),
    obterNoServidor: () => ENTIDADES[nome].inicial as T,
    definir: novo => repo.gravar(nome, typeof novo === 'function' ? (novo as (anterior: T) => T)(repo.obter(nome)) : novo),
  }
}
