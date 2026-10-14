import estilos from './Stepper.module.css'

/** Contador com botões de menos e mais, entre `min` e `max`. */
export default function Stepper({ label, value, unit, min, max, onChange }: { label: string; value: number; unit: string; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className={estilos.stepper}>
      <span className={estilos.rotulo}>{label}</span>
      <div className={estilos.controles}>
        <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Diminuir ${label}`} className={estilos.botao}><i className="ph-bold ph-minus" /></button>
        <span className={estilos.valor}>{value} <small>{unit}</small></span>
        <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`Aumentar ${label}`} className={estilos.botao}><i className="ph-bold ph-plus" /></button>
      </div>
    </div>
  )
}
