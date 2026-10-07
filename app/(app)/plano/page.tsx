"use client";

import { useState } from "react";
import SessaoCard from "@/components/SessaoCard";
import { useCorner } from "@/components/CornerProvider";
import { sessoesDaSemana } from "@/data/planos";
import { formatarDataCurta, somarDias } from "@/lib/datas";
import { proximaSessao, segundaDaSemanaDoPlano, semanaAtualDoPlano, sessoesComStatus } from "@/lib/treinos";

export default function PlanoPage() {
  const { pronto, plano, planoAtivo, historico, openPlanos, openRegister, encerrarPlano, showToast } = useCorner();
  // null = acompanhar a semana atual
  const [semanaEscolhida, setSemanaEscolhida] = useState<number | null>(null);

  if (!pronto) return <main className="page-container" aria-busy="true"><div className="skeleton" /></main>;

  if (!plano || !planoAtivo) {
    return (
      <main className="page-container">
        <header>
          <p className="eyebrow">Sua rotina</p>
          <h1 className="page-title">Plano de treino</h1>
          <p className="muted-copy">Escolha um plano e o Corner monta suas sessões semana a semana.</p>
        </header>
        <section className="surface-card empty-state" style={{ marginTop: 28 }}>
          <i className="ph-fill ph-calendar-dots" aria-hidden="true" />
          <h3>Nenhum plano ativo</h3>
          <p>São 4 planos, do iniciante à pré-competição.</p>
          <button type="button" className="btn-primary" onClick={openPlanos}>Escolher plano</button>
        </section>
      </main>
    );
  }

  const hoje = new Date();
  const semanaAtual = semanaAtualDoPlano(planoAtivo, hoje);
  const semanaPadrao = Math.min(Math.max(semanaAtual, 1), plano.semanas);
  const semana = semanaEscolhida ?? semanaPadrao;
  const segunda = segundaDaSemanaDoPlano(planoAtivo, semana);
  const sessoes = sessoesComStatus(plano, planoAtivo, semana, historico, hoje);
  const proxima = proximaSessao(plano, planoAtivo, historico, hoje);

  // Progresso no plano: sessões feitas até agora / total de sessões do plano.
  let total = 0;
  let feitas = 0;
  for (let s = 1; s <= plano.semanas; s++) {
    total += sessoesDaSemana(plano, s).length;
    if (s <= semanaAtual) feitas += sessoesComStatus(plano, planoAtivo, s, historico, hoje).filter(x => x.status === "feita").length;
  }
  const pct = total ? Math.round((feitas / total) * 100) : 0;
  const concluido = semanaAtual > plano.semanas;

  const rotuloSemana = semana === semanaAtual ? "Esta semana" : semana === semanaAtual + 1 ? "Próxima semana" : semana < semanaAtual ? "Semana passada" : "Semana futura";

  return (
    <main className="page-container">
      <header>
        <p className="eyebrow">Sua rotina</p>
        <h1 className="page-title">Plano de treino</h1>
      </header>

      <section className="surface-card plano-hero" style={{ marginTop: 22 }}>
        <div className="plano-hero-top">
          <div>
            <span className="nivel-badge">{plano.nivelLabel}</span>
            <h2>{plano.nome}</h2>
            <p>{plano.diasPorSemana}× por semana · {plano.semanas} semanas</p>
          </div>
          <button type="button" className="btn-ghost small" onClick={openPlanos}>Trocar</button>
        </div>
        <div className="plano-progresso">
          <span>{concluido ? "Plano concluído" : `Semana ${Math.max(semanaAtual, 1)} de ${plano.semanas}`}</span>
          <span>{feitas}/{total} sessões · {pct}%</span>
        </div>
        <div className="progress-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
      </section>

      {proxima && (
        <>
          <div className="section-heading"><h2>Próximo treino</h2></div>
          <SessaoCard
            item={proxima}
            destaque
            onRegistrar={() => openRegister({ tipo: proxima.sessao.tipo, rounds: proxima.sessao.rounds, minPorRound: proxima.sessao.minPorRound })}
          />
        </>
      )}

      <div className="week-selector" role="group" aria-label="Semana do plano">
        <button type="button" onClick={() => setSemanaEscolhida(Math.max(1, semana - 1))} disabled={semana <= 1} aria-label="Semana anterior">
          <i className="ph-bold ph-caret-left" />
        </button>
        <div>
          <strong>Semana {semana} de {plano.semanas}</strong>
          <span>{rotuloSemana} · {formatarDataCurta(segunda)} – {formatarDataCurta(somarDias(segunda, 6))}</span>
        </div>
        <button type="button" onClick={() => setSemanaEscolhida(Math.min(plano.semanas, semana + 1))} disabled={semana >= plano.semanas} aria-label="Próxima semana">
          <i className="ph-bold ph-caret-right" />
        </button>
      </div>

      <div className="sessao-list">
        {sessoes.map(item => (
          <SessaoCard key={item.sessao.id} item={item} detalhado />
        ))}
      </div>

      <button
        type="button"
        className="link-danger"
        onClick={() => {
          if (!window.confirm(`Encerrar o plano ${plano.nome}? Seus treinos registrados continuam salvos.`)) return;
          encerrarPlano(); setSemanaEscolhida(null); showToast("Plano encerrado");
        }}
      >
        Encerrar plano
      </button>
    </main>
  );
}
