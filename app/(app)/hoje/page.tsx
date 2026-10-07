"use client";

import Link from "next/link";
import ChecklistCard from "@/components/ChecklistCard";
import SessaoCard from "@/components/SessaoCard";
import StreakCard from "@/components/StreakCard";
import { useCorner } from "@/components/CornerProvider";
import { formatarDataLonga, nomeDoMes } from "@/lib/datas";
import { CAT_ICONS, CAT_LABELS } from "@/lib/tipos";
import {
  diasTreinadosNaSemana, proximaSessao, semanaAtualDoPlano, sequenciaDeSemanas,
  sessaoDeHoje, sugestaoSemPlano, treinosNaSemanaAtual,
} from "@/lib/treinos";

export default function HojePage() {
  const { pronto, usuario, historico, plano, planoAtivo, config, checklistHoje, toggleChecklist, openRegister, openPlanos } = useCorner();

  if (!pronto) return <main className="page-container" aria-busy="true"><div className="skeleton" /></main>;

  const hoje = new Date();
  const primeiroNome = usuario.nome.split(" ")[0];
  const dataLonga = formatarDataLonga(hoje);
  const semanaPlano = plano && planoAtivo ? semanaAtualDoPlano(planoAtivo, hoje) : 0;
  const planoConcluido = !!plano && semanaPlano > plano.semanas;
  const daHoje = plano && planoAtivo ? sessaoDeHoje(plano, planoAtivo, historico, hoje) : null;
  const proxima = plano && planoAtivo ? proximaSessao(plano, planoAtivo, historico, hoje) : null;
  // Não repete no card "próxima" a sessão que já está em destaque como sessão de hoje.
  const proximaDepoisDeHoje = proxima && daHoje && proxima.sessao.id === daHoje.sessao.id ? null : proxima;

  const sugestao = sugestaoSemPlano(historico, hoje);
  const feitosSemana = treinosNaSemanaAtual(historico, hoje);

  return (
    <main className="page-container">
      <header>
        <p className="eyebrow">{dataLonga}</p>
        <h1 className="page-title">Bom treino, {primeiroNome}.</h1>
      </header>

      <div className="section-heading">
        <h2>Sua semana</h2>
        <span>{nomeDoMes(hoje)}</span>
      </div>
      <StreakCard
        sequencia={sequenciaDeSemanas(historico, config.metaSemanal, hoje)}
        feitosSemana={feitosSemana}
        meta={config.metaSemanal}
        dias={diasTreinadosNaSemana(historico, hoje)}
        hojeIndex={(hoje.getDay() + 6) % 7}
      />

      {/* ── Treino de hoje ─────────────────────────────── */}
      <div className="section-heading">
        <h2>Treino de hoje</h2>
        {plano && !planoConcluido && <span>{plano.nome} · semana {semanaPlano}/{plano.semanas}</span>}
      </div>

      {!plano && (
        <>
          <section className="surface-card sessao-card destaque">
            <div className="sessao-body">
              <span className="tipo-icon" aria-hidden="true"><i className={`ph-fill ${CAT_ICONS[sugestao.tipo]}`} /></span>
              <div>
                <h3>Sugestão: {CAT_LABELS[sugestao.tipo]}</h3>
                <p className="sessao-meta">{sugestao.rounds} rounds de {sugestao.minPorRound} min</p>
              </div>
            </div>
            <p className="sessao-descricao">{sugestao.motivo}</p>
            <button type="button" className="btn-primary" onClick={() => openRegister({ tipo: sugestao.tipo, rounds: sugestao.rounds, minPorRound: sugestao.minPorRound })}>
              <i className="ph-bold ph-plus" aria-hidden="true" /> Registrar treino
            </button>
          </section>
          <button type="button" className="surface-card cta-card" onClick={openPlanos}>
            <i className="ph-fill ph-calendar-dots" aria-hidden="true" />
            <span><strong>Escolha um plano de treino</strong><small>Sessões montadas para cada dia da semana.</small></span>
            <i className="ph-bold ph-caret-right" aria-hidden="true" />
          </button>
        </>
      )}

      {plano && planoConcluido && (
        <section className="surface-card empty-state">
          <i className="ph-fill ph-trophy" aria-hidden="true" />
          <h3>Plano {plano.nome} concluído!</h3>
          <p>Você completou as {plano.semanas} semanas. Escolha o próximo desafio.</p>
          <button type="button" className="btn-primary" onClick={openPlanos}>Escolher novo plano</button>
        </section>
      )}

      {daHoje && (
        <>
          <SessaoCard
            item={daHoje}
            destaque
            onRegistrar={() => openRegister({ tipo: daHoje.sessao.tipo, rounds: daHoje.sessao.rounds, minPorRound: daHoje.sessao.minPorRound })}
          />
          <div style={{ height: 12 }} />
          <ChecklistCard
            titulo={daHoje.sessao.titulo}
            subtitulo={`${CAT_LABELS[daHoje.sessao.tipo]} · ${daHoje.sessao.rounds * daHoje.sessao.minPorRound} min de rounds`}
            icone={CAT_ICONS[daHoje.sessao.tipo]}
            itens={daHoje.sessao.checklist.map((label, i) => ({ id: `${daHoje.sessao.id}:${i}`, label }))}
            marcados={checklistHoje}
            onToggle={toggleChecklist}
          />
        </>
      )}

      {plano && !planoConcluido && !daHoje && (
        <section className="surface-card empty-state">
          <i className="ph-fill ph-moon-stars" aria-hidden="true" />
          <h3>Dia de descanso</h3>
          <p>Seu plano não tem sessão hoje. Recuperar também é treino.</p>
          <button type="button" className="btn-ghost" onClick={() => openRegister()}>Registrar um treino extra</button>
        </section>
      )}

      {/* ── Próxima sessão ─────────────────────────────── */}
      {proximaDepoisDeHoje && (
        <>
          <div className="section-heading">
            <h2>Próxima sessão</h2>
            <Link href="/plano" className="link-muted">Ver plano</Link>
          </div>
          <SessaoCard item={proximaDepoisDeHoje} detalhado />
        </>
      )}
    </main>
  );
}
