// Porta de acesso aos dados do usuário. As telas e o estado global só falam com esta interface:
// hoje ela é implementada sobre o localStorage; a conta com banco de dados será outra implementação.
//
// É síncrona de propósito (leitura vem de um cache em memória), o que a torna compatível com
// `useSyncExternalStore`. Uma implementação com rede carrega o cache ao entrar e grava em segundo plano.

import type { DadosDoApp, NomeEntidade } from './entidades'

export interface Repositorio {
  /** Valor atual. A mesma referência é devolvida enquanto o dado não mudar. */
  obter<N extends NomeEntidade>(nome: N): DadosDoApp[N]
  gravar<N extends NomeEntidade>(nome: N, valor: DadosDoApp[N]): void
  /** Grava várias entidades de uma vez e avisa os assinantes uma única vez (importação de backup). */
  gravarVarias(dados: Partial<DadosDoApp>): void
  /** Avisa quando qualquer dado muda, nesta aba ou em outra. Devolve a função que cancela. */
  assinar(ouvinte: () => void): () => void
}
