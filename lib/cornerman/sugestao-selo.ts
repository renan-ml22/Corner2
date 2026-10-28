// O selo "Sugerido pelo seu treinador" no plano do aluno. Puro: compara o plano ativo com a última sugestão aceita.

import type { PlanoAtivo } from '@/lib/tipos'
import type { SugestaoParaOAluno } from './sugestao'

/**
 * O primeiro nome do treinador, se o plano ativo é o da última sugestão aceita neste vínculo; senão, `null`.
 * Limites conhecidos: quem aceita o plano que já usava também ganha o selo (de propósito: é o plano que o treinador
 * sugeriu), e quem escolher o MESMO plano outra vez, por conta própria, depois de aceitar continua vendo o selo.
 */
export function treinadorDoPlano(ativo: PlanoAtivo | null, aceita: SugestaoParaOAluno | null): string | null {
  if (!ativo || !aceita || !aceita.respondidaEm || aceita.planoId !== ativo.planoId) return null
  return aceita.treinador
}
