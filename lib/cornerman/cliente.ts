// As chamadas que as telas do treinador fazem à API /api/cornerman/alunos (veja app/api/cornerman/alunos).
// Nunca lançam erro: toda falha (rede, servidor, resposta fora do formato) volta como `{ ok: false, … }` com texto para mostrar.

import { isObj } from '@/lib/dados/contrato'
import { isRegType } from '@/lib/tipos'
import type { DadosDoAluno } from './aluno-dados'
import type { DadosDaFicha, FichaDeAluno } from './ficha'
import type { AlunoNaLista } from './servico'
import { STATUS_DA_SUGESTAO, type NovaSugestao, type StatusDaSugestao, type SugestaoDaFicha, type SugestaoParaOAluno, type SugestoesDoAluno } from './sugestao'

export type RespostaDaApi<T> = { ok: true; valor: T } | { ok: false; erro: string; codigo: string; status: number }

export interface ListaDeAlunos { alunos: AlunoNaLista[]; ativos: number; limite: number }

const SEM_CONEXAO = 'Sem conexão. Verifique a internet e tente de novo.'
const ERRO_GENERICO = 'Não foi possível continuar. Tente novamente.'

const falha = (status: number, codigo: string, erro: string): { ok: false; erro: string; codigo: string; status: number } => ({ ok: false, status, codigo, erro })
const respostaInvalida = () => falha(200, 'resposta_invalida', ERRO_GENERICO)

async function chamar(metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE', caminho: string, corpo?: unknown): Promise<{ ok: true; json: unknown } | ReturnType<typeof falha>> {
  try {
    const r = await fetch(caminho, {
      method: metodo,
      credentials: 'same-origin',
      cache: 'no-store',
      ...(corpo === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }),
    })
    const json: unknown = await r.json().catch(() => null)
    if (r.ok) return { ok: true, json }
    // Só o texto e o código que o nosso servidor manda; uma página de erro qualquer vira a mensagem genérica.
    const erro = isObj(json) && typeof json.erro === 'string' ? json.erro : ERRO_GENERICO
    const codigo = isObj(json) && typeof json.codigo === 'string' ? json.codigo : 'erro'
    return falha(r.status, codigo, erro)
  } catch {
    return falha(0, 'sem_conexao', SEM_CONEXAO)
  }
}

const base = '/api/cornerman/alunos'
const doAluno = (id: string) => `${base}/${encodeURIComponent(id)}`

const comoFicha = (json: unknown): FichaDeAluno | null =>
  isObj(json) && isObj(json.aluno) && typeof json.aluno.id === 'string' && typeof json.aluno.nome === 'string' ? (json.aluno as unknown as FichaDeAluno) : null

async function umaFicha(pedido: ReturnType<typeof chamar>): Promise<RespostaDaApi<FichaDeAluno>> {
  const r = await pedido
  if (!r.ok) return r
  const aluno = comoFicha(r.json)
  return aluno ? { ok: true, valor: aluno } : respostaInvalida()
}

export async function listarAlunosNoServidor(): Promise<RespostaDaApi<ListaDeAlunos>> {
  const r = await chamar('GET', base)
  if (!r.ok) return r
  const j = r.json
  if (!isObj(j) || !Array.isArray(j.alunos) || typeof j.ativos !== 'number' || typeof j.limite !== 'number') return respostaInvalida()
  return { ok: true, valor: { alunos: j.alunos as AlunoNaLista[], ativos: j.ativos, limite: j.limite } }
}

export const criarAlunoNoServidor = (dados: Partial<DadosDaFicha>) => umaFicha(chamar('POST', base, dados))
/** A ficha e o convite ainda não usado dela (sem o link: o servidor não guarda o token). */
export interface FichaComConvite { aluno: FichaDeAluno; convite: { expiraEm: string } | null }

export async function lerAlunoNoServidor(id: string): Promise<RespostaDaApi<FichaComConvite>> {
  const r = await chamar('GET', doAluno(id))
  if (!r.ok) return r
  const aluno = comoFicha(r.json)
  if (!aluno) return respostaInvalida()
  const convite = isObj(r.json) && isObj(r.json.convite) && typeof r.json.convite.expiraEm === 'string' ? { expiraEm: r.json.convite.expiraEm } : null
  return { ok: true, valor: { aluno, convite } }
}

/** Gera o link de convite da ficha. O link só vem nesta resposta; o servidor guarda apenas o hash. */
export async function gerarConviteNoServidor(id: string): Promise<RespostaDaApi<{ link: string; expiraEm: string }>> {
  const r = await chamar('POST', `${doAluno(id)}/convite`)
  if (!r.ok) return r
  const j = r.json
  return isObj(j) && typeof j.link === 'string' && typeof j.expiraEm === 'string' ? { ok: true, valor: { link: j.link, expiraEm: j.expiraEm } } : respostaInvalida()
}

