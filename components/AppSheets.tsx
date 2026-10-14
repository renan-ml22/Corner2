'use client'

import { ReactNode, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCorner } from './CornerProvider'
import { PLANOS, getPlano, resumoRounds, type Plano } from '@/data/planos'
import { cargaDaSessao } from '@/lib/saude'
import { nivelDoAtleta, urlTreino } from '@/lib/sessao'
import {
  CAT_LABELS, IMPACTO_LABEL, INTENSIDADE_LABEL,
  type Experiencia, type ImpactoCabeca, type Intensidade, type Postura, type RegType,
} from '@/lib/tipos'

const RED = 'oklch(0.63 0.21 25)'
const MUTED = 'var(--color-neutral-400)'

const TYPES: { id: RegType; icon: string; desc: string }[] = [
  { id: 'tec', icon: 'ph-target',       desc: 'Sombra, manopla, saco' },
  { id: 'con', icon: 'ph-heartbeat',    desc: 'Corda, circuito, corrida' },
  { id: 'spa', icon: 'ph-boxing-glove', desc: 'Rounds com parceiro' },
]

const primaryBtn: React.CSSProperties = { width: '100%', height: 52, borderRadius: 16, border: 0, cursor: 'pointer', background: `linear-gradient(145deg, oklch(0.66 0.21 25), oklch(0.55 0.21 25))`, color: '#f4f2f2', fontSize: 16, fontWeight: 600 }
const ghostBtn: React.CSSProperties = { width: '100%', height: 48, borderRadius: 16, border: '1px solid var(--color-neutral-700)', cursor: 'pointer', background: 'transparent', color: 'var(--color-text)', fontSize: 15, fontWeight: 600 }
const iconBtn: React.CSSProperties = { width: 36, height: 36, borderRadius: 12, border: 0, cursor: 'pointer', background: 'var(--color-neutral-800)', color: 'var(--color-text)', fontSize: 18, display: 'grid', placeItems: 'center' }
const optionCard = (ativo: boolean): React.CSSProperties => ({ display: 'grid', gap: 2, padding: '14px 16px', borderRadius: 16, cursor: 'pointer', textAlign: 'left', color: 'var(--color-text)', background: 'var(--color-neutral-800)', border: `1px solid ${ativo ? RED : 'transparent'}` })

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

