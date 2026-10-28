import type { Page, Route } from '@playwright/test'
import type { SugestaoParaOAluno } from '../lib/cornerman/sugestao'

// A rota do aluno /api/sugestao-do-treinador simulada em memória: os testes de navegador nunca falam com o banco.
// Imita as respostas reais (veja app/api/sugestao-do-treinador): GET devolve a pendente e a última aceita; aceitar e recusar
// só valem para a sugestão pendente (qualquer outra: 404 igual).

export const sugestaoDeExemplo = (extra: Partial<SugestaoParaOAluno> = {}): SugestaoParaOAluno => ({
  id: '9d1c2b3a-4e5f-4a6b-8c7d-0e1f2a3b4c5d', planoId: 'fundamentos', planoNome: 'Fundamentos', mensagem: '', treinador: 'Marcos',
  criadaEm: '2026-10-28T12:00:00.000Z', respondidaEm: null, ...extra,
})

export interface PedidoDaSugestao { metodo: string; caminho: string }

export interface SugestaoSimulada {
  pendente: SugestaoParaOAluno | null
  aceita: SugestaoParaOAluno | null
  pedidos: PedidoDaSugestao[]
  /** Só os que mudam algo (aceitar e recusar). */
  escritas: () => PedidoDaSugestao[]
}

interface Opcoes {
  pendente?: SugestaoParaOAluno | null
  aceita?: SugestaoParaOAluno | null
  /** Resposta de erro para aceitar e recusar (ex.: 404 de sugestão já respondida). */
  falhaAoResponder?: { status: number; json: unknown }
  falhaNaConsulta?: boolean
  atrasoMs?: number
}

export async function simularSugestaoDoTreinador(pagina: Page, opcoes: Opcoes = {}): Promise<SugestaoSimulada> {
  const estado: SugestaoSimulada = {
    pendente: opcoes.pendente ?? null,
    aceita: opcoes.aceita ?? null,
    pedidos: [],
    escritas: () => estado.pedidos.filter(p => p.metodo !== 'GET'),
  }

  await pagina.route(/\/api\/sugestao-do-treinador(\/[^/?]+\/(aceitar|recusar))?(\?.*)?$/, async (rota: Route) => {
    const req = rota.request()
    const caminho = new URL(req.url()).pathname
    estado.pedidos.push({ metodo: req.method(), caminho })
    if (opcoes.atrasoMs) await new Promise(r => setTimeout(r, opcoes.atrasoMs))

    if (req.method() === 'GET') {
      if (opcoes.falhaNaConsulta) return rota.fulfill({ status: 502, json: { erro: 'Falha.', codigo: 'falha_no_banco' } })
      return rota.fulfill({ status: 200, json: { pendente: estado.pendente, aceita: estado.aceita } })
    }

    const id = caminho.split('/')[3]
    if (opcoes.falhaAoResponder) return rota.fulfill(opcoes.falhaAoResponder)
    if (!estado.pendente || estado.pendente.id !== id) {
      return rota.fulfill({ status: 404, json: { erro: 'Sugestão não encontrada ou já respondida.', codigo: 'nao_encontrado' } })
    }
    if (caminho.endsWith('/aceitar')) estado.aceita = { ...estado.pendente, respondidaEm: new Date().toISOString() }
    estado.pendente = null
    return rota.fulfill({ status: 200, json: { ok: true } })
  })

  return estado
}
