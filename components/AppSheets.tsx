'use client'

import { ReactNode } from 'react'
import { useCorner, CAT_LABELS, RegType } from './CornerProvider'
import { PLANOS, resumoRounds } from '@/data/planos'

const RED = 'oklch(0.63 0.21 25)'
const MUTED = 'var(--color-neutral-400)'

const TYPES: { id: RegType; icon: string; desc: string }[] = [
  { id: 'tec', icon: 'ph-target',       desc: 'Sombra, manopla, saco' },
  { id: 'con', icon: 'ph-heartbeat',    desc: 'Corda, circuito, corrida' },
  { id: 'spa', icon: 'ph-boxing-glove', desc: 'Rounds com parceiro' },
]

const primaryBtn: React.CSSProperties = { width: '100%', height: 52, borderRadius: 16, border: 0, cursor: 'pointer', background: `linear-gradient(145deg, oklch(0.66 0.21 25), oklch(0.55 0.21 25))`, color: '#f4f2f2', fontSize: 16, fontWeight: 600 }
const iconBtn: React.CSSProperties = { width: 36, height: 36, borderRadius: 12, border: 0, cursor: 'pointer', background: 'var(--color-neutral-800)', color: 'var(--color-text)', fontSize: 18, display: 'grid', placeItems: 'center' }

