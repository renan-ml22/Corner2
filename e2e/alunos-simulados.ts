import type { Page, Route } from '@playwright/test'

// A API /api/cornerman/alunos simulada em memória: os testes de navegador das telas do treinador nunca falam com o banco.
// Imita as respostas reais (veja app/api/cornerman/alunos): limite de 20 ativas, 404 igual para id que não existe,
// ordem (ativos primeiro, por nome), 409 ao reabrir com 20 ativas.

export interface FichaSimulada {
  id: string
  nome: string
  email: string | null
  telefone: string | null
  nivel: 'iniciante' | 'intermediario' | 'avancado' | null
  estilo: string | null
  notas: string
  foto: string
  status: 'ativo' | 'convidado' | 'encerrado'
  comConta: boolean
  criadoEm: string
  atualizadoEm: string
}

let contador = 0
const novoId = () => `00000000-0000-4000-8000-${String(++contador).padStart(12, '0')}`
const AGORA = '2026-10-14T12:00:00.000Z'

export const ficha = (nome: string, extra: Partial<FichaSimulada> = {}): FichaSimulada => ({
  id: novoId(), nome, email: null, telefone: null, nivel: null, estilo: null, notas: '', foto: '', status: 'ativo', comConta: false, criadoEm: AGORA, atualizadoEm: AGORA, ...extra,
})

export const fichas = (n: number): FichaSimulada[] => Array.from({ length: n }, (_, i) => ficha(`Aluno ${String(i + 1).padStart(2, '0')}`))

export interface PedidoRegistrado { metodo: string; caminho: string; corpo: unknown }

export interface AlunosSimulados {
  fichas: FichaSimulada[]
  pedidos: PedidoRegistrado[]
  /** Só os pedidos que mudam algo (POST, PATCH e DELETE). */
  escritas: () => PedidoRegistrado[]
}

const LIMITE = 20
const erro = (rota: Route, status: number, codigo: string, mensagem: string) => rota.fulfill({ status, json: { erro: mensagem, codigo } })
const naoEncontrado = (rota: Route) => erro(rota, 404, 'nao_encontrado', 'Aluno não encontrado.')
const semAcento = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '')
const ativas = (lista: FichaSimulada[], exceto?: string) => lista.filter(f => f.status !== 'encerrado' && f.id !== exceto).length

export async function simularAlunos(
  pagina: Page,
  iniciais: FichaSimulada[] = [],
  opcoes: { atrasoMs?: number; falhaDeRede?: boolean; falhaNaListagem?: boolean } = {},
): Promise<AlunosSimulados> {
  const estado: AlunosSimulados = { fichas: iniciais.map(f => ({ ...f })), pedidos: [], escritas: () => estado.pedidos.filter(p => p.metodo !== 'GET') }

  await pagina.route(/\/api\/cornerman\/alunos(\/[^/?]*)?(\?.*)?$/, async (rota: Route) => {
    const req = rota.request()
    const url = new URL(req.url())
    const id = url.pathname.split('/')[4] ?? null
    const corpo = ['POST', 'PATCH'].includes(req.method()) ? req.postDataJSON() : null
    estado.pedidos.push({ metodo: req.method(), caminho: url.pathname, corpo })

    if (opcoes.atrasoMs) await new Promise(r => setTimeout(r, opcoes.atrasoMs))
    if (opcoes.falhaDeRede && req.method() !== 'GET') return rota.abort('failed')
    if (opcoes.falhaDeRede && req.method() === 'GET') return rota.abort('failed')

    // Lista e criação
    if (id === null) {
      if (req.method() === 'GET') {
        if (opcoes.falhaNaListagem) return erro(rota, 502, 'falha_no_banco', 'Não foi possível falar com o banco de dados agora. Tente novamente em instantes.')
        const ordenar = (a: FichaSimulada, b: FichaSimulada) => semAcento(a.nome).localeCompare(semAcento(b.nome), 'pt-BR', { sensitivity: 'base' })
        const lista = [...estado.fichas.filter(f => f.status !== 'encerrado').sort(ordenar), ...estado.fichas.filter(f => f.status === 'encerrado').sort(ordenar)]
        return rota.fulfill({ status: 200, json: { alunos: lista, ativos: ativas(estado.fichas), limite: LIMITE } })
      }
      if (req.method() === 'POST') {
        const dados = corpo as Partial<FichaSimulada>
        if (!dados?.nome?.trim()) return erro(rota, 400, 'dado_invalido', 'O nome precisa ter de 1 a 80 caracteres.')
        if (ativas(estado.fichas) >= LIMITE) return erro(rota, 409, 'limite_de_alunos', 'Você já tem 20 alunos. Encerre ou apague uma ficha para cadastrar outro.')
        const nova = ficha(dados.nome.trim(), {
          email: dados.email || null, telefone: dados.telefone || null, nivel: dados.nivel ?? null, estilo: dados.estilo || null, notas: dados.notas ?? '', foto: dados.foto ?? '',
        })
        estado.fichas.push(nova)
        return rota.fulfill({ status: 201, json: { aluno: nova } })
      }
      return erro(rota, 405, 'metodo', 'Método não permitido.')
    }

    // Uma ficha
    const atual = estado.fichas.find(f => f.id === id)
    if (!atual) return naoEncontrado(rota)
    if (req.method() === 'GET') return rota.fulfill({ status: 200, json: { aluno: atual } })
    if (req.method() === 'DELETE') {
      estado.fichas = estado.fichas.filter(f => f.id !== id)
      return rota.fulfill({ status: 200, json: { ok: true } })
    }
    if (req.method() === 'PATCH') {
      const mudanca = corpo as Partial<FichaSimulada>
      if (mudanca.status === 'ativo' && atual.status === 'encerrado' && ativas(estado.fichas) >= LIMITE) {
        return erro(rota, 409, 'limite_de_alunos', 'Você já tem 20 alunos. Encerre ou apague uma ficha para cadastrar outro.')
      }
      if (mudanca.nome !== undefined && !mudanca.nome.trim()) return erro(rota, 400, 'dado_invalido', 'O nome precisa ter de 1 a 80 caracteres.')
      Object.assign(atual, mudanca, { atualizadoEm: '2026-10-14T12:05:00.000Z' })
      return rota.fulfill({ status: 200, json: { aluno: atual } })
    }
    return erro(rota, 405, 'metodo', 'Método não permitido.')
  })

  return estado
}
