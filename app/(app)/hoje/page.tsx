"use client";

import Link from "next/link";
import AtalhosDeEstilo from "@/components/AtalhosDeEstilo";
import ChecklistCard from "@/components/ChecklistCard";
import CheckinCard from "@/components/CheckinCard";
import SessaoCard from "@/components/SessaoCard";
import StreakCard from "@/components/StreakCard";
import { usePainelAcoes } from "@/components/PainelProvider";
import { useHidratado } from "@/hooks/useEntidade";
import { useHistorico } from "@/hooks/useHistorico";
import { usePlano } from "@/hooks/usePlano";
import { usePreferencias } from "@/hooks/usePreferencias";
import { useUsuario } from "@/hooks/useRepositorio";
import { useAlertas, useCheckins } from "@/hooks/useSaude";
import { formatarDataLonga, nomeDoMes } from "@/lib/datas";
import { sugerirAjuste } from "@/lib/saude";
import { nivelDoAtleta, urlTreino } from "@/lib/sessao";
import { CAT_ICONS, CAT_LABELS } from "@/lib/tipos";
import {
  diasTreinadosNaSemana, proximaSessao, semanaAtualDoPlano, sequenciaDeSemanas,
  sessaoDeHoje, sugestaoSemPlano, treinosNaSemanaAtual,
} from "@/lib/treinos";
import estilos from './hoje.module.css'
import estilosSessao from '@/components/SessaoCard.module.css'
import { ConviteAoPlano } from '@/components/ConviteAoPlano'
import SeloDoTreinador from '@/components/SeloDoTreinador'
import SugestaoDoTreinador from '@/components/SugestaoDoTreinador'
import { useSugestaoDoTreinador } from '@/hooks/useSugestaoDoTreinador'
import { treinadorDoPlano } from '@/lib/cornerman/sugestao-selo'
import { useAssinatura } from '@/hooks/useAssinatura'
import { RECURSO_DO_PLANO_DE_TREINO } from '@/lib/assinatura/catalogo'

// Cada nível de ajuste sugerido tem a sua cor; "normal" não tem destaque.
const CLASSE_NIVEL: Record<string, string> = { reduzir: estilos.nivelReduzir, leve: estilos.nivelLeve, descanso: estilos.nivelDescanso };

