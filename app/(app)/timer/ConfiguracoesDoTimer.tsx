'use client'

import { useId } from 'react'
import SheetFrame from '@/components/sheets/SheetFrame'
import Stepper from '@/components/sheets/Stepper'
import { LIMITES, type ConfigTimer } from '@/lib/timer'
import estilos from './configuracoes.module.css'
import TempoEmMinutosESegundos from './TempoEmMinutosESegundos'

interface Linha {
  id: 'preparo' | 'vibracao' | 'segundoPlano'
  titulo: string
  detalhe: string
}

const LINHAS: Linha[] = [
  { id: 'preparo', titulo: 'Preparação de 10 s', detalhe: 'Contagem regressiva antes do 1º round' },
  { id: 'vibracao', titulo: 'Vibração ao trocar de fase', detalhe: 'Só em aparelhos que permitem (não funciona no iPhone)' },
  { id: 'segundoPlano', titulo: 'Manter o som com a tela bloqueada', detalhe: 'Mostra um controle na tela de bloqueio. Pode pausar a música de outros apps' },
]

/** Painel de ajustes do Timer. Cada mudança é guardada na hora, neste aparelho. */
export default function ConfiguracoesDoTimer({ config, alterar, aoFechar }: { config: ConfigTimer; alterar: (p: Partial<ConfigTimer>) => void; aoFechar: () => void }) {
  const idVolume = useId()
  return (
    <SheetFrame title="Configurações do timer" onClose={aoFechar}>
      <div className={estilos.grade}>
        <Stepper label="Rounds" value={config.rounds} unit="" min={LIMITES.rounds.min} max={LIMITES.rounds.max} onChange={rounds => alterar({ rounds })} />
        <TempoEmMinutosESegundos titulo="round" valor={config.roundSeg} limites={LIMITES.roundSeg} onChange={roundSeg => alterar({ roundSeg })} />
        <TempoEmMinutosESegundos titulo="descanso" valor={config.descansoSeg} limites={LIMITES.descansoSeg} onChange={descansoSeg => alterar({ descansoSeg })} />

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
