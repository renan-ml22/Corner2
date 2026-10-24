'use client'

import { useRouter } from 'next/navigation'
import AtletaAvatar from '@/components/AtletaAvatar'
import TreinarComoAtleta from '@/components/TreinarComoAtleta'
import type { Atleta } from '@/data/atletas'
import { sessoesDaSemana } from '@/data/planos'
import { planoDoAtleta } from '@/data/planos-atletas'
import { CAT_LABELS } from '@/lib/tipos'
import estilos from './atleta.module.css'

const DIA_CURTO = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default function AtletaCliente({ atleta }: { atleta: Atleta }) {
  const router = useRouter()
  const plano = planoDoAtleta(atleta.id)
  const voltar = () => (window.history.length > 1 ? router.back() : router.push('/plano'))

  return (
    <main className="page-container">
      <button type="button" className={`link-muted ${estilos.voltar}`} onClick={voltar}>
        <i className="ph-bold ph-caret-left" aria-hidden="true" /> Voltar
      </button>

      <header className={estilos.cabecalho}>
        <AtletaAvatar atleta={atleta} grande />
        <div>
          <p className="eyebrow">{atleta.estilo}</p>
          <h1 className="page-title">{atleta.nome}</h1>
        </div>
      </header>

      <p className="muted-copy">{atleta.descricao}</p>

      <ul className={estilos.chips} aria-label="Características do estilo">
        {atleta.caracteristicas.map(c => <li key={c} className="chip">{c}</li>)}
      </ul>

      <div className="mt-22"><TreinarComoAtleta atleta={atleta} /></div>

      {plano && (
        <>
          <div className="section-heading">
            <h2>Plano de {plano.semanas} semanas <strong className={estilos.pro}>PRO</strong></h2>
            <span>{plano.diasPorSemana}× por semana · {plano.nivelLabel}</span>
          </div>
          <p className="muted-copy">{plano.resumo}</p>

          <div className={estilos.semanas}>
            {Array.from({ length: plano.semanas }, (_, i) => i + 1).map(semana => (
              <section key={semana} className={`surface-card ${estilos.semana}`} aria-labelledby={`semana-${semana}`}>
                <h3 id={`semana-${semana}`}>Semana {semana}</h3>
                <ul>
                  {sessoesDaSemana(plano, semana).map(s => (
                    <li key={s.id}>
                      <span className={estilos.dia}>{DIA_CURTO[s.diaSemana]}</span>
                      <span className={estilos.titulo}>{s.titulo}<small>{CAT_LABELS[s.tipo]}</small></span>
                      <span className={estilos.rounds}>{s.rounds} rounds</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      <p className={`muted-copy ${estilos.aviso}`}>
        Treino do Corner inspirado no estilo de luta de {atleta.nome}. Não é a rotina real do atleta, e o Corner não tem vínculo com ele.
      </p>
    </main>
  )
}
