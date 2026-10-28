import type { Page, Route } from '@playwright/test'
import type { DadosDoAluno } from '../lib/cornerman/aluno-dados'
import { ehPlanoSugerivel, nomeDoPlanoSugerido, type SugestaoDaFicha } from '../lib/cornerman/sugestao'
import type { StatusDeTreino } from '../lib/cornerman/status-treino'

// A API /api/cornerman/alunos simulada em memória: os testes de navegador das telas do treinador nunca falam com o banco.
// Imita as respostas reais (veja app/api/cornerman/alunos): limite de 20 ativas, 404 igual para id que não existe,
// ordem (ativos primeiro, por nome), 409 ao reabrir com 20 ativas, e o convite (gerar, cancelar, status "convidado",
// encerrar uma ficha com conta limpa o vínculo, mudar status de ficha convidada é recusado), o status de treino na lista
// os dados do aluno com conta (GET /alunos/<id>/dados, 409 sem vínculo), as sugestões de plano (GET e POST /alunos/<id>/sugestoes:
// uma pendente por aluno com conta, ficha sem conta só registra, ficha encerrada 409) e o selo da aba (GET /alunos/selo).

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
  /** Histórico de sugestões por id de ficha, da mais nova para a mais antiga. */
  sugestoes: Map<string, SugestaoDaFicha[]>
  /** Quantas vezes o selo da aba foi consultado (fora de `pedidos`, porque toda tela consulta). */
  consultasDoSelo: number
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
    /** O número do selo vermelho da aba "Alunos" (padrão 0). */
    vermelhos?: number
    falhaNoSelo?: boolean
    /** Histórico de sugestões por id de ficha. */
    sugestoes?: Record<string, SugestaoDaFicha[]>
    falhaNasSugestoes?: boolean
  } = {},
): Promise<AlunosSimulados> {
  const estado: AlunosSimulados = {
    fichas: iniciais.map(f => ({ ...f })),
    pedidos: [],
    convites: new Map(),
    links: [],
    sugestoes: new Map(Object.entries(opcoes.sugestoes ?? {}).map(([id, lista]) => [id, lista.map(s => ({ ...s }))])),
    consultasDoSelo: 0,
    escritas: () => estado.pedidos.filter(p => p.metodo !== 'GET'),
  }
  // Fichas que já nascem convidadas têm convite pendente.
  for (const f of estado.fichas) if (f.status === 'convidado') estado.convites.set(f.id, { expiraEm: VALIDADE_DO_CONVITE })
  let geradas = 0

  await pagina.route(/\/api\/cornerman\/alunos(\/[^/?]*)?(\/(?:convite|dados|sugestoes))?(\?.*)?$/, async (rota: Route) => {
    const req = rota.request()
    const url = new URL(req.url())
    const [, , , , id = null, sub = null] = url.pathname.split('/') // '', 'api', 'cornerman', 'alunos', id, 'convite'
    const corpo = ['POST', 'PATCH'].includes(req.method()) && req.postData() ? req.postDataJSON() : null

    // O selo da aba é consultado em toda tela: não entra na lista de pedidos dos testes.
    if (id === 'selo') {
      estado.consultasDoSelo++
      if (opcoes.falhaNoSelo) return erro(rota, 502, 'falha_no_banco', 'Não foi possível falar com o banco de dados agora. Tente novamente em instantes.')
      return rota.fulfill({ status: 200, json: { vermelhos: opcoes.vermelhos ?? 0 } })
    }
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

    // As sugestões de plano dela
    if (sub === 'sugestoes') {
      if (opcoes.falhaNasSugestoes) return erro(rota, 502, 'falha_no_banco', 'Não foi possível falar com o banco de dados agora. Tente novamente em instantes.')
      const historico = estado.sugestoes.get(atual.id) ?? []
      if (req.method() === 'GET') return rota.fulfill({ status: 200, json: { sugestoes: historico } })
      if (req.method() !== 'POST') return erro(rota, 405, 'metodo', 'Método não permitido.')
      const nova = corpo as { planoId?: unknown; mensagem?: unknown }
      if (!ehPlanoSugerivel(nova?.planoId)) return erro(rota, 400, 'dado_invalido', 'Escolha um plano da lista.')
      if (atual.status === 'encerrado') return erro(rota, 409, 'ficha_encerrada', 'Esta ficha está encerrada. Reabra a ficha para sugerir um plano.')
      const comConta = atual.comConta && atual.status === 'ativo'
      const trocadas: SugestaoDaFicha[] = comConta ? historico.map(s => (s.status === 'pendente' ? { ...s, status: 'substituida' as const, respondidaEm: '2026-10-28T12:30:00.000Z' } : s)) : historico
      const criada: SugestaoDaFicha = {
        id: `sug-${historico.length + 1}`, planoId: nova.planoId, planoNome: nomeDoPlanoSugerido(nova.planoId),
        mensagem: typeof nova.mensagem === 'string' ? nova.mensagem.trim() : '', status: comConta ? 'pendente' : 'registrada',
        criadaEm: '2026-10-28T12:00:00.000Z', respondidaEm: null,
      }
      estado.sugestoes.set(atual.id, [criada, ...trocadas])
      return rota.fulfill({ status: 201, json: { status: criada.status, sugestoes: estado.sugestoes.get(atual.id) } })
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
