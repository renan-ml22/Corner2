'use client'

import { useRouter } from 'next/navigation'
import { usePlano } from '@/hooks/usePlano'
import { usePreferencias } from '@/hooks/usePreferencias'
import { nivelDoAtleta, urlTreino } from '@/lib/sessao'
import { CAT_LABELS, IMPACTO_LABEL, INTENSIDADE_LABEL, type ImpactoCabeca, type Intensidade } from '@/lib/tipos'
import { usePainelAcoes, usePainelEstado } from '../PainelProvider'
import comum from './comum.module.css'
import estilos from './RegistroDetalhes.module.css'
import Segmentos from './Segmentos'
import SheetFrame from './SheetFrame'
import Stepper from './Stepper'

/** Segundo passo do registro: rounds, duração, esforço, anotações e, no sparring, os dados do combate. */
export default function RegistroDetalhes() {
  const router = useRouter()
  const { setSheet, closeSheet } = usePainelAcoes()
  const { regType, rounds, setRounds, roundMin, setRoundMin, rpe, setRpe, extras, setExtras, saveWorkout, viaCronometro } = usePainelEstado()
  const { plano } = usePlano()
  const { config } = usePreferencias()

  const iniciarCronometro = () => {
    closeSheet()
    router.push(urlTreino({ tipo: regType, rounds, minPorRound: roundMin, descansoSeg: 60, nivel: nivelDoAtleta(plano, config.experiencia) }))
  }

  return (
    <SheetFrame title={CAT_LABELS[regType]} onBack={() => setSheet('type')} onClose={closeSheet}>
      <div className={comum.grade}>
        <Stepper label="Rounds" value={rounds} unit="" min={1} max={15} onChange={setRounds} />
        <Stepper label="Duração do round" value={roundMin} unit="min" min={1} max={5} onChange={setRoundMin} />
      </div>

      <div className={estilos.esforco}>
        <div className={estilos.esforcoTopo}>
          <span className={estilos.rotulo}>Esforço percebido (RPE)</span>
          <span className={estilos.esforcoValor}>{rpe}<small>/10</small></span>
        </div>
        <div className={estilos.escala}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
            <button
              key={n}
              onClick={() => setRpe(n)}
              aria-pressed={n === rpe}
              className={`${estilos.nivel} ${n <= rpe ? estilos.nivelLigado : ''}`}
              style={n <= rpe ? { background: `oklch(0.63 0.21 25 / ${0.25 + n * 0.075})` } : undefined}
            >{n}</button>
          ))}
        </div>
        <div className={estilos.extremos}>
          <span>Leve</span><span>Máximo</span>
        </div>
      </div>

      {regType === 'spa' && (
        <div className={estilos.sparring}>
          <div>
            <p className={estilos.pergunta}>Intensidade do sparring</p>
            <Segmentos<Intensidade> rotulo="Intensidade do sparring" valor={extras.intensidade} onChange={v => setExtras({ intensidade: v })}
              opcoes={(['leve', 'moderada', 'forte'] as Intensidade[]).map(id => ({ id, label: INTENSIDADE_LABEL[id] }))} />
          </div>
          <div>
            <p className={estilos.pergunta}>Pancadas na cabeça</p>
            <Segmentos<ImpactoCabeca> rotulo="Pancadas na cabeça" valor={extras.cabeca} onChange={v => setExtras({ cabeca: v })}
              opcoes={(['nenhum', 'leves', 'fortes'] as ImpactoCabeca[]).map(id => ({ id, label: IMPACTO_LABEL[id] }))} />
            <p className={estilos.ajuda}>Esse registro ajuda o app a avisar quando você precisa se afastar do sparring.</p>
          </div>
          <input className="field-input" placeholder="Parceiro de sparring (opcional)" maxLength={60} value={extras.parceiro} onChange={e => setExtras({ parceiro: e.target.value })} aria-label="Parceiro de sparring" />
        </div>
      )}

      <textarea className={`field-input ${estilos.nota}`} placeholder="Anotações: o que funcionou? O que ajustar?" maxLength={280} value={extras.nota} onChange={e => setExtras({ nota: e.target.value })} aria-label="Anotações do treino" />

      <div className={estilos.total}>
        Total: <strong>{Math.round(rounds * roundMin * 10) / 10} min</strong> de trabalho
      </div>
      <div className={comum.grade}>
        <button onClick={saveWorkout} className={comum.primario}>Salvar treino</button>
        {!viaCronometro && <button onClick={iniciarCronometro} className={comum.fantasma}><i className="ph-fill ph-timer" /> Treinar agora com cronômetro</button>}
      </div>
    </SheetFrame>
  )
}
