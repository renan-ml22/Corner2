import type { Page, Route } from '@playwright/test'
import type { DadosDoAluno } from '../lib/cornerman/aluno-dados'
import type { StatusDeTreino } from '../lib/cornerman/status-treino'

// A API /api/cornerman/alunos simulada em memória: os testes de navegador das telas do treinador nunca falam com o banco.
// Imita as respostas reais (veja app/api/cornerman/alunos): limite de 20 ativas, 404 igual para id que não existe,
// ordem (ativos primeiro, por nome), 409 ao reabrir com 20 ativas, e o convite (gerar, cancelar, status "convidado",
// encerrar uma ficha com conta limpa o vínculo, mudar status de ficha convidada é recusado), o status de treino na lista
// e os dados do aluno com conta (GET /alunos/<id>/dados, 409 sem vínculo).

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
const VALIDADE_DO_CONVITE = '2026-10-28T12:00:00.000Z' // 14 dias depois da data fixa dos testes

export const ficha = (nome: string, extra: Partial<FichaSimulada> = {}): FichaSimulada => ({
  id: novoId(), nome, email: null, telefone: null, nivel: null, estilo: null, notas: '', foto: '', status: 'ativo', comConta: false, criadoEm: AGORA, atualizadoEm: AGORA, ...extra,
})

export const SEM_TREINO: StatusDeTreino = { cor: 'cinza', dias: null }

export const dadosVazios: DadosDoAluno = { nivel: null, foto: '', estilo: null, plano: null, treinos: [] }

export const fichas = (n: number): FichaSimulada[] => Array.from({ length: n }, (_, i) => ficha(`Aluno ${String(i + 1).padStart(2, '0')}`))

export interface PedidoRegistrado { metodo: string; caminho: string; corpo: unknown }

export interface AlunosSimulados {
  fichas: FichaSimulada[]
  pedidos: PedidoRegistrado[]
  /** Convites pendentes por id de ficha (só a validade: o servidor real também não guarda o token). */
  convites: Map<string, { expiraEm: string }>
  /** Os links gerados, na ordem. */
  links: string[]
  /** Só os pedidos que mudam algo (POST, PATCH e DELETE). */
  escritas: () => PedidoRegistrado[]
}

const LIMITE = 20
const erro = (rota: Route, status: number, codigo: string, mensagem: string) => rota.fulfill({ status, json: { erro: mensagem, codigo } })
const naoEncontrado = (rota: Route) => erro(rota, 404, 'nao_encontrado', 'Aluno não encontrado.')
const semAcento = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '')
const ativas = (lista: FichaSimulada[], exceto?: string) => lista.filter(f => f.status !== 'encerrado' && f.id !== exceto).length
const MSG_LIMITE = 'Você já tem 20 alunos. Encerre ou apague uma ficha para cadastrar outro.'

