// Versão do esquema dos dados e migrações entre versões.
//
// A versão 1 é o formato que o app sempre gravou (as chaves e os valores não mudaram quando o
// versionamento foi introduzido). Quando um formato mudar: some 1 a VERSAO_ESQUEMA, escreva a
// migração { de: <versão antiga>, migrar } em MIGRACOES e cubra com teste.

/** Dados brutos por nome de entidade, como estão gravados (ainda sem validar). */
export type DadosBrutos = Record<string, unknown>

export interface Migracao {
  /** Versão que esta migração recebe; ela produz a versão `de + 1`. */
  de: number
  migrar: (dados: DadosBrutos) => DadosBrutos
}

export const VERSAO_ESQUEMA = 1

export const MIGRACOES: Migracao[] = []

export type ResultadoMigracao = { ok: true; dados: DadosBrutos } | { ok: false; erro: string }

export interface OpcoesMigracao {
  alvo?: number
  migracoes?: Migracao[]
}

/** Leva os dados da versão `de` até a versão alvo, aplicando as migrações em ordem. Nunca lança. */
export function migrar(dados: DadosBrutos, de: number, { alvo = VERSAO_ESQUEMA, migracoes = MIGRACOES }: OpcoesMigracao = {}): ResultadoMigracao {
  if (de > alvo) return { ok: false, erro: 'Estes dados vêm de uma versão mais nova do Corner. Atualize o app e tente de novo.' }

  let atual = dados
  for (let versao = de; versao < alvo; versao++) {
    const passo = migracoes.find(m => m.de === versao)
    if (!passo) return { ok: false, erro: `Não há migração da versão ${versao} para a ${versao + 1}.` }
    try {
      atual = passo.migrar({ ...atual })
    } catch {
      return { ok: false, erro: `Falha ao migrar os dados da versão ${versao} para a ${versao + 1}.` }
    }
  }
  return { ok: true, dados: atual }
}
