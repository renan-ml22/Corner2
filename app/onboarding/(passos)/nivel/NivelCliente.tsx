'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PassoShell from '@/components/onboarding/PassoShell'
import estilos from '@/components/onboarding/onboarding.module.css'
import { useHidratado } from '@/hooks/useEntidade'
import { usePreferencias } from '@/hooks/usePreferencias'
import { aoTeclarNoGrupo } from '@/lib/teclado'
import { NIVEIS, experienciaDoNivel, nivelDaExperiencia, type Nivel } from '@/lib/onboarding'

/** Passo 2: o nível da pessoa no boxe. Fica salvo na configuração (experiência) e segue para a frequência. */
export default function NivelCliente() {
  const router = useRouter()
  const pronto = useHidratado()
  const { configSalva, atualizarConfig } = usePreferencias()
  // `undefined` = ainda não clicou: vale o que já estava salvo (quem volta a este passo vê a escolha anterior).
  const [clicado, setClicado] = useState<Nivel | undefined>(undefined)
  const nivel = clicado ?? nivelDaExperiencia(configSalva.experiencia)

  const continuar = () => {
    if (!nivel) return
    atualizarConfig({ experiencia: experienciaDoNivel(nivel) })
    router.push('/onboarding/frequencia')
  }

  return (
    <PassoShell passo={2} titulo="Qual é o seu nível no boxe?" subtitulo="Isso nos ajuda a escolher o plano certo para você. Dá para mudar depois.">
      {!pronto ? <div className="skeleton" /> : (
        <>
          <div role="radiogroup" aria-labelledby="titulo-do-passo" className={estilos.opcoes} onKeyDown={e => aoTeclarNoGrupo(e, 'radio')}>
            {NIVEIS.map((n, i) => {
              const ativo = nivel === n.id
              return (
                <button key={n.id} type="button" role="radio" aria-checked={ativo} tabIndex={ativo || (!nivel && i === 0) ? 0 : -1} className={`${estilos.opcao} ${ativo ? estilos.opcaoAtiva : ''}`} onClick={() => setClicado(n.id)}>
                  <span className={estilos.icone} aria-hidden="true"><i className={`ph-fill ${n.icone}`} /></span>
                  <span className={estilos.textos}><strong>{n.titulo}</strong><span className={estilos.descricao}>{n.descricao}</span></span>
                  <span className={estilos.marca} aria-hidden="true"><i className="ph-bold ph-check" /></span>
                </button>
              )
            })}
          </div>
          <div className={estilos.acoes}>
            <button type="button" className="btn-primary" disabled={!nivel} onClick={continuar}>Continuar <i className="ph-bold ph-arrow-right" aria-hidden="true" /></button>
            {!nivel && <p className={estilos.dica}>Escolha uma opção para continuar.</p>}
          </div>
        </>
      )}
    </PassoShell>
  )
}
