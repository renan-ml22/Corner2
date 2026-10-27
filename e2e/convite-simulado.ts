import type { Page, Route } from '@playwright/test'

// As rotas do convite (do lado do aluno) e "Meu treinador" simuladas: os testes de navegador nunca falam com o banco.
// Imitam as respostas reais de app/api/convite e app/api/meu-treinador.

export const TOKEN_DO_CONVITE = 'Zq9-_Kd3'.repeat(5) + 'abc' // 43 caracteres base64url

export interface PedidoDoConvite { metodo: string; caminho: string }

export interface ConviteSimulado {
  pedidos: PedidoDoConvite[]
  /** Os que mudam algo. */
  escritas: () => PedidoDoConvite[]
  /** Treinador atual do aluno (para "Meu treinador"); `DELETE` o zera. */
  treinador: { nome: string } | null
}

interface Opcoes {
  /** O convite vale? */
  valido?: boolean
  /** Quem pergunta está logado? (o servidor real responde isto na consulta pública) */
  logado?: boolean
  treinador?: string
  /** Resposta do aceite; o padrão é sucesso com o nome do treinador. */
  aceitar?: { status: number; json: unknown }
  /** Treinador do aluno logo de início (para "Meu treinador"). */
  meuTreinador?: { nome: string } | null
  atrasoMs?: number
  falhaDeRede?: boolean
}

export async function simularConvite(pagina: Page, opcoes: Opcoes = {}): Promise<ConviteSimulado> {
  const { valido = true, logado = true, treinador = 'Marcos', aceitar, atrasoMs, falhaDeRede } = opcoes
  const estado: ConviteSimulado = {
    pedidos: [],
    escritas: () => estado.pedidos.filter(p => p.metodo !== 'GET'),
    treinador: opcoes.meuTreinador ?? null,
  }
  const invalido = (rota: Route) => rota.fulfill({ status: 404, json: { erro: 'Convite inválido ou expirado.', codigo: 'convite_invalido' } })

  await pagina.route(/\/api\/convite\/[^/]+(\/(guardar|aceitar))?(\?.*)?$/, async (rota: Route) => {
    const req = rota.request()
    const caminho = new URL(req.url()).pathname
    estado.pedidos.push({ metodo: req.method(), caminho })
    if (atrasoMs) await new Promise(r => setTimeout(r, atrasoMs))
    if (falhaDeRede && req.method() !== 'GET') return rota.abort('failed')

    if (caminho.endsWith('/guardar')) {
      if (req.method() === 'DELETE') return rota.fulfill({ status: 200, json: { ok: true } })
      return valido ? rota.fulfill({ status: 200, json: { ok: true } }) : invalido(rota)
    }
    if (caminho.endsWith('/aceitar')) {
      if (aceitar) return rota.fulfill({ status: aceitar.status, json: aceitar.json })
      return valido ? rota.fulfill({ status: 200, json: { ok: true, treinador } }) : invalido(rota)
    }
    return rota.fulfill({ status: 200, json: valido ? { valido: true, treinador, logado } : { valido: false, logado } })
  })

  await pagina.route(/\/api\/meu-treinador(\?.*)?$/, async (rota: Route) => {
    const req = rota.request()
    estado.pedidos.push({ metodo: req.method(), caminho: '/api/meu-treinador' })
    if (atrasoMs) await new Promise(r => setTimeout(r, atrasoMs))
    if (falhaDeRede) return rota.abort('failed')
    if (req.method() === 'DELETE') {
      estado.treinador = null
      return rota.fulfill({ status: 200, json: { ok: true } })
    }
    return rota.fulfill({ status: 200, json: { treinador: estado.treinador } })
  })

  return estado
}
