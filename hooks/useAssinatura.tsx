'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useEntidade } from '@/hooks/useEntidade'
import { useRepositorio } from '@/hooks/useRepositorio'
import { NIVEL_GRATUITO, recurso, type NivelDeAcesso, type RecursoId } from '@/lib/assinatura/catalogo'
import { SEM_ASSINATURA, isEstadoAssinatura, planoDeTreinoLiberado, podeUsar as podeUsarRegra, type EstadoAssinatura } from '@/lib/assinatura/regras'

/**
 * - carregando: ainda não perguntamos ao servidor (e não há cópia guardada)
 * - pronto: temos o estado da assinatura (do servidor ou da última cópia guardada)
 * - indisponivel: o pagamento não está configurado (ou não deu para saber): o app fica LIBERADO, como antes
 */
type Fase = 'carregando' | 'pronto' | 'indisponivel'

interface Valor {
  fase: Fase
  /** Já dá para decidir (com o estado do servidor, a cópia guardada ou "pagamento indisponível"). */
  pronto: boolean
  /** O pagamento está ligado neste ambiente (a chave do Stripe existe no servidor). */
  pagamentoAtivo: boolean
  estado: EstadoAssinatura
  podeUsar: (id: RecursoId) => boolean
  planoDeTreinoLiberado: (planoId: string) => boolean
  /** Pergunta de novo ao servidor. `forcar` ignora o cookie de 5 minutos e consulta o Stripe. */
  atualizar: (forcar?: boolean) => Promise<EstadoAssinatura | null>
}

const Ctx = createContext<Valor | null>(null)

const TEMPO_MAXIMO_MS = 5000

export function AssinaturaProvider({ children }: { children: ReactNode }) {
  const repo = useRepositorio()
  const [guardada, setGuardada] = useEntidade(repo, 'assinatura')
  const [fase, setFase] = useState<Fase>('carregando')
  const guardadaRef = useRef(guardada)
  useEffect(() => { guardadaRef.current = guardada }, [guardada])

  const atualizar = useCallback(async (forcar = false): Promise<EstadoAssinatura | null> => {
    const controle = new AbortController()
    const relogio = setTimeout(() => controle.abort(), TEMPO_MAXIMO_MS)
    try {
      const r = await fetch(`/api/assinatura/estado${forcar ? '?atualizar=1' : ''}`, { credentials: 'same-origin', cache: 'no-store', signal: controle.signal })
      if (r.status === 503) { setFase('indisponivel'); return null }
      if (r.ok) {
        const corpo = (await r.json()) as { pagamentoAtivo?: boolean; estado?: unknown } | null
        // Pagamento desligado neste ambiente (sem chave do Stripe): o app fica liberado.
        if (corpo?.pagamentoAtivo === false) { setFase('indisponivel'); return null }
        const estado = corpo?.estado
        if (isEstadoAssinatura(estado)) {
          setGuardada({ estado, em: new Date().toISOString() })
          setFase('pronto')
          return estado
        }
      }
    } catch {
      // Sem rede ou demorou demais: cai no tratamento abaixo.
    } finally {
      clearTimeout(relogio)
    }
    // Não deu para saber agora: usa a última cópia; sem cópia, não bloqueia ninguém por causa de uma falha.
    setFase(guardadaRef.current ? 'pronto' : 'indisponivel')
    return guardadaRef.current?.estado ?? null
  }, [setGuardada])

  useEffect(() => {
    // Consulta ao abrir o app e quando a pessoa volta para esta aba (ex.: depois de pagar em outra aba).
    const primeira = setTimeout(() => void atualizar(), 0)
    const aoVoltar = () => { if (document.visibilityState === 'visible') void atualizar() }
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      clearTimeout(primeira)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [atualizar])

  const estado = guardada?.estado ?? SEM_ASSINATURA
  const pronto = fase !== 'carregando' || guardada !== null
  // Pagamento desligado: libera tudo. Ainda carregando (sem cópia guardada): não bloqueia; as telas mostram
  // um esqueleto até `pronto`, então ninguém vê o app "trancado" por um instante.
  const liberadoPorFalta = fase === 'indisponivel'
  const liberaTudo = liberadoPorFalta || !pronto

  const valor = useMemo<Valor>(() => ({
    fase,
    pronto,
    pagamentoAtivo: !liberadoPorFalta,
    estado,
    podeUsar: id => liberaTudo || podeUsarRegra(id, estado),
    planoDeTreinoLiberado: planoId => liberaTudo || planoDeTreinoLiberado(planoId, estado),
    atualizar,
  }), [fase, pronto, liberadoPorFalta, liberaTudo, estado, atualizar])

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useAssinatura(): Valor {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAssinatura precisa estar dentro do CornerProvider')
  return v
}

/** Um recurso está liberado para esta pessoa? `pronto` é falso até sabermos (evita piscar "bloqueado"). */
export function useAcesso(id: RecursoId): { liberado: boolean; pronto: boolean; nivelNecessario: NivelDeAcesso } {
  const { podeUsar, pronto } = useAssinatura()
  return { liberado: podeUsar(id), pronto, nivelNecessario: recurso(id).nivelMinimo ?? NIVEL_GRATUITO }
}
