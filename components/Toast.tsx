'use client'
import { useCorner } from './CornerProvider'

export default function Toast() {
  const { toast } = useCorner()
  if (!toast) return null
  return (
    <div role="status" style={{ position: 'fixed', left: 20, right: 20, top: 'calc(16px + env(safe-area-inset-top))', zIndex: 30, padding: '12px 14px', borderRadius: 14, background: 'var(--color-neutral-800)', border: '1px solid oklch(1 0 0 / 0.08)', boxShadow: 'var(--shadow-lg)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, animation: 'fadeIn 0.2s' }}>
      <i className="ph-fill ph-check-circle" style={{ fontSize: 20, color: 'var(--color-green)' }} />
      {toast}
    </div>
  )
}