export default function HojePage() {
  const pronto = useHidratado();
  const usuario = useUsuario();
  const { historico } = useHistorico();
  const { plano, planoBloqueado, planoAtivo, checklistHoje, toggleChecklist, reag } = usePlano();
  const { podeUsar, pronto: assinaturaPronta } = useAssinatura();
  const { config } = usePreferencias();
  const alertas = useAlertas();
  const { checkinHoje, ajusteAplicado, aplicarAjuste } = useCheckins();
  const { openRegister, openPlanos, openNotif, openOnboarding } = usePainelAcoes();
  const sugestaoDoTreinador = useSugestaoDoTreinador();
  const treinadorDoPlanoAtivo = treinadorDoPlano(planoAtivo, sugestaoDoTreinador.aceita);

  if (!pronto || !assinaturaPronta) return <main className="page-container" aria-busy="true"><div className="skeleton" /></main>;

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
  const podeCheckin = podeUsar("checkin");
  const ajuste = alvo && podeCheckin ? sugerirAjuste(checkinHoje, alvo.tipo, alvo.rounds) : null;
  const ajusteAtivo = !!ajuste && ajuste.nivel !== "normal" && ajusteAplicado;
  const efetivo = alvo && ajuste && ajusteAtivo ? { ...alvo, tipo: ajuste.tipo, rounds: ajuste.rounds } : alvo;
  const descansoDoDia = ajusteAtivo && ajuste?.nivel === "descanso";

  const hrefTreino = efetivo && !descansoDoDia ? urlTreino({ ...efetivo, nivel }) : undefined;
  const registrarEfetivo = efetivo && !descansoDoDia
    ? () => openRegister({ tipo: efetivo.tipo, rounds: efetivo.rounds, minPorRound: efetivo.minPorRound, sessaoId: efetivo.sessaoId })
    : undefined;

  return (
    <main className="page-container">
      <header className={estilos.hojeHeader}>
        <div>
          <p className="eyebrow">{formatarDataLonga(hoje)}</p>
          <h1 className="page-title">Bom treino, {primeiroNome}.</h1>
        </div>
        <button type="button" className={estilos.iconBtn} onClick={openNotif} aria-label={avisos > 0 ? `Alertas: ${avisos} novos` : "Alertas"}>
          <i className="ph ph-bell" aria-hidden="true" />
          {avisos > 0 && <span className={estilos.iconBadge} aria-hidden="true">{avisos}</span>}
        </button>
      </header>

      {sugestaoDoTreinador.pendente && <SugestaoDoTreinador sugestao={sugestaoDoTreinador.pendente} aoResponder={sugestaoDoTreinador.respondida} />}

      {!config.onboardingFeito && (
        <button type="button" className={`surface-card cta-card ${estilos.destaqueCta}`} onClick={openOnboarding}>
          <i className="ph-fill ph-boxing-glove" aria-hidden="true" />
          <span><strong>Monte seu perfil de atleta</strong><small>Postura, experiência e o plano ideal para você, em 1 minuto.</small></span>
          <i className="ph-bold ph-caret-right" aria-hidden="true" />
        </button>
      )}

      <Link href="/quiz" className={`surface-card cta-card ${estilos.destaqueCta}`}>
        <i className="ph-fill ph-trophy" aria-hidden="true" />
        <span><strong>Qual é o seu estilo de lutador?</strong><small>Descubra com qual atleta você mais se parece. Clique aqui.</small></span>
        <i className="ph-bold ph-caret-right" aria-hidden="true" />
      </Link>

      <div className="section-heading"><h2>Como você está</h2></div>
      {podeCheckin ? <CheckinCard /> : <ConviteAoPlano recurso="checkin" compacto />}
      {ajuste && ajuste.nivel !== "normal" && (
        <section className={`surface-card ${estilos.ajusteCard} ${CLASSE_NIVEL[ajuste.nivel] ?? ''}`} aria-live="polite">
          <i className={`ph-fill ${ajuste.nivel === "descanso" ? "ph-moon-stars" : "ph-gauge"}`} aria-hidden="true" />
          <div>
            <strong>{ajuste.titulo}</strong>
            <p>{ajuste.motivo}</p>
            {ajuste.nivel !== "descanso" && !ajusteAplicado && <p className={estilos.ajusteProposta}>Sugestão: {CAT_LABELS[ajuste.tipo]} com {ajuste.rounds} rounds.</p>}
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

      {plano && !planoConcluido && treinadorDoPlanoAtivo && <p className="mb-12"><SeloDoTreinador nome={treinadorDoPlanoAtivo} /></p>}

      {planoBloqueado && <div className="mb-12"><ConviteAoPlano recurso={RECURSO_DO_PLANO_DE_TREINO[planoBloqueado.id]} /></div>}

      {!plano && efetivo && (
        <>
          <section className={`surface-card ${estilosSessao.sessaoCard} destaque`}>
            <div className={estilosSessao.sessaoBody}>
              <span className="tipo-icon" aria-hidden="true"><i className={`ph-fill ${CAT_ICONS[efetivo.tipo]}`} /></span>
              <div>
                <h3>Sugestão: {CAT_LABELS[efetivo.tipo]}</h3>
                <p className={estilosSessao.sessaoMeta}>{efetivo.rounds} rounds de {efetivo.minPorRound} min</p>
              </div>
            </div>
            <p className={estilosSessao.sessaoDescricao}>{sugestao.motivo}</p>
            {descansoDoDia ? (
              <p className={estilosSessao.sessaoDescricao}><strong>Hoje é dia de descanso.</strong> Volte amanhã com o corpo recuperado.</p>
            ) : (
              <div className={estilosSessao.sessaoAcoes}>
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
          {descansoDoDia && <p className="muted-copy mt-10">Você escolheu descansar hoje. O treino volta a aparecer se você desfizer o ajuste.</p>}
          <div className="espaco-12" />
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
        <AtalhosDeEstilo semQuiz />
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
