"use client";

import { useState } from "react";
import SessaoCard from "@/components/SessaoCard";
import { usePainelAcoes } from "@/components/PainelProvider";
import { useHidratado } from "@/hooks/useEntidade";
import { useHistorico } from "@/hooks/useHistorico";
import { usePlano } from "@/hooks/usePlano";
import { usePreferencias } from "@/hooks/usePreferencias";
import { useToast } from "@/hooks/useToast";
import { sessoesDaSemana } from "@/data/planos";
import { formatarDataCurta, somarDias } from "@/lib/datas";
import { nivelDoAtleta, urlTreino } from "@/lib/sessao";
import { proximaSessao, segundaDaSemanaDoPlano, semanaAtualDoPlano, sessoesComStatus, type SessaoComStatus } from "@/lib/treinos";
import estilos from './plano.module.css'

export default function PlanoPage() {
  const pronto = useHidratado();
  const { plano, planoAtivo, reag, reagendar, encerrarPlano } = usePlano();
  const { historico } = useHistorico();
  const { config } = usePreferencias();
  const { openPlanos, openRegister } = usePainelAcoes();
  const showToast = useToast();
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
  const sessoes = sessoesComStatus(plano, planoAtivo, semana, historico, hoje, reag);
  const proxima = proximaSessao(plano, planoAtivo, historico, hoje, reag);
  const nivel = nivelDoAtleta(plano, config.experiencia);

  // Só dá para treinar ou mover o que ainda está pela frente (semana atual em diante).
  const params = (s: SessaoComStatus) => ({ tipo: s.sessao.tipo, rounds: s.sessao.rounds, minPorRound: s.sessao.minPorRound, descansoSeg: s.sessao.descansoSeg, sessaoId: s.sessao.id, nivel });
  const registrar = (s: SessaoComStatus) => () => openRegister({ tipo: s.sessao.tipo, rounds: s.sessao.rounds, minPorRound: s.sessao.minPorRound, sessaoId: s.sessao.id });

  // Progresso no plano: sessões feitas até agora / total de sessões do plano.
  let total = 0;
  let feitas = 0;
  for (let s = 1; s <= plano.semanas; s++) {
    total += sessoesDaSemana(plano, s).length;
    if (s <= semanaAtual) feitas += sessoesComStatus(plano, planoAtivo, s, historico, hoje, reag).filter(x => x.status === "feita").length;
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

      <section className={`surface-card ${estilos.planoHero}`} style={{ marginTop: 22 }}>
        <div className={estilos.planoHeroTop}>
          <div>
            <span className="nivel-badge">{plano.nivelLabel}</span>
            <h2>{plano.nome}</h2>
            <p>{plano.diasPorSemana}× por semana · {plano.semanas} semanas</p>
          </div>
          <button type="button" className="btn-ghost small" onClick={openPlanos}>Trocar</button>
        </div>
        <div className={estilos.planoProgresso}>
          <span>{concluido ? "Plano concluído" : `Semana ${Math.max(semanaAtual, 1)} de ${plano.semanas}`}</span>
          <span>{feitas}/{total} sessões · {pct}%</span>
        </div>
        <div className="progress-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
      </section>

      {proxima && (
        <>
          <div className="section-heading"><h2>Próximo treino</h2></div>
          <SessaoCard item={proxima} destaque iniciarHref={urlTreino(params(proxima))} onRegistrar={registrar(proxima)} />
        </>
      )}

      <div className={estilos.weekSelector} role="group" aria-label="Semana do plano">
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

      <div className={estilos.sessaoList}>
        {sessoes.map(item => {
          const aFazer = semana >= semanaAtual && (item.status === "hoje" || item.status === "futura");
          return (
            <SessaoCard
              key={item.sessao.id}
              item={item}
              detalhado
              iniciarHref={aFazer && item.status === "hoje" ? urlTreino(params(item)) : undefined}
              onRegistrar={semana === semanaAtual && (item.status === "hoje" || item.status === "perdida") ? registrar(item) : undefined}
              onReagendar={semana >= semanaAtual ? dia => reagendar(semana, item.sessao.id, dia) : undefined}
            />
          );
        })}
      </div>

      <button
        type="button"
        className={estilos.linkDanger}
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
