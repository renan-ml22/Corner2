'use client'

import Stepper from '@/components/sheets/Stepper'
import { formatarTempo, juntarTempo, separarTempo } from '@/lib/timer'
import estilos from './configuracoes.module.css'

/**
 * Tempo em minutos (botões − e +) e segundos (barra de 0 a 59, de segundo em segundo). O total em segundos fica sempre
 * dentro dos limites: por exemplo, um round de 0 min não aceita menos de 10 s.
 */
export default function TempoEmMinutosESegundos({ titulo, valor, limites, onChange }: {
  /** "round" ou "descanso": entra nos nomes "Minutos do round", "Segundos do descanso" */
  titulo: 'round' | 'descanso'
  valor: number
  limites: { min: number; max: number }
  onChange: (segundos: number) => void
}) {
  const { minutos, segundos } = separarTempo(valor)
  return (
    <div className={estilos.bloco}>
      <div className={estilos.tempoTopo}>
        <p className={estilos.titulo}>{titulo === 'round' ? 'Tempo do round' : 'Descanso entre rounds'}</p>
        <span className={estilos.tempoTotal}>{formatarTempo(valor)}</span>
      </div>
      <Stepper
        label={`Minutos do ${titulo}`}
        value={minutos}
        unit="min"
        min={Math.floor(limites.min / 60)}
        max={Math.floor(limites.max / 60)}
        onChange={m => onChange(juntarTempo(m, segundos, limites))}
      />
      <div className={estilos.volumeTopo}>
        <span className={estilos.titulo} aria-hidden="true">Segundos</span>
        <span aria-hidden="true">{segundos} s</span>
      </div>
      <input
        type="range"
        min={0}
        max={59}
        step={1}
        value={segundos}
        className={estilos.volume}
        aria-label={`Segundos do ${titulo}`}
        aria-valuetext={`${segundos} segundos`}
        onChange={e => onChange(juntarTempo(minutos, Number(e.target.value), limites))}
      />
    </div>
  )
}
