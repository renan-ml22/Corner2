'use client'
import { useToastTexto } from '@/hooks/useToast'
import animacoes from './animacoes.module.css'
import estilos from './Toast.module.css'

export default function Toast() {
  const toast = useToastTexto()
  if (!toast) return null
  return (
    <div role="status" className={`${estilos.aviso} ${animacoes.aparecer}`}>
      <i className={`ph-fill ph-check-circle ${estilos.icone}`} />
      {toast}
    </div>
  )
}
