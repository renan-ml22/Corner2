import { aoTeclarNoGrupo } from '@/lib/teclado'

/** Escolha única entre poucas opções (rádio). Usa o estilo global `.seg`, que a tela de saúde também usa. */
export default function Segmentos<T extends string>({ rotulo, valor, opcoes, onChange }: { rotulo: string; valor: T; opcoes: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="seg" onKeyDown={e => aoTeclarNoGrupo(e, 'radio')}>
      {opcoes.map(o => (
        <button key={o.id} type="button" role="radio" aria-checked={valor === o.id} tabIndex={valor === o.id ? 0 : -1} className={valor === o.id ? 'ativo' : ''} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  )
}
