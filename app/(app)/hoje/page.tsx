"use client";

import Link from "next/link";
import ChecklistCard from "@/components/ChecklistCard";
import CheckinCard from "@/components/CheckinCard";
import SessaoCard from "@/components/SessaoCard";
import StreakCard from "@/components/StreakCard";
import { useCorner } from "@/components/CornerProvider";
import { formatarDataLonga, nomeDoMes } from "@/lib/datas";
import { sugerirAjuste } from "@/lib/saude";
import { nivelDoAtleta, urlTreino } from "@/lib/sessao";
import { CAT_ICONS, CAT_LABELS } from "@/lib/tipos";
import {
  diasTreinadosNaSemana, proximaSessao, semanaAtualDoPlano, sequenciaDeSemanas,
  sessaoDeHoje, sugestaoSemPlano, treinosNaSemanaAtual,
} from "@/lib/treinos";

export default function HojePage() {
  const {
    pronto, usuario, historico, plano, planoAtivo, config, checklistHoje, toggleChecklist, reag, alertas, checkinHoje,
    ajusteAplicado, aplicarAjuste, openRegister, openPlanos, openNotif, openOnboarding,
  } = useCorner();

  if (!pronto) return <main className="page-container" aria-busy="true"><div className="skeleton" /></main>;

  const hoje = new Date();
  const primeiroNome = usuario.nome.split(" ")[0];
  const semanaPlano = plano && planoAtivo ? semanaAtualDoPlano(planoAtivo, hoje) : 0;
  const planoConcluido = !!plano && semanaPlano > plano.semanas;
  const daHoje = plano && planoAtivo ? sessaoDeHoje(plano, planoAtivo, historico, hoje, reag) : null;
  const proxima = plano && planoAtivo ? proximaSessao(plano, planoAtivo, historico, hoje, reag) : null;
  // Não repete no card "próxima" a sessão que já está em destaque como sessão de hoje.
  const proximaDepoisDeHoje = proxima && daHoje && proxima.sessao.id === daHoje.sessao.id ? null : proxima;

  const sugestao = sugestaoSemPlano(historico, hoje);
  const nivel = nivelDoAtleta(plano, config.experiencia);
  const avisos = alertas.filter(a => a.nivel !== "info").length;

  // O que a pessoa vai treinar hoje: a sessão do plano pendente ou, sem plano, a sugestão.
  const alvo = daHoje && daHoje.status !== "feita"
    ? { tipo: daHoje.sessao.tipo, rounds: daHoje.sessao.rounds, minPorRound: daHoje.sessao.minPorRound, descansoSeg: daHoje.sessao.descansoSeg, sessaoId: daHoje.sessao.id }
    : !plano
      ? { tipo: sugestao.tipo, rounds: sugestao.rounds, minPorRound: sugestao.minPorRound, descansoSeg: 60, sessaoId: undefined }
      : null;

  // Ajuste conforme o check-in: só vale depois que a pessoa aceita.
  const ajuste = alvo ? sugerirAjuste(checkinHoje, alvo.tipo, alvo.rounds) : null;
  const ajusteAtivo = !!ajuste && ajuste.nivel !== "normal" && ajusteAplicado;
  const efetivo = alvo && ajuste && ajusteAtivo ? { ...alvo, tipo: ajuste.tipo, rounds: ajuste.rounds } : alvo;
  const descansoDoDia = ajusteAtivo && ajuste?.nivel === "descanso";

  const hrefTreino = efetivo && !descansoDoDia ? urlTreino({ ...efetivo, nivel }) : undefined;
  const registrarEfetivo = efetivo && !descansoDoDia
    ? () => openRegister({ tipo: efetivo.tipo, rounds: efetivo.rounds, minPorRound: efetivo.minPorRound, sessaoId: efetivo.sessaoId })
    : undefined;

  return (
    <main className="page-container">
      <header className="hoje-header">
        <div>
          <p className="eyebrow">{formatarDataLonga(hoje)}</p>
          <h1 className="page-title">Bom treino, {primeiroNome}.</h1>
        </div>
        <button type="button" className="icon-btn" onClick={openNotif} aria-label={avisos > 0 ? `Alertas: ${avisos} novos` : "Alertas"}>
          <i className="ph ph-bell" aria-hidden="true" />
          {avisos > 0 && <span className="icon-badge" aria-hidden="true">{avisos}</span>}
        </button>
      </header>

      {!config.onboardingFeito && (
        <button type="button" className="surface-card cta-card destaque-cta" onClick={openOnboarding}>
          <i className="ph-fill ph-boxing-glove" aria-hidden="true" />
          <span><strong>Monte seu perfil de atleta</strong><small>Postura, experiência e o plano ideal para você, em 1 minuto.</small></span>
          <i className="ph-bold ph-caret-right" aria-hidden="true" />
        </button>
      )}

      <div className="section-heading"><h2>Como você está</h2></div>
      <CheckinCard />
      {ajuste && ajuste.nivel !== "normal" && (
        <section className={`surface-card ajuste-card nivel-${ajuste.nivel}`} aria-live="polite">
          <i className={`ph-fill ${ajuste.nivel === "descanso" ? "ph-moon-stars" : "ph-gauge"}`} aria-hidden="true" />
          <div>
            <strong>{ajuste.titulo}</strong>
            <p>{ajuste.motivo}</p>
            {ajuste.nivel !== "descanso" && !ajusteAplicado && <p className="ajuste-proposta">Sugestão: {CAT_LABELS[ajuste.tipo]} com {ajuste.rounds} rounds.</p>}
            <button type="button" className="btn-ghost small" onClick={() => aplicarAjuste(!ajusteAplicado)}>
              {ajusteAplicado ? "Voltar ao treino do plano" : ajuste.nivel === "descanso" ? "Descansar hoje" : "Aplicar ajuste"}
            </button>
          </div>
        </section>
      )}

      <div className="section-heading">
        <h2>Sua semana</h2>
        <span>{nomeDoMes(hoje)}</span>
      </div>
      <StreakCard
        sequencia={sequenciaDeSemanas(historico, config.metaSemanal, hoje)}
        feitosSemana={treinosNaSemanaAtual(historico, hoje)}
        meta={config.metaSemanal}
        dias={diasTreinadosNaSemana(historico, hoje)}
        hojeIndex={(hoje.getDay() + 6) % 7}
      />

      {/* ── Treino de hoje ─────────────────────────────── */}
      <div className="section-heading">
        <h2>Treino de hoje</h2>
        {plano && !planoConcluido && <span>{plano.nome} · semana {semanaPlano}/{plano.semanas}</span>}
      </div>

      {!plano && efetivo && (
        <>
          <section className="surface-card sessao-card destaque">
            <div className="sessao-body">
              <span className="tipo-icon" aria-hidden="true"><i className={`ph-fill ${CAT_ICONS[efetivo.tipo]}`} /></span>
              <div>
                <h3>Sugestão: {CAT_LABELS[efetivo.tipo]}</h3>
                <p className="sessao-meta">{efetivo.rounds} rounds de {efetivo.minPorRound} min</p>
              </div>
            </div>
            <p className="sessao-descricao">{sugestao.motivo}</p>
            {descansoDoDia ? (
              <p className="sessao-descricao"><strong>Hoje é dia de descanso.</strong> Volte amanhã com o corpo recuperado.</p>
            ) : (
              <div className="sessao-acoes">
                {hrefTreino && <Link href={hrefTreino} className="btn-primary"><i className="ph-fill ph-timer" aria-hidden="true" /> Iniciar com cronômetro</Link>}
                {registrarEfetivo && <button type="button" className="btn-ghost" onClick={registrarEfetivo}><i className="ph-bold ph-plus" aria-hidden="true" /> Registrar sem cronômetro</button>}
              </div>
            )}
          </section>
          {config.onboardingFeito && (
            <button type="button" className="surface-card cta-card" onClick={openPlanos}>
              <i className="ph-fill ph-calendar-dots" aria-hidden="true" />
              <span><strong>Escolha um plano de treino</strong><small>Sessões montadas para cada dia da semana.</small></span>
              <i className="ph-bold ph-caret-right" aria-hidden="true" />
            </button>
          )}
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
            item={efetivo && ajusteAtivo && daHoje.status !== "feita" ? { ...daHoje, sessao: { ...daHoje.sessao, tipo: efetivo.tipo, rounds: efetivo.rounds } } : daHoje}
            destaque
            iniciarHref={hrefTreino}
            onRegistrar={registrarEfetivo}
          />
          {descansoDoDia && <p className="muted-copy" style={{ marginTop: 10 }}>Você escolheu descansar hoje. O treino volta a aparecer se você desfizer o ajuste.</p>}
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

      <div className="section-heading"><h2>Para evoluir</h2></div>
      <div className="atalhos">
        <Link href="/tecnicas" className="surface-card cta-card">
          <i className="ph-fill ph-books" aria-hidden="true" />
          <span><strong>Biblioteca técnica</strong><small>Golpes, combinações e defesa</small></span>
          <i className="ph-bold ph-caret-right" aria-hidden="true" />
        </Link>
        <Link href="/saude" className="surface-card cta-card">
          <i className="ph-fill ph-heartbeat" aria-hidden="true" />
          <span><strong>Saúde e corpo</strong><small>Peso, lesões e pancadas na cabeça</small></span>
          <i className="ph-bold ph-caret-right" aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}
