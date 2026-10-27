// As chamadas que as telas do treinador fazem à API /api/cornerman/alunos (veja app/api/cornerman/alunos).
// Nunca lançam erro: toda falha (rede, servidor, resposta fora do formato) volta como `{ ok: false, … }` com texto para mostrar.

import { isObj } from '@/lib/dados/contrato'
import type { DadosDaFicha, FichaDeAluno } from './ficha'

export type RespostaDaApi<T> = { ok: true; valor: T } | { ok: false; erro: string; codigo: string; status: number }

export interface ListaDeAlunos { alunos: FichaDeAluno[]; ativos: number; limite: number }

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
  return { ok: true, valor: { alunos: j.alunos as FichaDeAluno[], ativos: j.ativos, limite: j.limite } }
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

export async function cancelarConviteNoServidor(id: string): Promise<RespostaDaApi<true>> {
  const r = await chamar('DELETE', `${doAluno(id)}/convite`)
  return r.ok ? { ok: true, valor: true } : r
}
export const atualizarAlunoNoServidor = (id: string, campos: Record<string, unknown>) => umaFicha(chamar('PATCH', doAluno(id), campos))

export async function apagarAlunoNoServidor(id: string): Promise<RespostaDaApi<true>> {
  const r = await chamar('DELETE', doAluno(id))
  return r.ok ? { ok: true, valor: true } : r
}
