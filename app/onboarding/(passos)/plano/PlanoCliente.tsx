'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { resumoRounds } from '@/data/planos'
import PassoShell from '@/components/onboarding/PassoShell'
import estilos from '@/components/onboarding/onboarding.module.css'
import { useAssinatura } from '@/hooks/useAssinatura'
import { useHidratado } from '@/hooks/useEntidade'
import { usePlano } from '@/hooks/usePlano'
import { usePreferencias } from '@/hooks/usePreferencias'
import { useRepositorioSincronizado } from '@/hooks/useRepositorio'
import { NOME_DO_ACESSO, RECURSO_DO_PLANO_DE_TREINO, TESTE_GRATIS_DIAS, recurso } from '@/lib/assinatura/catalogo'
import { metaDoOnboarding, nivelDaExperiencia, planoDoOnboarding } from '@/lib/onboarding'

/** Quanto esperar o envio para a conta antes de seguir: sem rede, o app segue e envia depois (fica pendente no aparelho). */
const ESPERA_MAXIMA_MS = 4000

/** Passo 4: mostra o plano recomendado para o nível e os dias escolhidos. "Começar agora" salva tudo e abre o app. */
export default function PlanoCliente() {
  const router = useRouter()
  const pronto = useHidratado()
  const repo = useRepositorioSincronizado()
  const { config, atualizarConfig } = usePreferencias()
  const { escolherPlano } = usePlano()
  const { planoDeTreinoLiberado } = useAssinatura()
  const [salvando, setSalvando] = useState(false)

  const nivel = nivelDaExperiencia(config.experiencia)
  // Sem o nível (passo 2) não há o que recomendar: volta para lá.
  useEffect(() => { if (pronto && !nivel) router.replace('/onboarding/nivel') }, [pronto, nivel, router])

  if (!pronto || !nivel) return <PassoShell passo={4} titulo="Seu plano" voltar="/onboarding/frequencia"><div className="skeleton" /></PassoShell>

  const dias = config.metaSemanal
  const plano = planoDoOnboarding(nivel, dias)
  const meta = metaDoOnboarding(nivel, dias)
  const liberado = planoDeTreinoLiberado(plano.id)
  const acessoDoPlano = NOME_DO_ACESSO[recurso(RECURSO_DO_PLANO_DE_TREINO[plano.id]).nivelMinimo]

  const comecar = async () => {
    if (salvando) return
    setSalvando(true)
    atualizarConfig({ metaSemanal: meta, onboardingFeito: true })
    escolherPlano(plano.id)
    // Antes de abrir o app, tenta levar tudo para a conta. Sem rede, segue assim mesmo: o que ficou pendente é enviado depois.
    await Promise.race([repo.reenviarAgora().catch(() => {}), new Promise(resolve => setTimeout(resolve, ESPERA_MAXIMA_MS))])
    router.replace('/hoje')
  }

  return (
    <PassoShell passo={4} titulo="Este é o plano ideal para você" subtitulo="Escolhido pelo seu nível e pelos dias que você pode treinar." voltar="/onboarding/frequencia">
      <article className={estilos.plano} aria-label={`Plano ${plano.nome}`}>
        <div className={estilos.planoTopo}>
          <h2 className={estilos.planoNome}>{plano.nome}</h2>
          <span className="nivel-badge">{plano.nivelLabel}</span>
        </div>
        <div className={estilos.metas}>
          <span className={estilos.meta}><i className="ph-fill ph-calendar-check" aria-hidden="true" />{plano.semanas} semanas</span>
          <span className={estilos.meta}><i className="ph-fill ph-boxing-glove" aria-hidden="true" />{plano.diasPorSemana}× por semana</span>
        </div>
        <p className={estilos.planoResumo}>{plano.resumo}</p>
        <p className={estilos.descricao}>{resumoRounds(plano)}</p>
      </article>

      {dias < plano.diasPorSemana && (
        <p className={estilos.aviso}>Este plano pede {plano.diasPorSemana}× por semana e você marcou {dias}×. Faça as sessões que der: a sua meta semanal ficará em {meta}×.</p>
      )}
      {dias > plano.diasPorSemana && (
        <p className={estilos.aviso}>Este plano tem {plano.diasPorSemana} sessões por semana, então a sua meta semanal ficará em {meta}×. Nos outros dias, treine livremente e registre pelo botão +.</p>
      )}
      {!liberado && (
        <p className={estilos.aviso}>Este plano faz parte da assinatura {acessoDoPlano}. Você começa no plano gratuito e pode ativar o teste grátis de {TESTE_GRATIS_DIAS} dias, sem cartão, na tela Assinatura.</p>
      )}

      <div className={estilos.acoes}>
        <button type="button" className="btn-primary" onClick={() => void comecar()} disabled={salvando} aria-busy={salvando}>
          {salvando ? 'Salvando…' : <>Começar agora <i className="ph-bold ph-arrow-right" aria-hidden="true" /></>}
        </button>
      </div>
    </PassoShell>
  )
}
