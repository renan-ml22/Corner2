'use client'

import { useId } from 'react'
import Segmentos from '@/components/sheets/Segmentos'
import SheetFrame from '@/components/sheets/SheetFrame'
import Stepper from '@/components/sheets/Stepper'
import { DESCANSOS_SEG, LIMITES, formatarTempo, rotuloDoDescanso, type ConfigTimer } from '@/lib/timer'
import estilos from './configuracoes.module.css'

interface Linha {
  id: 'preparo' | 'vibracao'
  titulo: string
  detalhe: string
}

const LINHAS: Linha[] = [
  { id: 'preparo', titulo: 'Preparação de 10 s', detalhe: 'Contagem regressiva antes do 1º round' },
  { id: 'vibracao', titulo: 'Vibração ao trocar de fase', detalhe: 'Só em aparelhos que permitem (não funciona no iPhone)' },
]

/** Painel de ajustes do Timer. Cada mudança é guardada na hora, neste aparelho. */
export default function ConfiguracoesDoTimer({ config, alterar, aoFechar }: { config: ConfigTimer; alterar: (p: Partial<ConfigTimer>) => void; aoFechar: () => void }) {
  const idVolume = useId()
  return (
    <SheetFrame title="Configurações do timer" onClose={aoFechar}>
      <div className={estilos.grade}>
        <Stepper label="Rounds" value={config.rounds} unit="" min={LIMITES.rounds.min} max={LIMITES.rounds.max} onChange={rounds => alterar({ rounds })} />
        <Stepper
          label="Tempo do round"
          value={config.roundSeg}
          unit=""
          min={LIMITES.roundSeg.min}
          max={LIMITES.roundSeg.max}
          passo={LIMITES.roundSeg.passo}
          formatar={formatarTempo}
          onChange={roundSeg => alterar({ roundSeg })}
        />

        <div className={estilos.bloco}>
          <p className={estilos.titulo}>Descanso entre rounds</p>
          <Segmentos
            rotulo="Descanso entre rounds"
            valor={String(config.descansoSeg)}
            opcoes={DESCANSOS_SEG.map(s => ({ id: String(s), label: rotuloDoDescanso(s) }))}
            onChange={v => alterar({ descansoSeg: Number(v) })}
          />
        </div>

        <ul className={estilos.linhas}>
          {LINHAS.map(l => (
            <li key={l.id}>
              <label htmlFor={`timer-${l.id}`} className={estilos.rotulo}>
                <span>{l.titulo}</span>
                <small>{l.detalhe}</small>
              </label>
              <input id={`timer-${l.id}`} type="checkbox" role="switch" className={estilos.interruptor} checked={config[l.id]} onChange={e => alterar({ [l.id]: e.target.checked })} />
            </li>
          ))}
        </ul>

        <div className={estilos.bloco}>
          <div className={estilos.volumeTopo}>
            <label htmlFor={idVolume} className={estilos.titulo}>Volume</label>
            <span aria-hidden="true">{config.mudo ? 'Mudo' : `${config.volume}%`}</span>
          </div>
          <input
            id={idVolume}
            type="range"
            min={0}
            max={100}
            step={5}
            value={config.volume}
            className={estilos.volume}
            aria-valuetext={config.mudo ? 'Mudo' : `${config.volume}%`}
            onChange={e => alterar({ volume: Number(e.target.value), mudo: false })}
          />
          <button type="button" className={estilos.mudo} aria-pressed={config.mudo} onClick={() => alterar({ mudo: !config.mudo })}>
            <i className={`ph-bold ${config.mudo ? 'ph-speaker-slash' : 'ph-speaker-high'}`} aria-hidden="true" /> Mudo
          </button>
        </div>

        <p className={estilos.dica}>Para mudar rounds e tempos, o timer precisa estar parado.</p>
      </div>
    </SheetFrame>
  )
}
