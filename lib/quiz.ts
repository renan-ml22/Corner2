// Pontuação do quiz de estilo. Funções puras: sem tela, sem rede, sem relógio.
//
// Cada resposta soma pontos em categorias de estilo. A compatibilidade com um atleta olha só para as categorias que são
// pontos fortes dele, e é a média de duas razões:
//   - bruto / teto: quanto da pontuação MÁXIMA possível para aquele atleta a pessoa alcançou (justo com atletas cujos
//     pontos fortes quase nenhuma resposta pontua, como Robson Conceição e Teófilo Stevenson);
//   - bruto / total da pessoa: quanto das respostas da pessoa aponta para o estilo do atleta (evita que quem pontuou
//     em tudo combine com todo mundo).
// Empate: mais pontos brutos primeiro; depois a ordem de ATLETAS.
import { ATLETAS, type Atleta, type TagDeEstilo } from '@/data/atletas'
import { PERGUNTAS } from '@/data/quiz'

export type Pontos = Partial<Record<TagDeEstilo, number>>

export interface Compatibilidade {
  atleta: Atleta
  /** Inteiro de 0 a 100. */
  percentual: number
}

export interface ResultadoDoQuiz {
  primeiro: Compatibilidade
  segundo: Compatibilidade
}

/** Uma resposta (índice da opção) para cada pergunta, nenhuma faltando e nenhuma fora do intervalo. */
export function respostasValidas(respostas: unknown): respostas is number[] {
  return (
    Array.isArray(respostas) &&
    respostas.length === PERGUNTAS.length &&
    respostas.every((r, i) => Number.isInteger(r) && r >= 0 && r < PERGUNTAS[i].opcoes.length)
  )
}

/** Soma dos pontos das respostas, por categoria. Respostas inválidas são ignoradas. */
export function pontosDasRespostas(respostas: readonly number[]): Pontos {
  const total: Pontos = {}
  PERGUNTAS.forEach((pergunta, i) => {
    const opcao = pergunta.opcoes[respostas[i]]
    if (!opcao) return
    for (const [tag, valor] of Object.entries(opcao.pontos) as [TagDeEstilo, number][]) total[tag] = (total[tag] ?? 0) + valor
  })
  return total
}

const pontosNosFortes = (pontos: Pontos, atleta: Atleta) => atleta.pontosFortes.reduce((soma, tag) => soma + (pontos[tag] ?? 0), 0)

/** O máximo de pontos que as respostas podem dar ao atleta: o melhor caso em cada pergunta, somado. */
export function tetoDoAtleta(atleta: Atleta): number {
  return PERGUNTAS.reduce((soma, pergunta) => soma + Math.max(...pergunta.opcoes.map(o => pontosNosFortes(o.pontos, atleta))), 0)
}

/** Os dez atletas, do mais para o menos compatível com as respostas. Lista vazia se as respostas forem inválidas. */
export function compatibilidades(respostas: readonly number[]): Compatibilidade[] {
  if (!respostasValidas(respostas)) return []
  const pontos = pontosDasRespostas(respostas)
  const totalDaPessoa = Object.values(pontos).reduce((a, b) => a + b, 0)

  return ATLETAS.map((atleta, ordem) => {
    const bruto = pontosNosFortes(pontos, atleta)
    const teto = tetoDoAtleta(atleta)
    const razao = (teto > 0 ? bruto / teto : 0) / 2 + (totalDaPessoa > 0 ? bruto / totalDaPessoa : 0) / 2
    // Arredondar evita que um erro de ponto flutuante desempate o que é um empate de verdade.
    return { atleta, bruto, ordem, razao: Math.round(razao * 1e9) / 1e9 }
  })
    .sort((a, b) => b.razao - a.razao || b.bruto - a.bruto || a.ordem - b.ordem)
    .map(({ atleta, razao }) => ({ atleta, percentual: Math.round(razao * 100) }))
}

/** Os dois atletas mais compatíveis, ou null se as respostas forem inválidas. */
export function resultadoDoQuiz(respostas: readonly number[]): ResultadoDoQuiz | null {
  const [primeiro, segundo] = compatibilidades(respostas)
  return primeiro && segundo ? { primeiro, segundo } : null
}

// ── Respostas no endereço ────────────────────────────────────
// O resultado vive em /quiz?r=01203 (um dígito por pergunta): o botão Voltar do navegador devolve ao resultado
// e o endereço pode ser compartilhado. Nada disso sai do aparelho: a pontuação é calculada na tela.

export const serializarRespostas = (respostas: readonly number[]): string => respostas.join('')

/** Lê o `r` do endereço. Qualquer coisa que não seja exatamente uma resposta válida por pergunta vira `null`. */
export function respostasDaUrl(valor: string | string[] | undefined): number[] | null {
  if (typeof valor !== 'string' || !/^\d+$/.test(valor)) return null
  const respostas = [...valor].map(Number)
  return respostasValidas(respostas) ? respostas : null
}
