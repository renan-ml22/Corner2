'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Atleta } from '@/data/atletas'
import { idDoPlanoDoAtleta, planoDoAtleta } from '@/data/planos-atletas'
import { useAcesso } from '@/hooks/useAssinatura'
import { usePlano } from '@/hooks/usePlano'
import { useToast } from '@/hooks/useToast'
import { NOME_DO_ACESSO, recurso } from '@/lib/assinatura/catalogo'
import { TEXTOS } from '@/lib/textos'
import estilos from './TreinarComoAtleta.module.css'

/**
 * "Treinar como [Nome]": coloca o treino no estilo do atleta como plano ativo.
 * É um recurso Profissional: quem não tem o plano vê o botão trancado, com a etiqueta PRO e o caminho para assinar.
 */
export default function TreinarComoAtleta({ atleta }: { atleta: Atleta }) {
  const router = useRouter()
  const showToast = useToast()
  const { liberado, pronto } = useAcesso('treinosDeAtletas')
  const { planoAtivo, escolherPlano } = usePlano()
  const plano = planoDoAtleta(atleta.id)
  if (!plano) return null

  const nivel = NOME_DO_ACESSO[recurso('treinosDeAtletas').nivelMinimo]
  const rotulo = `Treinar como ${atleta.nome}`

  // Ainda não sabemos o plano da pessoa: não mostra "bloqueado" por engano.
  if (!pronto) return <div className={`skeleton ${estilos.esqueleto}`} aria-busy="true" />

  if (!liberado) {
    return (
      <section className={`surface-card ${estilos.trancado}`} aria-label={`${rotulo}: recurso do plano ${nivel}`}>
        <p className={estilos.linha}>
          <i className="ph-fill ph-lock-simple" aria-hidden="true" />
          <span className={estilos.rotulo}>{rotulo}</span>
          <span className={estilos.pro}>PRO</span>
        </p>
        <p className={estilos.explicacao}>Treino de 4 semanas no estilo de {atleta.nome}, disponível no plano {nivel}.</p>
        <Link href="/assinatura" className="btn-primary">Assinar Pro</Link>
      </section>
    )
  }

  if (planoAtivo?.planoId === plano.id) {
    return (
      <section className={`surface-card ${estilos.ativo}`}>
        <p className={estilos.linha}>
          <i className="ph-fill ph-check-circle" aria-hidden="true" />
          <span className={estilos.rotulo}>Este é o seu plano ativo</span>
        </p>
        <Link href="/plano" className="btn-primary">Ver meu plano</Link>
      </section>
    )
  }

  const treinar = () => {
    if (planoAtivo && !window.confirm(TEXTOS.confirmar.trocarPlano(plano.nome))) return
    escolherPlano(idDoPlanoDoAtleta(atleta.id))
    showToast(TEXTOS.aviso.planoAtivado(plano.nome))
    router.push('/plano')
  }

  return (
    <button type="button" className="btn-primary" onClick={treinar}>
      <i className="ph-fill ph-boxing-glove" aria-hidden="true" /> {rotulo}
      <span className={estilos.pro}>PRO</span>
    </button>
  )
}