export async function simularAlunos(
  pagina: Page,
  iniciais: FichaSimulada[] = [],
  opcoes: {
    atrasoMs?: number; falhaDeRede?: boolean; falhaNaListagem?: boolean; falhaNosDados?: boolean
    /** Status de treino por id de ficha (o que não está aqui é cinza). */
    status?: Record<string, StatusDeTreino>
    /** Dados do aluno por id de ficha (o que não está aqui vem vazio). */
    dados?: Record<string, DadosDoAluno>
  } = {},
): Promise<AlunosSimulados> {
  const estado: AlunosSimulados = {
    fichas: iniciais.map(f => ({ ...f })),
    pedidos: [],
    convites: new Map(),
    links: [],
    escritas: () => estado.pedidos.filter(p => p.metodo !== 'GET'),
  }
  // Fichas que já nascem convidadas têm convite pendente.
  for (const f of estado.fichas) if (f.status === 'convidado') estado.convites.set(f.id, { expiraEm: VALIDADE_DO_CONVITE })
  let geradas = 0

  await pagina.route(/\/api\/cornerman\/alunos(\/[^/?]*)?(\/(?:convite|dados))?(\?.*)?$/, async (rota: Route) => {
    const req = rota.request()
    const url = new URL(req.url())
    const [, , , , id = null, sub = null] = url.pathname.split('/') // '', 'api', 'cornerman', 'alunos', id, 'convite'
    const corpo = ['POST', 'PATCH'].includes(req.method()) && req.postData() ? req.postDataJSON() : null
    estado.pedidos.push({ metodo: req.method(), caminho: url.pathname, corpo })

    if (opcoes.atrasoMs) await new Promise(r => setTimeout(r, opcoes.atrasoMs))
    if (opcoes.falhaDeRede) return rota.abort('failed')

    // Lista e criação
    if (id === null) {
      if (req.method() === 'GET') {
        if (opcoes.falhaNaListagem) return erro(rota, 502, 'falha_no_banco', 'Não foi possível falar com o banco de dados agora. Tente novamente em instantes.')
        const ordenar = (a: FichaSimulada, b: FichaSimulada) => semAcento(a.nome).localeCompare(semAcento(b.nome), 'pt-BR', { sensitivity: 'base' })
        const lista = [...estado.fichas.filter(f => f.status !== 'encerrado').sort(ordenar), ...estado.fichas.filter(f => f.status === 'encerrado').sort(ordenar)]
        return rota.fulfill({ status: 200, json: { alunos: lista.map(f => ({ ...f, treino: opcoes.status?.[f.id] ?? SEM_TREINO })), ativos: ativas(estado.fichas), limite: LIMITE } })
      }
      if (req.method() === 'POST') {
        const dados = corpo as Partial<FichaSimulada>
        if (!dados?.nome?.trim()) return erro(rota, 400, 'dado_invalido', 'O nome precisa ter de 1 a 80 caracteres.')
        if (ativas(estado.fichas) >= LIMITE) return erro(rota, 409, 'limite_de_alunos', MSG_LIMITE)
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

    // Os dados do aluno com conta
    if (sub === 'dados') {
      if (req.method() !== 'GET') return erro(rota, 405, 'metodo', 'Método não permitido.')
      if (!atual.comConta || atual.status !== 'ativo') return erro(rota, 409, 'sem_vinculo', 'Este aluno ainda não tem conta vinculada.')
      if (opcoes.falhaNosDados) return erro(rota, 502, 'falha_no_banco', 'Não foi possível falar com o banco de dados agora. Tente novamente em instantes.')
      return rota.fulfill({ status: 200, json: { dados: opcoes.dados?.[atual.id] ?? dadosVazios } })
    }

    // O convite dela
    if (sub === 'convite') {
      if (req.method() === 'POST') {
        if (atual.comConta) return erro(rota, 409, 'nao_convidavel', 'Esta ficha já está vinculada a uma conta.')
        if (atual.status === 'encerrado' && ativas(estado.fichas) >= LIMITE) return erro(rota, 409, 'limite_de_alunos', MSG_LIMITE)
        const token = `Tk${String(++geradas).padStart(41, 'x')}` // 43 caracteres base64url
        const link = `http://localhost:3100/convite/${token}`
        estado.links.push(link)
        estado.convites.set(atual.id, { expiraEm: VALIDADE_DO_CONVITE })
        atual.status = 'convidado'
        return rota.fulfill({ status: 201, json: { link, expiraEm: VALIDADE_DO_CONVITE } })
      }
      if (req.method() === 'DELETE') {
        if (atual.status !== 'convidado') return naoEncontrado(rota)
        estado.convites.delete(atual.id)
        atual.status = 'ativo'
        return rota.fulfill({ status: 200, json: { ok: true } })
      }
      return erro(rota, 405, 'metodo', 'Método não permitido.')
    }

    if (req.method() === 'GET') return rota.fulfill({ status: 200, json: { aluno: atual, convite: atual.comConta ? null : estado.convites.get(atual.id) ?? null } })
    if (req.method() === 'DELETE') {
      estado.fichas = estado.fichas.filter(f => f.id !== id)
      estado.convites.delete(id)
      return rota.fulfill({ status: 200, json: { ok: true } })
    }
    if (req.method() === 'PATCH') {
      const mudanca = corpo as Partial<FichaSimulada>
      if (mudanca.status !== undefined && atual.status === 'convidado') {
        return erro(rota, 409, 'convite_pendente', 'Cancele o convite antes de mudar o status da ficha.')
      }
      if (mudanca.status === 'ativo' && atual.status === 'encerrado' && ativas(estado.fichas) >= LIMITE) {
        return erro(rota, 409, 'limite_de_alunos', MSG_LIMITE)
      }
      if (mudanca.nome !== undefined && !mudanca.nome.trim()) return erro(rota, 400, 'dado_invalido', 'O nome precisa ter de 1 a 80 caracteres.')
      Object.assign(atual, mudanca, { atualizadoEm: '2026-10-14T12:05:00.000Z' })
      if (mudanca.status === 'encerrado') atual.comConta = false // encerrar desfaz o vínculo; reabrir não o restaura
      return rota.fulfill({ status: 200, json: { aluno: atual } })
    }
    return erro(rota, 405, 'metodo', 'Método não permitido.')
  })

  return estado
}
