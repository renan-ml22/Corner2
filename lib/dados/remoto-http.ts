// Fala com a rota /api/dados (veja app/api/dados/route.ts). Qualquer resposta que não seja a esperada vira erro,
// e o repositório trata erro como "não deu para confirmar agora": os dados do aparelho nunca são tocados por isso.

import type { DadosDoApp } from './entidades'
import type { RemotoLike } from './repositorio-sincronizado'

type Buscar = (entrada: string, init?: RequestInit) => Promise<Response>

const URL_DADOS = '/api/dados'

export function criarRemotoHttp(buscar: Buscar = (e, i) => fetch(e, i)): RemotoLike {
  return {
    async carregar() {
      const r = await buscar(URL_DADOS, { cache: 'no-store' })
      if (!r.ok) throw new Error(`Falha ao carregar a conta (${r.status})`)
      const corpo: unknown = await r.json()
      if (typeof corpo === 'object' && corpo !== null) {
        const { ativo, dados } = corpo as { ativo?: unknown; dados?: unknown }
        if (ativo === false) return null // conta na nuvem desligada neste ambiente: o app segue só com o aparelho
        if (ativo === true && typeof dados === 'object' && dados !== null && !Array.isArray(dados)) return dados as Partial<DadosDoApp>
      }
      throw new Error('Resposta inesperada ao carregar a conta')
    },

    async enviar(dados, opcoes) {
      const r = await buscar(URL_DADOS, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(dados),
        // Envio ao fechar a página: o navegador deixa a requisição terminar mesmo depois que a aba some (limite de ~64 KB).
        ...(opcoes?.keepalive ? { keepalive: true } : {}),
      })
      if (!r.ok) throw new Error(`Falha ao enviar para a conta (${r.status})`)
    },
  }
}
