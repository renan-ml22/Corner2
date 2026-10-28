// O selo "Sugerido pelo seu treinador" no plano do aluno. Puro: compara o plano ativo com a última sugestão aceita.

import { chaveDia, inicioDaSemana } from '@/lib/datas'
import type { PlanoAtivo } from '@/lib/tipos'
import type { SugestaoParaOAluno } from './sugestao'

/**
 * O primeiro nome do treinador, se o plano ativo é o da última sugestão aceita neste vínculo e foi escolhido na semana da
 * aceitação ou depois (o plano começa sempre numa segunda). Senão, `null`.
 * Limite conhecido: quem escolhe o MESMO plano outra vez depois de aceitar continua vendo o selo.
 */
export function treinadorDoPlano(ativo: PlanoAtivo | null, aceita: SugestaoParaOAluno | null): string | null {
  if (!ativo || !aceita || aceita.planoId !== ativo.planoId || !aceita.respondidaEm) return null
  const resposta = new Date(aceita.respondidaEm)
  if (Number.isNaN(resposta.getTime())) return null
  return ativo.inicio >= chaveDia(inicioDaSemana(resposta)) ? aceita.treinador : null
}
