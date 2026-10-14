import type { ReactNode } from 'react'
import animacoes from '../animacoes.module.css'
import comum from './comum.module.css'
import estilos from './SheetFrame.module.css'

/** Moldura dos painéis que sobem de baixo da tela: fundo escuro, título, voltar e fechar. */
export default function SheetFrame({ title, onBack, onClose, children }: { title: string; onBack?: () => void; onClose: () => void; children: ReactNode }) {
  return (
    <div onClick={onClose} className={`${estilos.fundo} ${animacoes.aparecer}`}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()} className={`${estilos.painel} ${animacoes.subir}`}>
        <div className={estilos.alca} />
        <div className={estilos.cabecalho}>
          {onBack && <button onClick={onBack} aria-label="Voltar" className={comum.botaoIcone}><i className="ph-bold ph-caret-left" /></button>}
          <h2 className={estilos.titulo}>{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className={comum.botaoIcone}><i className="ph-bold ph-x" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