// ── O aluno: a página do convite e "Meu treinador" ───────────

const doConvite = (token: string) => `/api/convite/${encodeURIComponent(token)}`

export interface ConsultaDoConvite { valido: boolean; treinador?: string; logado: boolean }

/** O que a página pública do convite precisa saber (vale sem login). */
export async function consultarConviteNoServidor(token: string): Promise<RespostaDaApi<ConsultaDoConvite>> {
  const r = await chamar('GET', doConvite(token))
  if (!r.ok) return r
  const j = r.json
  if (!isObj(j) || typeof j.valido !== 'boolean' || typeof j.logado !== 'boolean') return respostaInvalida()
  if (j.valido && typeof j.treinador !== 'string') return respostaInvalida()
  return { ok: true, valor: { valido: j.valido, logado: j.logado, ...(j.valido ? { treinador: j.treinador as string } : {}) } }
}

/** Guarda o convite num cookie (só se ele vale) para o aluno voltar a ele depois de entrar ou criar a conta. */
export async function guardarConviteNoServidor(token: string): Promise<RespostaDaApi<true>> {
  const r = await chamar('POST', `${doConvite(token)}/guardar`)
  return r.ok ? { ok: true, valor: true } : r
}

/** Apaga o cookie do convite ("agora não", ou convite que não vale mais). */
export async function esquecerConviteNoServidor(token: string): Promise<RespostaDaApi<true>> {
  const r = await chamar('DELETE', `${doConvite(token)}/guardar`)
  return r.ok ? { ok: true, valor: true } : r
}

export async function aceitarConviteNoServidor(token: string): Promise<RespostaDaApi<{ treinador: string }>> {
  const r = await chamar('POST', `${doConvite(token)}/aceitar`)
  if (!r.ok) return r
  return isObj(r.json) && typeof r.json.treinador === 'string' ? { ok: true, valor: { treinador: r.json.treinador } } : respostaInvalida()
}

export async function meuTreinadorNoServidor(): Promise<RespostaDaApi<{ treinador: { nome: string } | null }>> {
  const r = await chamar('GET', '/api/meu-treinador')
  if (!r.ok) return r
  const t = isObj(r.json) ? r.json.treinador : undefined
  if (t === null) return { ok: true, valor: { treinador: null } }
  return isObj(t) && typeof t.nome === 'string' ? { ok: true, valor: { treinador: { nome: t.nome } } } : respostaInvalida()
}

export async function desvincularNoServidor(): Promise<RespostaDaApi<true>> {
  const r = await chamar('DELETE', '/api/meu-treinador')
  return r.ok ? { ok: true, valor: true } : r
}

export async function cancelarConviteNoServidor(id: string): Promise<RespostaDaApi<true>> {
  const r = await chamar('DELETE', `${doAluno(id)}/convite`)
  return r.ok ? { ok: true, valor: true } : r
}
export const atualizarAlunoNoServidor = (id: string, campos: Record<string, unknown>) => umaFicha(chamar('PATCH', doAluno(id), campos))

export async function apagarAlunoNoServidor(id: string): Promise<RespostaDaApi<true>> {
  const r = await chamar('DELETE', doAluno(id))
  return r.ok ? { ok: true, valor: true } : r
}

// ── Dados do aluno com conta (aba "Treinos" da ficha) ────────

const NIVEIS_CONHECIDOS: readonly string[] = ['iniciante', 'intermediario', 'avancado']

/** Confere o formato inteiro antes de a tela usar: um campo fora do lugar vira erro genérico, nunca um gráfico quebrado. */
function comoDadosDoAluno(json: unknown): DadosDoAluno | null {
  if (!isObj(json) || !isObj(json.dados)) return null
  const d = json.dados
  const estiloOk = d.estilo === null || (isObj(d.estilo) && typeof d.estilo.atletaId === 'string' && typeof d.estilo.nome === 'string' && typeof d.estilo.estilo === 'string' && typeof d.estilo.percentual === 'number')
  const planoOk = d.plano === null || (isObj(d.plano) && typeof d.plano.nome === 'string' && typeof d.plano.semana === 'number' && typeof d.plano.semanas === 'number')
  const treinosOk = Array.isArray(d.treinos) && d.treinos.every(t => isObj(t) && typeof t.data === 'string' && isRegType(t.tipo)
    && [t.rounds, t.minPorRound, t.rpe, t.duracaoSegundos].every(n => typeof n === 'number' && Number.isFinite(n)))
  if (!(d.nivel === null || (typeof d.nivel === 'string' && NIVEIS_CONHECIDOS.includes(d.nivel))) || typeof d.foto !== 'string' || !estiloOk || !planoOk || !treinosOk) return null
  return d as unknown as DadosDoAluno
}

