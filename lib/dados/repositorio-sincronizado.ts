// Repositório que sincroniza com a conta (banco) por cima do repositório do aparelho.
//
// O aparelho continua sendo a fonte do que a tela mostra: toda leitura e toda gravação acontecem na hora, no
// repositório local (por isso o app funciona offline e a interface continua síncrona). A conta funciona assim:
//
// - Ao abrir: carrega a conta e reconcilia com o aparelho (veja `mesclar`).
// - Ao gravar: marca a entidade como pendente (guardado no aparelho, sobrevive a fechar o app) e envia depois de uma pausa.
// - Se o envio falha (sem rede, servidor fora): as pendências ficam, e o app tenta de novo esperando cada vez mais.
//
// Regras que protegem os dados:
// 1. Primeira vez que um aparelho encontra uma conta com dados: FUNDE os dois lados e guarda o original do aparelho na
//    quarentena. Nunca um lado simplesmente sobrescreve o outro.
// 2. Depois disso, uma alteração feita aqui e ainda não enviada vence a conta; o que não foi alterado aqui vem da conta.
// 3. Cada entidade é enviada inteira e vale a última que chegar (não há fusão linha a linha entre dois aparelhos
//    usados ao mesmo tempo: veja docs/plano-supabase.md).

import { ENTIDADES, ENTIDADES_SINCRONIZADAS, type DadosDoApp, type EntidadeSincronizada } from './entidades'
import { fundir, iguais } from './fusao'
import { armazenamentoPadrao, type ArmazenamentoLike, type RepositorioLocal } from './repositorio-local'
import type { Repositorio } from './repositorio'

export interface RemotoLike {
  /** Tudo o que a conta tem. `null` = a conta na nuvem está desligada neste ambiente. Entidade ausente = nunca gravada. */
  carregar(): Promise<Partial<DadosDoApp> | null>
  enviar(dados: Partial<DadosDoApp>, opcoes?: { keepalive?: boolean }): Promise<void>
}

/** `desligada`: sem conta na nuvem. `sincronizando`: falando com a conta. `ok`: tudo enviado. `pendente`: há algo a enviar. */
export type EstadoDaSincronia = 'desligada' | 'sincronizando' | 'ok' | 'pendente'

export interface OpcoesRepositorioSincronizado {
  usuarioId: string
  local: RepositorioLocal
  remoto: RemotoLike
  /** Onde guardar as pendências. Padrão: window.localStorage. `null` = só em memória. */
  storage?: ArmazenamentoLike | null
  /** Para testes: como agendar uma tarefa. Devolve a função que cancela. Padrão: setTimeout. */
  agendar?: (fn: () => void, ms: number) => () => void
  atrasoDoEnvioMs?: number
  esperasDeNovaTentativaMs?: number[]
}

export interface RepositorioSincronizado extends Repositorio {
  /** Carrega a conta e reconcilia com o aparelho. Chamar mais de uma vez não carrega de novo. */
  iniciar(): Promise<void>
  /** Cancela os relógios (ao sair da tela). As pendências continuam guardadas para o próximo acesso. */
  parar(): void
  /**
   * Tenta enviar agora, sem esperar (a rede voltou, o app voltou ao primeiro plano).
   * `aoFechar`: a página está sendo escondida ou fechada, então o envio deve terminar mesmo sem a aba.
   */
  reenviarAgora(opcoes?: { aoFechar?: boolean }): Promise<void>
  estadoDaSincronia(): EstadoDaSincronia
  assinarSincronia(ouvinte: () => void): () => void
}

interface Meta { pendentes: EntidadeSincronizada[]; ligado: boolean }

const ESPERAS_PADRAO = [5_000, 15_000, 60_000, 300_000]

const sincroniza = (nome: string): nome is EntidadeSincronizada => (ENTIDADES_SINCRONIZADAS as readonly string[]).includes(nome)

/** Valor da conta já checado pelo contrato. `undefined` = ausente ou irrecuperável. */
function doServidor(remotos: Partial<DadosDoApp>, nome: EntidadeSincronizada): unknown {
  if (!Object.hasOwn(remotos, nome)) return undefined
  const valor = remotos[nome]
  const e = ENTIDADES[nome] as { validar: (v: unknown) => boolean; limpar?: (v: unknown) => unknown }
  if (e.validar(valor)) return valor
  return e.limpar?.(valor) ?? undefined
}

