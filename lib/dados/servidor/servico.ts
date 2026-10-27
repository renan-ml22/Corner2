// Serviço de dados do servidor: valida o que chega do app, grava nas tabelas e lê de volta, sempre por usuário.
//
// Não conhece o Supabase: fala com um `BancoLike` (veja banco-supabase.ts). Assim as regras testam-se sem rede.
// O id do usuário vem SEMPRE da sessão (nunca do corpo do pedido): é isso que isola os dados de cada pessoa.

import { ENTIDADES, ENTIDADES_SINCRONIZADAS, type DadosDoApp, type EntidadeSincronizada, type NomeEntidade } from '../entidades'
import { isObj, limparConfig } from '../contrato'
import {
  configParaPerfil, linhaParaPlano, linhaParaTreino, perfilParaConfig, planoParaLinha, treinoParaLinha,
  type LinhaPerfil, type LinhaPlano, type LinhaTreino,
} from './mapeamento'

export { ENTIDADES_SINCRONIZADAS, type EntidadeSincronizada }

/** Entidades guardadas em `user_data`, como JSON. As demais têm tabela própria. */
const GENERICAS = ['checklist', 'checkins', 'lesoes', 'pesos', 'ajuste', 'reag', 'foto'] as const satisfies readonly EntidadeSincronizada[]

/** Maior lista aceita por entidade. O app limita check-ins (120) e peso (400); o histórico não tem limite próprio. */
export const LIMITE_DE_ITENS = 5000

/** Linha de `user_data` que só diz "esta entidade já foi gravada" (os dados ficam na tabela própria). */
const MARCA = { gravado: true }

export interface BancoLike {
  lerTreinos(usuarioId: string): Promise<LinhaTreino[]>
  /** Troca a lista inteira de treinos do usuário (na ordem recebida), numa só transação. */
  substituirTreinos(usuarioId: string, linhas: LinhaTreino[]): Promise<void>
  lerPlano(usuarioId: string): Promise<LinhaPlano | null>
  /** `null` apaga o plano. */
  salvarPlano(usuarioId: string, linha: LinhaPlano | null): Promise<void>
  lerPerfil(usuarioId: string): Promise<LinhaPerfil | null>
  salvarPerfil(usuarioId: string, linha: LinhaPerfil): Promise<void>
  lerDados(usuarioId: string): Promise<{ entity: string; value: unknown }[]>
  salvarDado(usuarioId: string, entity: string, value: unknown): Promise<void>
}

export class ErroDados extends Error {
  constructor(readonly codigo: string, message: string, readonly status: number) {
    super(message)
    this.name = 'ErroDados'
  }
}

const naLista = (nome: string): nome is EntidadeSincronizada => (ENTIDADES_SINCRONIZADAS as readonly string[]).includes(nome)

/** Valida o pedido inteiro antes de gravar qualquer coisa: ou tudo é aceito, ou nada é gravado. */
function validar(corpo: unknown): Partial<DadosDoApp> {
  if (!isObj(corpo)) throw new ErroDados('pedido_invalido', 'Pedido inválido.', 400)
  const nomes = Object.keys(corpo)
  if (nomes.length === 0) throw new ErroDados('pedido_invalido', 'Não há nada para salvar.', 400)

  for (const nome of nomes) {
    if (!naLista(nome)) throw new ErroDados('entidade_desconhecida', `Dado desconhecido: ${nome}.`, 400)
  }
  for (const nome of nomes as EntidadeSincronizada[]) {
    const valor = corpo[nome]
    if (Array.isArray(valor) && valor.length > LIMITE_DE_ITENS) {
      throw new ErroDados('muito_grande', `Há itens demais em ${nome} (máximo ${LIMITE_DE_ITENS}).`, 413)
    }
    if (!(ENTIDADES[nome].validar as (v: unknown) => boolean)(valor)) {
      throw new ErroDados('dado_invalido', `Os dados de ${nome} não têm o formato esperado.`, 400)
    }
  }
  const historico = corpo.historico as DadosDoApp['historico'] | undefined
  if (historico && new Set(historico.map(t => t.id)).size !== historico.length) {
    throw new ErroDados('dado_invalido', 'O histórico tem treinos com o mesmo id.', 400)
  }
  return corpo as Partial<DadosDoApp>
}

export async function salvarEntidades(banco: BancoLike, usuario: { id: string; nome: string }, corpo: unknown): Promise<void> {
  const dados = validar(corpo)

  if (dados.historico !== undefined) {
    await banco.substituirTreinos(usuario.id, dados.historico.map(treinoParaLinha))
    await banco.salvarDado(usuario.id, 'historico', MARCA)
  }
  if (dados.plano !== undefined) {
    await banco.salvarPlano(usuario.id, dados.plano ? planoParaLinha(dados.plano) : null)
    await banco.salvarDado(usuario.id, 'plano', MARCA)
  }
  if (dados.config !== undefined) {
    // `limparConfig` tira os campos que o app não conhece: o banco só guarda o que o contrato prevê.
    await banco.salvarPerfil(usuario.id, configParaPerfil(limparConfig(dados.config) ?? {}, usuario.nome))
  }
  for (const nome of GENERICAS) {
    if (dados[nome] !== undefined) await banco.salvarDado(usuario.id, nome, dados[nome])
  }
}

/**
 * Tudo o que o usuário tem no banco. Uma entidade ausente no resultado significa "nunca foi gravada"
 * (diferente de vazia: lista vazia ou `plano: null` foram gravados de propósito).
 */
export async function carregarDados(banco: BancoLike, usuarioId: string): Promise<Partial<DadosDoApp>> {
  const [treinos, plano, perfil, genericos] = await Promise.all([
    banco.lerTreinos(usuarioId), banco.lerPlano(usuarioId), banco.lerPerfil(usuarioId), banco.lerDados(usuarioId),
  ])
  const marcas = new Set(genericos.map(g => g.entity))
  const saida: Record<string, unknown> = {}

  if (treinos.length > 0 || marcas.has('historico')) {
    saida.historico = treinos.map(linhaParaTreino).filter(t => t !== null)
  }
  if (plano || marcas.has('plano')) saida.plano = linhaParaPlano(plano)
  if (perfil) saida.config = perfilParaConfig(perfil)

  for (const { entity, value } of genericos) {
    if (!(GENERICAS as readonly string[]).includes(entity)) continue
    const e = ENTIDADES[entity as NomeEntidade] as { validar: (v: unknown) => boolean; limpar?: (v: unknown) => unknown }
    const limpo = e.validar(value) ? value : e.limpar?.(value) ?? undefined
    if (limpo !== undefined) saida[entity] = limpo
  }
  return saida as Partial<DadosDoApp>
}
