// Fusão de dados: usada UMA vez por aparelho, na primeira vez que ele encontra uma conta que já tem dados.
//
// Regra: nunca perder um registro. Listas viram a união (no mesmo id ou dia vale a versão da conta); o que só pode
// ter um valor (plano, estado do dia) fica com o da conta. O original do aparelho ainda vai para a quarentena
// (quem chama guarda), então nada é apagado em silêncio.

import type { DadosDoApp, NomeEntidade } from './entidades'

/** Comparação profunda que ignora a ordem das chaves dos objetos (a ordem dentro de listas conta). */
export function iguais(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => iguais(x, b[i]))
  const ra = a as Record<string, unknown>
  const rb = b as Record<string, unknown>
  const chaves = Object.keys(ra)
  return chaves.length === Object.keys(rb).length && chaves.every(k => Object.hasOwn(rb, k) && iguais(ra[k], rb[k]))
}

/** Itens da conta primeiro; depois os do aparelho que a conta ainda não tem. */
function uniao<T>(servidor: T[], local: T[], chave: (item: T) => string): T[] {
  const vistos = new Set(servidor.map(chave))
  return [...servidor, ...local.filter(item => !vistos.has(chave(item)))]
}

export function fundir<N extends NomeEntidade>(nome: N, local: DadosDoApp[N], servidor: DadosDoApp[N]): DadosDoApp[N] {
  const resultado = ((): unknown => {
    switch (nome) {
      case 'historico': {
        const l = local as DadosDoApp['historico'], s = servidor as DadosDoApp['historico']
        return uniao(s, l, x => x.id).sort((a, b) => b.data.localeCompare(a.data)) // o app mostra o mais novo primeiro
      }
      case 'pesos': {
        const l = local as DadosDoApp['pesos'], s = servidor as DadosDoApp['pesos']
        return uniao(s, l, x => x.data).sort((a, b) => a.data.localeCompare(b.data)) // um peso por dia, em ordem de data
      }
      case 'checkins': {
        const l = local as DadosDoApp['checkins'], s = servidor as DadosDoApp['checkins']
        return uniao(s, l, x => x.data).sort((a, b) => b.data.localeCompare(a.data)).slice(0, 120) // o app guarda no máximo 120
      }
      case 'lesoes': {
        const l = local as DadosDoApp['lesoes'], s = servidor as DadosDoApp['lesoes']
        return uniao(s, l, x => x.id)
      }
      case 'quiz': {
        // Nenhuma tela apaga o quiz: vazio na conta é "nunca fez", e o do aparelho não pode se perder.
        const l = local as DadosDoApp['quiz'], s = servidor as DadosDoApp['quiz']
        return s === '' ? l : s
      }
      case 'config':
      case 'reag':
        return { ...(local as object), ...(servidor as object) }
      default:
        return servidor // plano, checklist, ajuste (só têm um valor): vale o da conta
    }
  })()
  return resultado as DadosDoApp[N]
}