export function criarRepositorioSincronizado(opcoes: OpcoesRepositorioSincronizado): RepositorioSincronizado {
  const { usuarioId, local, remoto } = opcoes
  const storage = opcoes.storage === undefined ? armazenamentoPadrao() : opcoes.storage
  const agendar = opcoes.agendar ?? ((fn, ms) => { const id = setTimeout(fn, ms); return () => clearTimeout(id) })
  const atraso = opcoes.atrasoDoEnvioMs ?? 1500
  const esperas = opcoes.esperasDeNovaTentativaMs ?? ESPERAS_PADRAO
  const chaveMeta = `corner:${usuarioId}:sync`

  const ouvintesDeEstado = new Set<() => void>()
  let estado: EstadoDaSincronia = 'desligada'
  /** `null` = ainda não se sabe se a conta na nuvem está ligada. */
  let ativo: boolean | null = null
  let carregado = false
  let carregando: Promise<void> | null = null
  let enviando: Promise<void> | null = null
  let falhas = 0
  let cancelarEnvio: (() => void) | null = null
  let cancelarTentativa: (() => void) | null = null
  /** Conta quantas vezes cada entidade foi gravada: deixa saber se algo mudou durante um envio em andamento. */
  const versoes = new Map<EntidadeSincronizada, number>()

  // ── Pendências guardadas no aparelho ───────────────────────

  let meta: Meta | null = null
  function obterMeta(): Meta {
    if (meta) return meta
    meta = { pendentes: [], ligado: false }
    try {
      const raw = storage?.getItem(chaveMeta)
      const lido: unknown = raw ? JSON.parse(raw) : null
      if (typeof lido === 'object' && lido !== null && Array.isArray((lido as Meta).pendentes) && typeof (lido as Meta).ligado === 'boolean') {
        meta = { pendentes: (lido as Meta).pendentes.filter(sincroniza), ligado: (lido as Meta).ligado }
      }
    } catch { /* marcação ilegível: recomeça sem pendências (o aparelho continua com os dados) */ }
    return meta
  }
  function gravarMeta(m: Meta) {
    meta = m
    try { storage?.setItem(chaveMeta, JSON.stringify(m)) } catch { /* sem espaço: segue em memória */ }
  }

  // ── Estado ─────────────────────────────────────────────────

  function mudarEstado(novo: EstadoDaSincronia) {
    if (novo === estado) return
    estado = novo
    ouvintesDeEstado.forEach(o => o())
  }

  // ── Envio ──────────────────────────────────────────────────

  function agendarEnvio() {
    cancelarEnvio?.()
    cancelarEnvio = agendar(() => { cancelarEnvio = null; void enviarPendentes() }, atraso)
  }

  function agendarNovaTentativa() {
    cancelarTentativa?.()
    const espera = esperas[Math.min(Math.max(falhas, 1) - 1, esperas.length - 1)]
    cancelarTentativa = agendar(() => { cancelarTentativa = null; void (carregado ? enviarPendentes() : carregarUmaVez()) }, espera)
  }

  function enviarPendentes(aoFechar = false): Promise<void> {
    if (enviando) return enviando // o laço abaixo já pega o que chegar durante o envio
    enviando = (async () => {
      // Cede uma vez antes de começar: sem isto, quando não há nada a enviar, o `finally` zeraria `enviando`
      // ANTES de a atribuição acima acontecer, e a promessa já resolvida ficaria presa ali para sempre.
      await Promise.resolve()
      try {
        for (;;) {
          const nomes = obterMeta().pendentes
          if (nomes.length === 0) { mudarEstado('ok'); return }

          mudarEstado('sincronizando')
          const capturadas = new Map(nomes.map(n => [n, versoes.get(n) ?? 0]))
          const carga: Partial<DadosDoApp> = {}
          for (const n of nomes) (carga as Record<string, unknown>)[n] = local.obter(n)

          try {
            await remoto.enviar(carga, aoFechar ? { keepalive: true } : undefined)
          } catch {
            falhas++
            mudarEstado('pendente')
            agendarNovaTentativa()
            return
          }

          falhas = 0
          cancelarTentativa?.(); cancelarTentativa = null
          // Só dá por enviado o que NÃO mudou durante o envio; o resto sai na próxima volta do laço.
          const m = obterMeta()
          gravarMeta({ ...m, pendentes: m.pendentes.filter(n => !capturadas.has(n) || (versoes.get(n) ?? 0) !== capturadas.get(n)) })
        }
      } finally {
        enviando = null
      }
    })()
    return enviando
  }

  // ── Reconciliação ao abrir ─────────────────────────────────

  function mesclar(remotos: Partial<DadosDoApp>) {
    const m = obterMeta()
    const primeira = !m.ligado
    const sujas = new Set(m.pendentes)
    const aplicar: Record<string, unknown> = {}
    const enviar = new Set<EntidadeSincronizada>()

    for (const nome of ENTIDADES_SINCRONIZADAS) {
      const servidor = doServidor(remotos, nome)
      const atual: unknown = local.obter(nome)
      const temLocal = !iguais(atual, ENTIDADES[nome].inicial)
      const suja = sujas.has(nome)

      if (servidor === undefined) { // a conta nunca recebeu esta entidade
        if (temLocal || suja) enviar.add(nome)
        continue
      }
      if (primeira && temLocal && !iguais(atual, servidor)) { // primeira vez, e os dois lados têm dados diferentes
        const fundido = (fundir as (n: string, l: unknown, s: unknown) => unknown)(nome, atual, servidor)
        local.guardarQuarentena(nome, JSON.stringify(atual)) // o original do aparelho nunca se perde
        if (!iguais(fundido, atual)) aplicar[nome] = fundido
        if (!iguais(fundido, servidor)) enviar.add(nome)
        continue
      }
      if (suja) { enviar.add(nome); continue } // alterado aqui e ainda não enviado: vence a conta
      if (!iguais(atual, servidor)) aplicar[nome] = servidor
    }

    if (Object.keys(aplicar).length > 0) local.gravarVarias(aplicar as Partial<DadosDoApp>)
    gravarMeta({ ligado: true, pendentes: [...new Set([...m.pendentes, ...enviar])] })
  }

  async function carregarEMesclar(): Promise<void> {
    mudarEstado('sincronizando')
    let remotos: Partial<DadosDoApp> | null
    try {
      remotos = await remoto.carregar()
    } catch {
      falhas++
      mudarEstado('pendente') // não deu para confirmar nada: o aparelho segue como está
      agendarNovaTentativa()
      return
    }
    falhas = 0
    if (remotos === null) {
      ativo = false
      if (obterMeta().pendentes.length > 0) gravarMeta({ ...obterMeta(), pendentes: [] })
      mudarEstado('desligada')
      return
    }
    ativo = true
    mesclar(remotos)
    carregado = true
    await enviarPendentes()
  }

  function carregarUmaVez(): Promise<void> {
    carregando ??= carregarEMesclar().finally(() => { carregando = null })
    return carregando
  }

  // ── Marcar o que mudou ─────────────────────────────────────

  function marcar(nomes: EntidadeSincronizada[]) {
    if (nomes.length === 0 || ativo === false) return
    const m = obterMeta()
    const pendentes = [...m.pendentes]
    for (const n of nomes) {
      versoes.set(n, (versoes.get(n) ?? 0) + 1)
      if (!pendentes.includes(n)) pendentes.push(n)
    }
    gravarMeta({ ...m, pendentes })
    if (ativo === true) { mudarEstado('pendente'); agendarEnvio() }
  }

  return {
    obter: nome => local.obter(nome),
    assinar: ouvinte => local.assinar(ouvinte),

    gravar(nome, valor) {
      local.gravar(nome, valor)
      if (sincroniza(nome)) marcar([nome])
    },

    gravarVarias(dados) {
      local.gravarVarias(dados)
      marcar(ENTIDADES_SINCRONIZADAS.filter(n => dados[n] !== undefined))
    },

    iniciar: () => (carregado ? Promise.resolve() : carregarUmaVez()),

    parar() {
      cancelarEnvio?.(); cancelarEnvio = null
      cancelarTentativa?.(); cancelarTentativa = null
    },

    async reenviarAgora(opcoes) {
      if (ativo === false) return
      cancelarEnvio?.(); cancelarEnvio = null
      cancelarTentativa?.(); cancelarTentativa = null
      await (carregado ? enviarPendentes(opcoes?.aoFechar) : carregarUmaVez())
    },

    estadoDaSincronia: () => estado,

    assinarSincronia(ouvinte) {
      ouvintesDeEstado.add(ouvinte)
      return () => { ouvintesDeEstado.delete(ouvinte) }
    },
  }
}
