'use client'

import { useAlertas } from '@/hooks/useSaude'
import { usePainelAcoes } from '../PainelProvider'
import comum from './comum.module.css'
import estilos from './Alertas.module.css'
import SheetFrame from './SheetFrame'

const ROTULO = { critico: 'Crítico', atencao: 'Atenção', info: 'Informação' } as const

/** Lista dos alertas de saúde e de carga calculados para hoje. */
export default function Alertas() {
  const { closeSheet } = usePainelAcoes()
  const alertas = useAlertas()

  return (
    <SheetFrame title="Alertas" onClose={closeSheet}>
      {alertas.length === 0 ? (
        <div className={estilos.vazio}>
          <i className={`ph-fill ph-check-circle ${estilos.vazioIcone}`} />
          Tudo certo por aqui. Os alertas aparecem quando a carga sobe rápido, há lesões ativas ou pancadas fortes na cabeça.
        </div>
      ) : (
        <div className={comum.grade}>
          {alertas.map(a => (
            <div key={a.id} className={`${estilos.item} ${estilos[a.nivel]}`}>
              <i className={`ph-fill ${a.icone} ${estilos.icone}`} />
              <div className={estilos.corpo}>
                <div className={estilos.nivel}>{ROTULO[a.nivel]}</div>
                <div className={estilos.titulo}>{a.titulo}</div>
                <p className={estilos.texto}>{a.texto}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </SheetFrame>
  )
}
