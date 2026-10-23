'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PassoShell from '@/components/onboarding/PassoShell'
import estilos from '@/components/onboarding/onboarding.module.css'
import { useHidratado } from '@/hooks/useEntidade'
import { usePreferencias } from '@/hooks/usePreferencias'
import { aoTeclarNoGrupo } from '@/lib/teclado'
import { OPCOES_DE_DIAS } from '@/lib/onboarding'

const diasSalvos = (meta: number | undefined) => OPCOES_DE_DIAS.find(d => d === meta)

/** Passo 3: quantos dias por semana a pessoa consegue treinar. Fica salvo como meta semanal e segue para o plano. */
export default function FrequenciaCliente() {
  const router = useRouter()
  const pronto = useHidratado()
  const { config, configSalva, atualizarConfig } = usePreferencias()
  const [clicado, setClicado] = useState<number | undefined>(undefined)
  const dias = clicado ?? diasSalvos(configSalva.metaSemanal)

  // Sem o nível (passo 2) não dá para recomendar um plano: volta para lá.
  useEffect(() => { if (pronto && config.experiencia === null) router.replace('/onboarding/nivel') }, [pronto, config.experiencia, router])

  const continuar = () => {
    if (!dias) return
    atualizarConfig({ metaSemanal: dias })
    router.push('/onboarding/plano')
  }

  return (
    <PassoShell passo={3} titulo="Quantos dias por semana você pode treinar?" subtitulo="Seja realista: treinar menos dias com constância rende mais do que prometer demais." voltar="/onboarding/nivel">
      {!pronto ? <div className="skeleton" /> : (
        <>
          <div role="radiogroup" aria-labelledby="titulo-do-passo" className={estilos.grade} onKeyDown={e => aoTeclarNoGrupo(e, 'radio')}>
            {OPCOES_DE_DIAS.map((d, i) => {
              const ativo = dias === d
              return (
                <button key={d} type="button" role="radio" aria-checked={ativo} aria-label={`${d} dias por semana`} tabIndex={ativo || (!dias && i === 0) ? 0 : -1} className={`${estilos.opcao} ${estilos.dia} ${ativo ? estilos.opcaoAtiva : ''}`} onClick={() => setClicado(d)}>
                  <span className={estilos.marca} aria-hidden="true"><i className="ph-bold ph-check" /></span>
                  <span className={estilos.numero} aria-hidden="true">{d}</span>
                  <span className={estilos.unidade} aria-hidden="true">dias por semana</span>
                </button>
              )
            })}
          </div>
          <div className={estilos.acoes}>
            <button type="button" className="btn-primary" disabled={!dias} onClick={continuar}>Continuar <i className="ph-bold ph-arrow-right" aria-hidden="true" /></button>
            {!dias && <p className={estilos.dica}>Escolha uma opção para continuar.</p>}
          </div>
        </>
      )}
    </PassoShell>
  )
}
