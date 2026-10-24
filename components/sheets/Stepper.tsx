import estilos from './Stepper.module.css'

/** Contador com botões de menos e mais, entre `min` e `max`, de `passo` em `passo`. `formatar` muda como o valor aparece (ex.: 90 -> 01:30). */
export default function Stepper({ label, value, unit, min, max, onChange, passo = 1, formatar }: { label: string; value: number; unit: string; min: number; max: number; onChange: (n: number) => void; passo?: number; formatar?: (n: number) => string }) {
  return (
    <div className={estilos.stepper}>
      <span className={estilos.rotulo}>{label}</span>
      <div className={estilos.controles}>
        <button onClick={() => onChange(Math.max(min, value - passo))} disabled={value <= min} aria-label={`Diminuir ${label}`} className={estilos.botao}><i className="ph-bold ph-minus" /></button>
        <span className={estilos.valor}>{formatar ? formatar(value) : value} <small>{unit}</small></span>
        <button onClick={() => onChange(Math.min(max, value + passo))} disabled={value >= max} aria-label={`Aumentar ${label}`} className={estilos.botao}><i className="ph-bold ph-plus" /></button>
      </div>
    </div>
  )
}
