'use client'

import { useState } from 'react'
import { getPlano } from '@/data/planos'
import { ConviteAoPlano } from '@/components/ConviteAoPlano'
import { useAssinatura } from '@/hooks/useAssinatura'
import { usePlano } from '@/hooks/usePlano'
import { useToast } from '@/hooks/useToast'
import { RECURSO_DO_PLANO_DE_TREINO } from '@/lib/assinatura/catalogo'
import { aceitarSugestaoNoServidor, recusarSugestaoNoServidor } from '@/lib/cornerman/cliente'
import type { SugestaoParaOAluno } from '@/lib/cornerman/sugestao'
import { TEXTOS } from '@/lib/textos'
import estilos from './SugestaoDoTreinador.module.css'

interface Props {
  sugestao: SugestaoParaOAluno
  /** Chamado depois de o servidor confirmar a resposta (e, ao aceitar, depois de o plano ser aplicado). */
  aoResponder: (resposta: 'aceita' | 'recusada') => void
}

/** Aviso na tela Hoje: o treinador sugeriu um plano. Ver o plano, aceitar ou recusar. */
export default function SugestaoDoTreinador({ sugestao, aoResponder }: Props) {
  const avisar = useToast()
  const { planoAtivo, escolherPlano } = usePlano()
  const { planoDeTreinoLiberado } = useAssinatura()
  const [aberto, setAberto] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const plano = getPlano(sugestao.planoId)
  const liberado = planoDeTreinoLiberado(sugestao.planoId)
  const jaEstaNele = planoAtivo?.planoId === sugestao.planoId

  const aceitar = async () => {
    // Trocar de plano zera a semana atual: pergunta antes, como na escolha manual. Já estar no plano não reinicia nada.
    if (planoAtivo && !jaEstaNele && !window.confirm(TEXTOS.confirmar.trocarPlano(sugestao.planoNome))) return
    setErro(null)
    setOcupado(true)
    const r = await aceitarSugestaoNoServidor(sugestao.id)
    if (!r.ok) {
      setOcupado(false)
      setErro(r.erro)
      return
    }
    // O servidor confirmou: agora o plano vale no aparelho.
    if (!jaEstaNele) escolherPlano(sugestao.planoId)
    avisar(TEXTOS.aviso.planoAtivado(sugestao.planoNome))
    aoResponder('aceita')
  }

  const recusar = async () => {
    if (!window.confirm(TEXTOS.confirmar.recusarSugestao(sugestao.treinador))) return
    setErro(null)
    setOcupado(true)
    const r = await recusarSugestaoNoServidor(sugestao.id)
    if (!r.ok) {
      setOcupado(false)
      setErro(r.erro)
      return
    }
    avisar(TEXTOS.aviso.sugestaoRecusada)
    aoResponder('recusada')
  }

  return (
    <section className={`surface-card ${estilos.cartao}`} aria-label="Plano sugerido pelo seu treinador">
      <div className={estilos.topo}>
        <i className="ph-fill ph-clipboard-text" aria-hidden="true" />
        <div>
          <h2>{sugestao.treinador} sugeriu um plano para você</h2>
          <p className={estilos.plano}>{sugestao.planoNome}</p>
        </div>
      </div>

      {sugestao.mensagem && <p className={estilos.mensagem}>{sugestao.mensagem}</p>}

      {aberto && plano && (
        <dl className={estilos.detalhes}>
          <div><dt>Nível</dt><dd>{plano.nivelLabel}</dd></div>
          <div><dt>Duração</dt><dd>{plano.semanas} semanas · {plano.diasPorSemana}× por semana</dd></div>
          <div><dt>O que é</dt><dd>{plano.resumo}</dd></div>
        </dl>
      )}

      {!liberado && RECURSO_DO_PLANO_DE_TREINO[sugestao.planoId] && <ConviteAoPlano recurso={RECURSO_DO_PLANO_DE_TREINO[sugestao.planoId]} compacto />}
      {erro && <p role="alert" className={estilos.erro}>{erro}</p>}

      <div className={estilos.acoes}>
        {plano && (
          <button type="button" className="btn-ghost" aria-expanded={aberto} onClick={() => setAberto(a => !a)}>
            {aberto ? 'Esconder o plano' : 'Ver o plano'}
          </button>
        )}
        {liberado && <button type="button" className="btn-primary" onClick={() => void aceitar()} disabled={ocupado}>{ocupado ? 'Aguarde…' : 'Aceitar plano'}</button>}
        <button type="button" className="btn-ghost" onClick={() => void recusar()} disabled={ocupado}>Recusar</button>
      </div>
    </section>
  )
}
