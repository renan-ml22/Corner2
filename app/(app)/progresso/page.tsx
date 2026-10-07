"use client";

import { useState } from "react";
import { useCorner } from "@/components/CornerProvider";
import { formatarDataCurta, nomeDoMes, somarDias } from "@/lib/datas";
import { CAT_ICONS, CAT_LABELS, TIPOS } from "@/lib/tipos";
import { estatisticasDoMes, volumeSemanal } from "@/lib/treinos";

function formatarMinutos(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${String(m).padStart(2, "0")}` : `${h}h`;
}

export default function ProgressoPage() {
  const { pronto, historico, openRegister } = useCorner();
  const [barraAtiva, setBarraAtiva] = useState<number | null>(null);

  if (!pronto) return <main className="page-container" aria-busy="true"><div className="skeleton" /></main>;

  const hoje = new Date();
  const mes = estatisticasDoMes(historico, hoje);
  const semanas = volumeSemanal(historico, hoje, 8);
  const maxRounds = Math.max(1, ...semanas.map(s => s.rounds));
  const maxTipo = Math.max(1, ...TIPOS.map(t => mes.porTipo[t]));
  const ordenado = [...historico].sort((a, b) => b.data.localeCompare(a.data));

  return (
    <main className="page-container">
      <header>
        <p className="eyebrow">O que você construiu</p>
        <h1 className="page-title">Seu progresso</h1>
      </header>

      <div className="section-heading">
        <h2>Resumo do mês</h2>
        <span>{nomeDoMes(hoje)}</span>
      </div>
      <div className="stat-grid">
        <section className="surface-card stat-card"><p className="stat-label">Treinos</p><p className="stat-value">{mes.treinos}</p></section>
        <section className="surface-card stat-card"><p className="stat-label">Rounds</p><p className="stat-value">{mes.rounds}</p></section>
        <section className="surface-card stat-card"><p className="stat-label">RPE médio</p><p className="stat-value">{mes.rpeMedio === null ? "—" : mes.rpeMedio.toFixed(1).replace(".", ",")}</p></section>
        <section className="surface-card stat-card"><p className="stat-label">Tempo de rounds</p><p className="stat-value">{formatarMinutos(mes.minutos)}</p></section>
      </div>

      {/* ── Volume semanal ─────────────────────────────── */}
      <div className="section-heading">
        <h2>Rounds por semana</h2>
        <span>Últimas 8 semanas</span>
      </div>
      <section className="surface-card chart-card">
        <div className="bar-chart" onMouseLeave={() => setBarraAtiva(null)}>
          {semanas.map((s, i) => {
            const altura = s.rounds ? Math.max(4, (s.rounds / maxRounds) * 100) : 0;
            const rotulo = `Semana de ${formatarDataCurta(s.segunda)}: ${s.rounds} rounds em ${s.treinos} ${s.treinos === 1 ? "treino" : "treinos"}`;
            return (
              <button
                type="button"
                key={i}
                className={`bar-col${s.atual ? " atual" : ""}${barraAtiva === i ? " ativa" : ""}`}
                onMouseEnter={() => setBarraAtiva(i)}
                onFocus={() => setBarraAtiva(i)}
                onBlur={() => setBarraAtiva(null)}
                aria-label={rotulo}
              >
                {(barraAtiva === i || (barraAtiva === null && s.atual && s.rounds > 0)) && (
                  <span className="bar-tip" role="tooltip">
                    <strong>{s.rounds} rounds</strong>
                    {barraAtiva === i && <small>{s.treinos} {s.treinos === 1 ? "treino" : "treinos"} · {formatarDataCurta(s.segunda)}</small>}
                  </span>
                )}
                <span className="bar-track"><span className="bar-fill" style={{ height: `${altura}%` }} /></span>
                <span className="bar-label">{s.atual ? "Atual" : formatarDataCurta(s.segunda).split(" ")[0]}</span>
              </button>
            );
          })}
        </div>
        <table className="sr-only">
          <caption>Rounds por semana</caption>
          <thead><tr><th>Semana</th><th>Rounds</th><th>Treinos</th></tr></thead>
          <tbody>
            {semanas.map((s, i) => (
              <tr key={i}><td>{formatarDataCurta(s.segunda)} – {formatarDataCurta(somarDias(s.segunda, 6))}</td><td>{s.rounds}</td><td>{s.treinos}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── Treinos por tipo ───────────────────────────── */}
      <div className="section-heading">
        <h2>Treinos por tipo</h2>
        <span>Neste mês</span>
      </div>
      <section className="surface-card tipo-bars">
        {TIPOS.map(t => (
          <div key={t} className="tipo-row">
            <span className="tipo-row-label"><i className={`ph-fill ${CAT_ICONS[t]}`} aria-hidden="true" /> {CAT_LABELS[t]}</span>
            <span className="tipo-row-track" aria-hidden="true">
              <span style={{ width: `${(mes.porTipo[t] / maxTipo) * 100}%` }} />
            </span>
            <span className="tipo-row-valor">{mes.porTipo[t]}</span>
          </div>
        ))}
      </section>

      {/* ── Histórico ──────────────────────────────────── */}
      <div className="section-heading">
        <h2>Histórico</h2>
        <span>{historico.length} {historico.length === 1 ? "treino" : "treinos"}</span>
      </div>
      {ordenado.length === 0 ? (
        <section className="surface-card empty-state">
          <i className="ph-fill ph-boxing-glove" aria-hidden="true" />
          <h3>Nenhum treino registrado</h3>
          <p>Registre seu primeiro treino e acompanhe a evolução aqui.</p>
          <button type="button" className="btn-primary" onClick={() => openRegister()}>Registrar treino</button>
        </section>
      ) : (
        <section className="surface-card">
          <ul className="historico-list">
            {ordenado.map(t => {
              const d = new Date(t.data);
              return (
                <li key={t.id}>
                  <span className="tipo-icon small" aria-hidden="true"><i className={`ph-fill ${CAT_ICONS[t.tipo]}`} /></span>
                  <div className="historico-info">
                    <strong>{CAT_LABELS[t.tipo]}</strong>
                    <span>{t.rounds} rounds de {t.minPorRound} min · RPE {t.rpe}</span>
                  </div>
                  <time dateTime={t.data}>
                    {formatarDataCurta(d)}
                    <small>{d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small>
                  </time>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
