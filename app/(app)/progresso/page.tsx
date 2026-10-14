"use client";

import { useState } from "react";
import { usePainelAcoes } from "@/components/PainelProvider";
import { useHidratado } from "@/hooks/useEntidade";
import { useHistorico } from "@/hooks/useHistorico";
import { formatarDataCurta, nomeDoMes, somarDias } from "@/lib/datas";
import { CAT_ICONS, CAT_LABELS, IMPACTO_LABEL, INTENSIDADE_LABEL, TIPOS } from "@/lib/tipos";
import { calcularCarga, STATUS_CARGA_TEXTO } from "@/lib/saude";
import { estatisticasDoMes, volumeSemanal } from "@/lib/treinos";

function formatarMinutos(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${String(m).padStart(2, "0")}` : `${h}h`;
}

export default function ProgressoPage() {
  const pronto = useHidratado();
  const { historico } = useHistorico();
  const { openRegister } = usePainelAcoes();
  const [barraAtiva, setBarraAtiva] = useState<number | null>(null);

  if (!pronto) return <main className="page-container" aria-busy="true"><div className="skeleton" /></main>;

  const hoje = new Date();
  const mes = estatisticasDoMes(historico, hoje);
  const semanas = volumeSemanal(historico, hoje, 8);
  const maxRounds = Math.max(1, ...semanas.map(s => s.rounds));
  const maxTipo = Math.max(1, ...TIPOS.map(t => mes.porTipo[t]));
  const ordenado = [...historico].sort((a, b) => b.data.localeCompare(a.data));
  const carga = calcularCarga(historico, hoje);

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

      {/* ── Carga de treino ────────────────────────────── */}
      <div className="section-heading">
        <h2>Carga de treino</h2>
        <span>Esforço × minutos</span>
      </div>
      <section className={`surface-card carga-card${carga ? ` carga-${carga.status}` : ""}`}>
        {carga ? (
          <>
            <div className="carga-topo">
              <i className={`ph-fill ${STATUS_CARGA_TEXTO[carga.status].icone}`} aria-hidden="true" />
              <div>
                <strong>{STATUS_CARGA_TEXTO[carga.status].titulo}</strong>
                <p>{STATUS_CARGA_TEXTO[carga.status].texto}</p>
              </div>
            </div>
            <div className="stat-grid" style={{ marginTop: 14 }}>
              <div><p className="stat-label">Últimos 7 dias</p><p className="stat-value">{carga.aguda}</p></div>
              <div><p className="stat-label">Média das semanas anteriores</p><p className="stat-value">{carga.cronica}</p></div>
            </div>
            <p className="muted-copy" style={{ marginTop: 12 }}>Razão: {carga.razao.toFixed(2).replace(".", ",")}×. A faixa ideal fica entre 0,8× e 1,3×; acima de 1,5× o risco de lesão cresce.</p>
          </>
        ) : (
          <p className="muted-copy">A carga precisa de pelo menos duas semanas de treinos registrados para ser comparada. Continue registrando.</p>
        )}
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
                    {t.sparring && (
                      <span>
                        Sparring {INTENSIDADE_LABEL[t.sparring.intensidade].toLowerCase()}
                        {t.sparring.cabeca !== "nenhum" ? ` · pancadas ${IMPACTO_LABEL[t.sparring.cabeca].toLowerCase()} na cabeça` : ""}
                        {t.sparring.parceiro ? ` · com ${t.sparring.parceiro}` : ""}
                      </span>
                    )}
                    {t.nota && <span className="nota-treino">“{t.nota}”</span>}
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