function SheetFrame({ title, onBack, onClose, children }: { title: string; onBack?: () => void; onClose: () => void; children: ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 20, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', animation: 'fadeIn 0.2s' }}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, margin: '0 auto', maxHeight: '88vh', overflowY: 'auto', background: 'var(--color-surface)', borderRadius: '24px 24px 0 0', borderTop: '1px solid oklch(1 0 0 / 0.08)', padding: '10px 20px max(24px, env(safe-area-inset-bottom))', boxShadow: 'var(--shadow-lg)', animation: 'sheetUp 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
        <div style={{ width: 40, height: 5, borderRadius: 3, background: 'var(--color-neutral-600)', margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          {onBack && <button onClick={onBack} aria-label="Voltar" style={iconBtn}><i className="ph-bold ph-caret-left" /></button>}
          <h2 style={{ flex: 1, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</h2>
          <button onClick={onClose} aria-label="Fechar" style={iconBtn}><i className="ph-bold ph-x" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Stepper({ label, value, unit, min, max, onChange }: { label: string; value: number; unit: string; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 16, background: 'var(--color-neutral-800)' }}>
      <span style={{ fontSize: 15, color: 'var(--color-neutral-300)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Diminuir ${label}`} style={{ ...iconBtn, background: 'var(--color-neutral-700)', opacity: value <= min ? 0.4 : 1 }}><i className="ph-bold ph-minus" /></button>
        <span style={{ minWidth: 56, textAlign: 'center', fontSize: 18, fontWeight: 700 }}>{value} <small style={{ fontSize: 12, color: MUTED, fontWeight: 500 }}>{unit}</small></span>
        <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`Aumentar ${label}`} style={{ ...iconBtn, background: 'var(--color-neutral-700)', opacity: value >= max ? 0.4 : 1 }}><i className="ph-bold ph-plus" /></button>
      </div>
    </div>
  )
}

export default function AppSheets() {
  const { sheet, setSheet, closeSheet, regType, setRegType, rounds, setRounds, roundMin, setRoundMin, rpe, setRpe, saveWorkout, elapsed, showToast, autoAdjust, adjustAccepted, setAdjustAccepted, planoAtivo, escolherPlano } = useCorner()

  if (sheet === 'type') {
    return (
      <SheetFrame title="Registrar treino" onClose={closeSheet}>
        <p style={{ fontSize: 14, color: MUTED, marginBottom: 14 }}>O que você treinou?</p>
        <div style={{ display: 'grid', gap: 10 }}>
          {TYPES.map(t => (
            <button key={t.id} onClick={() => { setRegType(t.id); setSheet('details') }} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, cursor: 'pointer', textAlign: 'left', color: 'var(--color-text)', background: 'var(--color-neutral-800)', border: `1px solid ${regType === t.id ? RED : 'transparent'}` }}>
              <span style={{ width: 44, height: 44, borderRadius: 14, display: 'grid', placeItems: 'center', fontSize: 22, color: RED, background: 'oklch(0.63 0.21 25 / 0.14)' }}><i className={`ph-fill ${t.icon}`} /></span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 16, fontWeight: 600 }}>{CAT_LABELS[t.id]}</span>
                <span style={{ display: 'block', fontSize: 13, color: MUTED, marginTop: 2 }}>{t.desc}</span>
              </span>
              <i className="ph-bold ph-caret-right" style={{ color: MUTED }} />
            </button>
          ))}
        </div>
      </SheetFrame>
    )
  }

  if (sheet === 'details') {
    return (
      <SheetFrame title={CAT_LABELS[regType]} onBack={() => setSheet('type')} onClose={closeSheet}>
        <div style={{ display: 'grid', gap: 10 }}>
          <Stepper label="Rounds" value={rounds} unit="" min={1} max={15} onChange={setRounds} />
          <Stepper label="Duração do round" value={roundMin} unit="min" min={1} max={5} onChange={setRoundMin} />
        </div>
        <div style={{ marginTop: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <span style={{ fontSize: 15, color: 'var(--color-neutral-300)' }}>Esforço percebido (RPE)</span>
            <span style={{ fontSize: 18, fontWeight: 700 }}>{rpe}<small style={{ fontSize: 12, color: MUTED }}>/10</small></span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 5 }}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
              <button key={n} onClick={() => setRpe(n)} aria-pressed={n === rpe} style={{ height: 38, borderRadius: 10, border: 0, cursor: 'pointer', fontSize: 14, fontWeight: 600, background: n <= rpe ? `oklch(0.63 0.21 25 / ${0.25 + n * 0.075})` : 'var(--color-neutral-800)', color: n <= rpe ? '#f4f2f2' : MUTED }}>{n}</button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: MUTED, marginTop: 6 }}>
            <span>Leve</span><span>Máximo</span>
          </div>
        </div>
        <div style={{ margin: '22px 0 14px', fontSize: 14, color: MUTED, textAlign: 'center' }}>
          Total: <strong style={{ color: 'var(--color-text)' }}>{rounds * roundMin} min</strong> de trabalho
        </div>
        <button onClick={saveWorkout} style={primaryBtn}>Salvar treino</button>
      </SheetFrame>
    )
  }

  if (sheet === 'done') {
    const finish = () => { closeSheet(); showToast('Treino salvo no seu histórico') }
    return (
      <SheetFrame title="Concluído" onClose={finish}>
        <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
          <div style={{ width: 84, height: 84, borderRadius: 28, margin: '0 auto 18px', display: 'grid', placeItems: 'center', fontSize: 44, color: '#f4f2f2', background: `linear-gradient(145deg, oklch(0.66 0.21 25), oklch(0.55 0.21 25))`, boxShadow: '0 10px 24px oklch(0.63 0.21 25 / 0.45)', animation: 'pop 0.45s ease-out' }}>
            <i className="ph-bold ph-check" />
          </div>
          <h3 style={{ fontSize: 22, fontWeight: 700 }}>Treino registrado!</h3>
          <p style={{ fontSize: 14, color: MUTED, marginTop: 6 }}>Registrado em {elapsed}s — direto do corner.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
          {[
            { v: rounds, l: 'rounds' },
            { v: rounds * roundMin, l: 'min' },
            { v: rpe, l: 'RPE' },
          ].map(s => (
            <div key={s.l} style={{ padding: '14px 8px', borderRadius: 16, background: 'var(--color-neutral-800)', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{s.v}</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
        <button onClick={finish} style={primaryBtn}>Concluir</button>
      </SheetFrame>
    )
  }

  if (sheet === 'notif') {
    return (
      <SheetFrame title="Notificações" onClose={closeSheet}>
        <div style={{ display: 'grid', gap: 10 }}>
          {autoAdjust && (
            <div style={{ padding: 16, borderRadius: 16, background: 'var(--color-neutral-800)' }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <i className="ph-fill ph-sparkle" style={{ fontSize: 22, color: RED }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>Ajuste no plano sugerido</div>
                  <p style={{ fontSize: 13, color: MUTED, marginTop: 4, lineHeight: 1.45 }}>Seu último sparring teve RPE alto. Sugerimos trocar o condicionamento de amanhã por técnica leve.</p>
                </div>
              </div>
              {adjustAccepted ? (
                <div style={{ marginTop: 12, fontSize: 13, color: 'var(--color-green)', display: 'flex', alignItems: 'center', gap: 6 }}><i className="ph-fill ph-check-circle" /> Ajuste aplicado</div>
              ) : (
                <button onClick={() => { setAdjustAccepted(true); showToast('Plano ajustado') }} style={{ ...primaryBtn, height: 40, fontSize: 14, marginTop: 12, borderRadius: 12 }}>Aceitar ajuste</button>
              )}
            </div>
          )}
          <div style={{ padding: 16, borderRadius: 16, background: 'var(--color-neutral-800)', display: 'flex', gap: 12 }}>
            <i className="ph-fill ph-fire" style={{ fontSize: 22, color: 'oklch(0.75 0.16 60)' }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Sequência em alta</div>
              <p style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>Você treinou 5 dias seguidos. Continue assim!</p>
            </div>
          </div>
        </div>
      </SheetFrame>
    )
  }

  if (sheet === 'planos') {
    const escolher = (id: string, nome: string) => {
      if (planoAtivo?.planoId === id) { closeSheet(); return }
      if (planoAtivo && !window.confirm(`Trocar para o plano ${nome}? O plano atual será substituído e a semana 1 começa agora.`)) return
      escolherPlano(id)
      closeSheet()
      showToast(`Plano ${nome} ativado`)
    }
    return (
      <SheetFrame title="Escolher plano" onClose={closeSheet}>
        <p style={{ fontSize: 14, color: MUTED, marginBottom: 14 }}>A semana 1 começa nesta segunda-feira.</p>
        <div style={{ display: 'grid', gap: 10 }}>
          {PLANOS.map(p => {
            const ativo = planoAtivo?.planoId === p.id
            return (
              <button key={p.id} onClick={() => escolher(p.id, p.nome)} aria-pressed={ativo} style={{ display: 'grid', gap: 8, padding: 16, borderRadius: 16, cursor: 'pointer', textAlign: 'left', color: 'var(--color-text)', background: 'var(--color-neutral-800)', border: `1px solid ${ativo ? RED : 'transparent'}` }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ fontSize: 17, fontWeight: 650 }}>{p.nome}</span>
                  {ativo
                    ? <span style={{ fontSize: 12, fontWeight: 600, color: RED, display: 'inline-flex', alignItems: 'center', gap: 4 }}><i className="ph-fill ph-check-circle" /> Ativo</span>
                    : <span className="nivel-badge">{p.nivelLabel}</span>}
                </span>
                <span style={{ fontSize: 13, color: 'var(--color-neutral-300)', lineHeight: 1.45 }}>{p.resumo}</span>
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <span className="chip"><i className="ph ph-calendar-blank" /> {p.semanas} semanas</span>
                  <span className="chip"><i className="ph ph-repeat" /> {p.diasPorSemana}× por semana</span>
                  <span className="chip"><i className="ph ph-timer" /> {resumoRounds(p)}</span>
                </span>
              </button>
            )
          })}
        </div>
      </SheetFrame>
    )
  }

  return null
}
