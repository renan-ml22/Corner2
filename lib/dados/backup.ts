// Arquivo de backup: montar para exportar e ler (com validação) para importar. Puro, sem acesso ao navegador.

import { isObj } from './contrato'
import { ENTIDADES, NOMES_NO_BACKUP, type DadosDoApp } from './entidades'
import { VERSAO_ESQUEMA, migrar, type OpcoesMigracao } from './esquema'

export type DadosDoBackup = Partial<Pick<DadosDoApp, 'historico' | 'plano' | 'config' | 'checkins' | 'lesoes' | 'pesos' | 'reag'>>

export type ResultadoBackup = { ok: true; dados: DadosDoBackup } | { ok: false; erro: string }

export function montarBackup(dados: DadosDoBackup, agora: Date): string {
  const conteudo: Record<string, unknown> = {}
  for (const nome of NOMES_NO_BACKUP) conteudo[nome] = dados[nome as keyof DadosDoBackup]
  return JSON.stringify({ app: 'corner', versao: VERSAO_ESQUEMA, exportadoEm: agora.toISOString(), dados: conteudo }, null, 2)
}

/**
 * Lê e valida um backup. Valida tudo antes de devolver qualquer coisa: um backup parcial ou
 * corrompido não pode apagar dados bons. Entidades ausentes ficam de fora (o app as mantém).
 */
export function lerBackup(texto: string, opcoes?: OpcoesMigracao): ResultadoBackup {
  let raiz: unknown
  try { raiz = JSON.parse(texto) } catch { return { ok: false, erro: 'O arquivo não é um JSON válido.' } }
  if (!isObj(raiz) || raiz.app !== 'corner' || !isObj(raiz.dados)) return { ok: false, erro: 'Este arquivo não é um backup do Corner.' }

  // Backups antigos podem não ter a versão: o formato original é o da versão 1.
  const versao = raiz.versao === undefined ? 1 : raiz.versao
  if (typeof versao !== 'number' || !Number.isInteger(versao) || versao < 1) return { ok: false, erro: 'A versão do backup é inválida.' }

  const migrado = migrar(raiz.dados, versao, opcoes)
  if (!migrado.ok) return migrado

  const dados: Record<string, unknown> = {}
  for (const nome of NOMES_NO_BACKUP) {
    const valor = migrado.dados[nome]
    if (valor === undefined) continue
    const entidade = ENTIDADES[nome]
    if (!entidade.validar(valor)) return { ok: false, erro: entidade.erroBackup ?? 'O backup está corrompido.' }
    dados[nome] = valor
  }
  return { ok: true, dados: dados as DadosDoBackup }
}