/** Escolha única entre poucas opções (rádio). */
function Segmentos<T extends string>({ rotulo, valor, opcoes, onChange }: { rotulo: string; valor: T; opcoes: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="seg">
      {opcoes.map(o => (
        <button key={o.id} type="button" role="radio" aria-checked={valor === o.id} className={valor === o.id ? 'ativo' : ''} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  )
}

// ── Onboarding ───────────────────────────────────────────────

type Objetivo = 'condicionamento' | 'tecnica' | 'competir'

function recomendarPlano(exp: Experiencia, obj: Objetivo): Plano {
  const id =
    exp === 'nenhuma' || exp === 'ate1' ? 'fundamentos'
    : obj === 'condicionamento' ? 'base-aerobica'
    : exp === 'mais3' && obj === 'competir' ? 'pre-competicao'
    : 'tecnica-avancada'
  return getPlano(id) ?? PLANOS[0]
}

function Onboarding() {
  const { closeSheet, atualizarConfig, escolherPlano, openPlanos, showToast } = useCorner()
  const [passo, setPasso] = useState(0)
  const [postura, setPostura] = useState<Postura>('ortodoxo')
  const [exp, setExp] = useState<Experiencia>('ate1')
  const [obj, setObj] = useState<Objetivo>('tecnica')
  const [dias, setDias] = useState(3)
  const total = 5

  const plano = recomendarPlano(exp, obj)
  const metaFinal = Math.min(dias, plano.diasPorSemana)

  const concluir = (abrirLista: boolean) => {
    atualizarConfig({ postura, experiencia: exp, onboardingFeito: true, metaSemanal: metaFinal })
    if (abrirLista) { openPlanos(); return }
    escolherPlano(plano.id)
    closeSheet()
    showToast(`Perfil salvo. Plano ${plano.nome} ativado`)
  }

  return (
    <SheetFrame title="Perfil de atleta" onBack={passo > 0 ? () => setPasso(p => p - 1) : undefined} onClose={closeSheet}>
      <p style={{ fontSize: 13, color: MUTED, marginBottom: 14 }}>Passo {passo + 1} de {total}</p>

      {passo === 0 && (
        <>
          <p style={{ fontSize: 15, marginBottom: 12 }}>Qual é a sua postura? Ela define qual mão fica à frente nas orientações.</p>
          <div style={{ display: 'grid', gap: 10 }}>
            <button onClick={() => { setPostura('ortodoxo'); setPasso(1) }} style={optionCard(postura === 'ortodoxo')}><strong>Ortodoxo</strong><span style={{ fontSize: 13, color: MUTED }}>Mão e pé esquerdos à frente (comum em destros)</span></button>
            <button onClick={() => { setPostura('canhoto'); setPasso(1) }} style={optionCard(postura === 'canhoto')}><strong>Canhoto</strong><span style={{ fontSize: 13, color: MUTED }}>Mão e pé direitos à frente</span></button>
          </div>
        </>
      )}

      {passo === 1 && (
        <>
          <p style={{ fontSize: 15, marginBottom: 12 }}>Há quanto tempo você treina boxe?</p>
          <div style={{ display: 'grid', gap: 10 }}>
            {([['nenhuma', 'Nunca treinei'], ['ate1', 'Menos de 1 ano'], ['1a3', '1 a 3 anos'], ['mais3', 'Mais de 3 anos ou já compito']] as [Experiencia, string][]).map(([id, label]) => (
              <button key={id} onClick={() => { setExp(id); setPasso(2) }} style={optionCard(exp === id)}><strong>{label}</strong></button>
            ))}
          </div>
        </>
      )}

      {passo === 2 && (
        <>
          <p style={{ fontSize: 15, marginBottom: 12 }}>Qual é o seu objetivo principal?</p>
          <div style={{ display: 'grid', gap: 10 }}>
            {([['condicionamento', 'Condicionamento', 'Fôlego, resistência e saúde'], ['tecnica', 'Técnica', 'Evoluir golpes, defesa e combinações'], ['competir', 'Competir', 'Preparar para lutas e sparrings']] as [Objetivo, string, string][]).map(([id, label, desc]) => (
              <button key={id} onClick={() => { setObj(id); setPasso(3) }} style={optionCard(obj === id)}><strong>{label}</strong><span style={{ fontSize: 13, color: MUTED }}>{desc}</span></button>
            ))}
          </div>
        </>
      )}

      {passo === 3 && (
        <>
          <p style={{ fontSize: 15, marginBottom: 12 }}>Quantos dias por semana você consegue treinar?</p>
          <Stepper label="Dias por semana" value={dias} unit="" min={2} max={6} onChange={setDias} />
          <button onClick={() => setPasso(4)} style={{ ...primaryBtn, marginTop: 18 }}>Ver plano recomendado</button>
        </>
      )}

      {passo === 4 && (
        <>
          <p style={{ fontSize: 15, marginBottom: 12 }}>Para o seu perfil, recomendo:</p>
          <div style={{ ...optionCard(true), gap: 8 }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><strong style={{ fontSize: 18 }}>{plano.nome}</strong><span className="nivel-badge">{plano.nivelLabel}</span></span>
            <span style={{ fontSize: 13, color: 'var(--color-neutral-300)', lineHeight: 1.45 }}>{plano.resumo}</span>
            <span style={{ fontSize: 12, color: MUTED }}>{plano.semanas} semanas · {plano.diasPorSemana}× por semana · {resumoRounds(plano)}</span>
          </div>
          {dias < plano.diasPorSemana && (
            <p style={{ fontSize: 13, color: 'oklch(0.82 0.13 85)', margin: '12px 0 0', lineHeight: 1.45 }}>
              Este plano pede {plano.diasPorSemana}× por semana e você marcou {dias}×. Faça as sessões que der: sua meta semanal ficará em {metaFinal}×.
            </p>
          )}
          <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
            <button onClick={() => concluir(false)} style={primaryBtn}>Ativar este plano</button>
            <button onClick={() => concluir(true)} style={ghostBtn}>Ver outros planos</button>
          </div>
        </>
      )}
    </SheetFrame>
  )
}

// ── Sheets ───────────────────────────────────────────────────

export default function AppSheets() {
  const router = useRouter()
  const {
    sheet, setSheet, closeSheet, regType, setRegType, rounds, setRounds, roundMin, setRoundMin, rpe, setRpe, extras, setExtras,
    saveWorkout, elapsed, ultimoSalvo, viaCronometro, showToast, planoAtivo, plano, config, escolherPlano, alertas,
  } = useCorner()

  if (sheet === 'onboarding') return <Onboarding />

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
    const iniciarCronometro = () => {
      closeSheet()
      router.push(urlTreino({ tipo: regType, rounds, minPorRound: roundMin, descansoSeg: 60, nivel: nivelDoAtleta(plano, config.experiencia) }))
    }
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

        {regType === 'spa' && (
          <div style={{ marginTop: 22, display: 'grid', gap: 14 }}>
            <div>
              <p style={{ fontSize: 15, color: 'var(--color-neutral-300)', marginBottom: 8 }}>Intensidade do sparring</p>
              <Segmentos<Intensidade> rotulo="Intensidade do sparring" valor={extras.intensidade} onChange={v => setExtras({ intensidade: v })}
                opcoes={(['leve', 'moderada', 'forte'] as Intensidade[]).map(id => ({ id, label: INTENSIDADE_LABEL[id] }))} />
            </div>
            <div>
              <p style={{ fontSize: 15, color: 'var(--color-neutral-300)', marginBottom: 8 }}>Pancadas na cabeça</p>
              <Segmentos<ImpactoCabeca> rotulo="Pancadas na cabeça" valor={extras.cabeca} onChange={v => setExtras({ cabeca: v })}
                opcoes={(['nenhum', 'leves', 'fortes'] as ImpactoCabeca[]).map(id => ({ id, label: IMPACTO_LABEL[id] }))} />
              <p style={{ fontSize: 12, color: MUTED, marginTop: 6 }}>Esse registro ajuda o app a avisar quando você precisa se afastar do sparring.</p>
            </div>
            <input className="field-input" placeholder="Parceiro de sparring (opcional)" maxLength={60} value={extras.parceiro} onChange={e => setExtras({ parceiro: e.target.value })} aria-label="Parceiro de sparring" />
          </div>
        )}

        <textarea className="field-input" style={{ marginTop: 18, minHeight: 72, resize: 'vertical' }} placeholder="Anotações: o que funcionou? O que ajustar?" maxLength={280} value={extras.nota} onChange={e => setExtras({ nota: e.target.value })} aria-label="Anotações do treino" />

        <div style={{ margin: '18px 0 14px', fontSize: 14, color: MUTED, textAlign: 'center' }}>
          Total: <strong style={{ color: 'var(--color-text)' }}>{Math.round(rounds * roundMin * 10) / 10} min</strong> de trabalho
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <button onClick={saveWorkout} style={primaryBtn}>Salvar treino</button>
          {!viaCronometro && <button onClick={iniciarCronometro} style={ghostBtn}><i className="ph-fill ph-timer" /> Treinar agora com cronômetro</button>}
        </div>
      </SheetFrame>
    )
  }

  if (sheet === 'done') {
    const finish = () => { closeSheet(); showToast('Treino salvo no seu histórico') }
    const cabecaForte = ultimoSalvo?.sparring?.cabeca === 'fortes'
    return (
      <SheetFrame title="Concluído" onClose={finish}>
        <div style={{ textAlign: 'center', padding: '8px 0 20px' }}>
          <div style={{ width: 84, height: 84, borderRadius: 28, margin: '0 auto 18px', display: 'grid', placeItems: 'center', fontSize: 44, color: '#f4f2f2', background: `linear-gradient(145deg, oklch(0.66 0.21 25), oklch(0.55 0.21 25))`, boxShadow: '0 10px 24px oklch(0.63 0.21 25 / 0.45)', animation: 'pop 0.45s ease-out' }}>
            <i className="ph-bold ph-check" />
          </div>
          <h3 style={{ fontSize: 22, fontWeight: 700 }}>Treino registrado!</h3>
          <p style={{ fontSize: 14, color: MUTED, marginTop: 6 }}>Tempo de treino: {Math.floor(elapsed / 60)} min {String(elapsed % 60).padStart(2, '0')} s</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
          {[
            { v: rounds, l: 'rounds' },
            { v: ultimoSalvo ? cargaDaSessao(ultimoSalvo) : rounds * roundMin * rpe, l: 'carga' },
            { v: rpe, l: 'RPE' },
          ].map(s => (
            <div key={s.l} style={{ padding: '14px 8px', borderRadius: 16, background: 'var(--color-neutral-800)', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{s.v}</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
        {cabecaForte && (
          <div role="alert" style={{ display: 'flex', gap: 10, padding: 14, borderRadius: 14, marginBottom: 18, background: 'oklch(0.63 0.21 25 / 0.12)', border: '1px solid oklch(0.63 0.21 25 / 0.3)', fontSize: 13, lineHeight: 1.5 }}>
            <i className="ph-fill ph-first-aid" style={{ fontSize: 20, color: RED, flex: 'none' }} />
            <span>Você levou pancadas fortes na cabeça. Evite sparring pelos próximos 7 dias. Se tiver dor de cabeça persistente, tontura, náusea, visão turva ou confusão, procure atendimento médico.</span>
          </div>
        )}
        <button onClick={finish} style={primaryBtn}>Concluir</button>
      </SheetFrame>
    )
  }

  if (sheet === 'notif') {
    const ROTULO = { critico: 'Crítico', atencao: 'Atenção', info: 'Informação' } as const
    const COR = { critico: RED, atencao: 'oklch(0.8 0.14 85)', info: 'oklch(0.7 0.14 258)' } as const
    return (
      <SheetFrame title="Alertas" onClose={closeSheet}>
        {alertas.length === 0 ? (
          <div style={{ padding: '16px 4px 8px', textAlign: 'center', color: MUTED, fontSize: 14, lineHeight: 1.5 }}>
            <i className="ph-fill ph-check-circle" style={{ fontSize: 36, color: 'var(--color-green)', display: 'block', marginBottom: 8 }} />
            Tudo certo por aqui. Os alertas aparecem quando a carga sobe rápido, há lesões ativas ou pancadas fortes na cabeça.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {alertas.map(a => (
              <div key={a.id} style={{ display: 'flex', gap: 12, padding: 16, borderRadius: 16, background: 'var(--color-neutral-800)', borderLeft: `3px solid ${COR[a.nivel]}` }}>
                <i className={`ph-fill ${a.icone}`} style={{ fontSize: 22, color: COR[a.nivel], flex: 'none' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: COR[a.nivel] }}>{ROTULO[a.nivel]}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{a.titulo}</div>
                  <p style={{ fontSize: 13, color: MUTED, marginTop: 4, lineHeight: 1.45 }}>{a.texto}</p>
                </div>
              </div>
            ))}
          </div>
        )}
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
