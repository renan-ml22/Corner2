// Repositório sobre o localStorage do aparelho.
//
// - Mesmas chaves e mesmo JSON que o app sempre gravou: `corner:{usuário}:{entidade}`.
// - Leitura tolerante e sem efeitos: ler nunca altera o que está salvo.
// - Antes de sobrescrever um valor inválido, o original vai para `…:quarentena`.
// - Se o navegador não deixar gravar (modo privado, sem espaço), o app segue funcionando em memória.
// - A versão do esquema fica em `corner:{usuário}:esquema`; dados antigos são migrados ao primeiro acesso.

import { ENTIDADES, NOMES_ENTIDADES, type DadosDoApp, type NomeEntidade } from './entidades'
import { MIGRACOES, VERSAO_ESQUEMA, migrar, type DadosBrutos, type Migracao } from './esquema'
import type { Repositorio } from './repositorio'

export interface ArmazenamentoLike {
  getItem(chave: string): string | null
  setItem(chave: string, valor: string): void
}

export interface EventosLike {
  addEventListener(tipo: 'storage', ouvinte: () => void): void
  removeEventListener(tipo: 'storage', ouvinte: () => void): void
}

export interface OpcoesRepositorioLocal {
  usuarioId: string
  /** Padrão: window.localStorage. `null` = sem armazenamento (servidor): tudo fica só em memória. */
  storage?: ArmazenamentoLike | null
  /** Onde ouvir o evento `storage` (mudanças vindas de outras abas). Padrão: window. */
  eventos?: EventosLike | null
  /** Só para testes de migração. */
  alvo?: number
  migracoes?: Migracao[]
}

export interface RepositorioLocal extends Repositorio {
  /** Texto original guardado em quarentena para a entidade, se houver. */
  quarentena(nome: NomeEntidade): string | null
  /** Guarda uma cópia de segurança na quarentena (ex.: antes de fundir os dados do aparelho com os da conta). */
  guardarQuarentena(nome: NomeEntidade, texto: string): void
}

interface Entrada { raw: string | null; valor: unknown }

export function armazenamentoPadrao(): ArmazenamentoLike | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null // acesso ao localStorage bloqueado
  }
}

export function criarRepositorioLocal(opcoes: OpcoesRepositorioLocal): RepositorioLocal {
  const { usuarioId, alvo = VERSAO_ESQUEMA, migracoes = MIGRACOES } = opcoes
  const storage = opcoes.storage === undefined ? armazenamentoPadrao() : opcoes.storage
  const eventos = opcoes.eventos === undefined ? (typeof window !== 'undefined' ? window : null) : opcoes.eventos

  const chave = (nome: string) => `corner:${usuarioId}:${nome}`
  const cache = new Map<NomeEntidade, Entrada>()
  const ouvintes = new Set<() => void>()
  let iniciado = false
  let podeCarimbar = true

  const lerBruto = (k: string): string | null => {
    try { return storage ? storage.getItem(k) : null } catch { return null }
  }
  const gravarBruto = (k: string, v: string): boolean => {
    try {
      if (!storage) return false
      storage.setItem(k, v)
      return true
    } catch {
      return false // sem espaço ou bloqueado: só não persiste
    }
  }

  const avisar = () => ouvintes.forEach(o => o())

  /** Migra os dados antigos uma única vez por sessão, antes do primeiro acesso. */
  function iniciar() {
    if (iniciado) return
    iniciado = true
    if (!storage) return

    const brutoVersao = lerBruto(chave('esquema'))
    const lida = brutoVersao === null ? 1 : Number(brutoVersao)
    const versao = Number.isInteger(lida) && lida >= 1 ? lida : 1

    if (versao > alvo) { podeCarimbar = false; return } // dados de um app mais novo: não mexe
    if (versao === alvo) return

    const dados: DadosBrutos = {}
    for (const nome of NOMES_ENTIDADES) {
      const raw = lerBruto(chave(nome))
      if (raw === null) continue
      try { dados[nome] = JSON.parse(raw) } catch { /* corrompido: a leitura tolerante cuida */ }
    }
    const r = migrar(dados, versao, { alvo, migracoes })
    if (!r.ok) { podeCarimbar = false; return } // tenta de novo na próxima abertura, sem tocar nos dados

    for (const nome of NOMES_ENTIDADES) {
      if (r.dados[nome] !== undefined) gravarBruto(chave(nome), JSON.stringify(r.dados[nome]))
    }
    gravarBruto(chave('esquema'), String(alvo))
    cache.clear()
  }

  function carimbarEsquema() {
    if (podeCarimbar && lerBruto(chave('esquema')) !== String(alvo)) gravarBruto(chave('esquema'), String(alvo))
  }

  function interpretar(nome: NomeEntidade, raw: string | null): unknown {
    const e = ENTIDADES[nome]
    if (raw === null) return e.inicial
    let parsed: unknown
    try { parsed = JSON.parse(raw) } catch { return e.inicial }
    if (e.validar(parsed)) return parsed
    return e.limpar?.(parsed) ?? e.inicial
  }

  /** Antes de sobrescrever um valor corrompido ou com itens inválidos, guarda o original. */
  function quarentenar(nome: NomeEntidade, rawAntes: string | null) {
    if (rawAntes === null) return
    try {
      if (ENTIDADES[nome].validar(JSON.parse(rawAntes))) return
    } catch { /* JSON quebrado: vai para a quarentena */ }
    gravarBruto(`${chave(nome)}:quarentena`, rawAntes)
  }

  function gravarEntidade(nome: NomeEntidade, valor: unknown) {
    const k = chave(nome)
    const rawAntes = lerBruto(k)
    quarentenar(nome, rawAntes)
    const bruto = JSON.stringify(valor)
    // Se a gravação falhar, o valor novo fica só em memória (e a mudança de outra aba ainda prevalece).
    cache.set(nome, { raw: gravarBruto(k, bruto) ? bruto : rawAntes, valor })
  }

  const aoMudarEmOutraAba = () => avisar()

  return {
    obter<N extends NomeEntidade>(nome: N): DadosDoApp[N] {
      iniciar()
      const raw = lerBruto(chave(nome))
      const guardado = cache.get(nome)
      if (guardado && guardado.raw === raw) return guardado.valor as DadosDoApp[N]
      const valor = interpretar(nome, raw)
      cache.set(nome, { raw, valor })
      return valor as DadosDoApp[N]
    },

    gravar<N extends NomeEntidade>(nome: N, valor: DadosDoApp[N]) {
      iniciar()
      gravarEntidade(nome, valor)
      carimbarEsquema()
      avisar()
    },

    gravarVarias(dados) {
      iniciar()
      for (const nome of NOMES_ENTIDADES) {
        if (dados[nome] !== undefined) gravarEntidade(nome, dados[nome])
      }
      carimbarEsquema()
      avisar()
    },

    assinar(ouvinte) {
      ouvintes.add(ouvinte)
      if (ouvintes.size === 1) eventos?.addEventListener('storage', aoMudarEmOutraAba)
      return () => {
        if (ouvintes.delete(ouvinte) && ouvintes.size === 0) eventos?.removeEventListener('storage', aoMudarEmOutraAba)
      }
    },

    quarentena(nome) {
      return lerBruto(`${chave(nome)}:quarentena`)
    },

    guardarQuarentena(nome, texto) {
      gravarBruto(`${chave(nome)}:quarentena`, texto)
    },
  }
}