/** O que o treinador vê do aluno (`409 sem_vinculo` se a ficha não tem conta vinculada). */
export async function dadosDoAlunoNoServidor(id: string): Promise<RespostaDaApi<DadosDoAluno>> {
  const r = await chamar('GET', `${doAluno(id)}/dados`)
  if (!r.ok) return r
  const dados = comoDadosDoAluno(r.json)
  return dados ? { ok: true, valor: dados } : respostaInvalida()
}

// ── Sugestões de plano e selo da aba "Alunos" (etapa 4) ──────

const texto = (v: unknown): v is string => typeof v === 'string'
const textoOuNulo = (v: unknown): v is string | null => v === null || typeof v === 'string'

function comoSugestaoDaFicha(v: unknown): SugestaoDaFicha | null {
  if (!isObj(v) || !texto(v.id) || !texto(v.planoId) || !texto(v.planoNome) || !texto(v.mensagem) || !texto(v.criadaEm) || !textoOuNulo(v.respondidaEm)) return null
  return STATUS_DA_SUGESTAO.includes(v.status as StatusDaSugestao) ? (v as unknown as SugestaoDaFicha) : null
}

function comoListaDeSugestoes(v: unknown): SugestaoDaFicha[] | null {
  if (!Array.isArray(v)) return null
  const lista = v.map(comoSugestaoDaFicha)
  return lista.every((s): s is SugestaoDaFicha => s !== null) ? lista : null
}

function comoSugestaoParaOAluno(v: unknown): SugestaoParaOAluno | null | undefined {
  if (v === null) return null
  if (!isObj(v) || !texto(v.id) || !texto(v.planoId) || !texto(v.planoNome) || !texto(v.mensagem) || !texto(v.treinador) || !texto(v.criadaEm) || !textoOuNulo(v.respondidaEm)) return undefined
  return v as unknown as SugestaoParaOAluno
}

const doAlunoSugestoes = (id: string) => `${doAluno(id)}/sugestoes`
const daSugestao = (id: string) => `/api/sugestao-do-treinador/${encodeURIComponent(id)}`

/** O histórico de sugestões de uma ficha, da mais nova para a mais antiga. */
export async function historicoDeSugestoesNoServidor(id: string): Promise<RespostaDaApi<SugestaoDaFicha[]>> {
  const r = await chamar('GET', doAlunoSugestoes(id))
  if (!r.ok) return r
  const lista = isObj(r.json) ? comoListaDeSugestoes(r.json.sugestoes) : null
  return lista ? { ok: true, valor: lista } : respostaInvalida()
}

/** Sugere um plano. `pendente`: o aluno recebe o aviso; `registrada`: ficha sem conta, fica só no histórico. */
export async function sugerirPlanoNoServidor(id: string, sugestao: NovaSugestao): Promise<RespostaDaApi<{ status: 'pendente' | 'registrada'; sugestoes: SugestaoDaFicha[] }>> {
  const r = await chamar('POST', doAlunoSugestoes(id), sugestao)
  if (!r.ok) return r
  const lista = isObj(r.json) ? comoListaDeSugestoes(r.json.sugestoes) : null
  const status = isObj(r.json) ? r.json.status : undefined
  return lista && (status === 'pendente' || status === 'registrada') ? { ok: true, valor: { status, sugestoes: lista } } : respostaInvalida()
}

/** O selo da aba "Alunos": quantos alunos estão há 7+ dias sem treinar; `null` quando o ambiente não tem banco. */
export async function seloDeAlunosNoServidor(): Promise<RespostaDaApi<number | null>> {
  const r = await chamar('GET', `${base}/selo`)
  if (!r.ok) return r
  const v = isObj(r.json) ? r.json.vermelhos : undefined
  if (v === null) return { ok: true, valor: null }
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? { ok: true, valor: v } : respostaInvalida()
}

/** O aluno: a sugestão que espera resposta e a última que ele aceitou neste vínculo. */
export async function sugestaoDoTreinadorNoServidor(): Promise<RespostaDaApi<SugestoesDoAluno>> {
  const r = await chamar('GET', '/api/sugestao-do-treinador')
  if (!r.ok) return r
  if (!isObj(r.json)) return respostaInvalida()
  const pendente = comoSugestaoParaOAluno(r.json.pendente)
  const aceita = comoSugestaoParaOAluno(r.json.aceita)
  return pendente !== undefined && aceita !== undefined ? { ok: true, valor: { pendente, aceita } } : respostaInvalida()
}

export async function aceitarSugestaoNoServidor(id: string): Promise<RespostaDaApi<true>> {
  const r = await chamar('POST', `${daSugestao(id)}/aceitar`)
  return r.ok ? { ok: true, valor: true } : r
}

export async function recusarSugestaoNoServidor(id: string): Promise<RespostaDaApi<true>> {
  const r = await chamar('POST', `${daSugestao(id)}/recusar`)
  return r.ok ? { ok: true, valor: true } : r
}
