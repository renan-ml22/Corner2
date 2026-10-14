"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { usePainelAcoes } from "@/components/PainelProvider";
import { useHidratado } from "@/hooks/useEntidade";
import { usePlano } from "@/hooks/usePlano";
import { usePreferencias } from "@/hooks/usePreferencias";
import { PREPARO_SEG, useCronometro } from "@/hooks/useCronometro";
import { focoDosRounds, maoDaFrente, maoDeTras } from "@/data/tecnicas";
import { CAT_LABELS } from "@/lib/tipos";
import { lerParamsTreino, type ParamsTreino } from "@/lib/sessao";
import styles from "./treino.module.css";

function mmss(seg: number): string {
  const s = Math.max(0, Math.round(seg));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function TreinoCliente() {
  const q = useSearchParams();
  const params = useMemo(() => lerParamsTreino(new URLSearchParams(q.toString())), [q]);
  // `key` recria o cronômetro se os parâmetros mudarem (ex.: outra sessão na mesma tela).
  return <Cronometro key={q.toString()} params={params} />;
}

function Cronometro({ params }: { params: ParamsTreino }) {
  const pronto = useHidratado();
  const { plano } = usePlano();
  const { config } = usePreferencias();
  const { openRegister } = usePainelAcoes();
  const roundSeg = Math.max(3, Math.round(params.minPorRound * 60));
  const c = useCronometro({ rounds: params.rounds, roundSeg, descansoSeg: params.descansoSeg });
  const focos = useMemo(() => focoDosRounds(params.tipo, params.rounds, params.nivel), [params.tipo, params.rounds, params.nivel]);

  const sessao = plano?.sessoes.find(s => s.id === params.sessaoId);
  const titulo = sessao?.titulo ?? CAT_LABELS[params.tipo];
  const andando = c.estado === "rodando" || c.estado === "pausado";

  // Evita perder o treino por um toque sem querer no botão voltar.
  useEffect(() => {
    if (!andando) return;
    const aviso = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [andando]);

  if (!pronto) return <main className="page-container" aria-busy="true"><div className="skeleton" /></main>;

  const registrar = () => openRegister({
    tipo: params.tipo,
    rounds: Math.max(1, c.roundsFeitos),
    minPorRound: params.minPorRound,
    duracaoSegundos: Math.max(1, Math.round(c.decorridoReal)),
    sessaoId: params.sessaoId,
  });

  // ── Antes de começar ───────────────────────────────────────
  if (c.estado === "pronto") {
    const totalSeg = c.total;
    return (
      <main className="page-container">
        <header>
          <Link href="/hoje" className="link-muted"><i className="ph-bold ph-caret-left" aria-hidden="true" /> Voltar</Link>
          <p className="eyebrow" style={{ marginTop: 18 }}>Cronômetro de rounds</p>
          <h1 className="page-title">{titulo}</h1>
          <p className="muted-copy">
            {CAT_LABELS[params.tipo]} · {params.rounds} rounds de {params.minPorRound < 1 ? `${Math.round(params.minPorRound * 60)} s` : `${params.minPorRound} min`} · descanso de {params.descansoSeg} s · cerca de {Math.round(totalSeg / 60)} min no total
          </p>
        </header>

        <div className="section-heading"><h2>Plano dos rounds</h2><span>Mão da frente: {maoDaFrente(config.postura)}</span></div>
        <section className="surface-card">
          <ol className={styles.focoLista}>
            {focos.map(f => (
              <li key={f.numero}>
                <span className={styles.focoNum}>{f.numero}</span>
                <div>
                  <strong>{f.titulo}</strong>
                  <p>{f.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className="section-heading"><h2>Antes de começar</h2><Link href="/tecnicas?aba=preparacao" className="link-muted">Guia de bandagem</Link></div>
        <section className="surface-card">
          <ul className={styles.antes}>
            <li><i className="ph-fill ph-hand-fist" aria-hidden="true" /> Bandagem feita, firme e sem formigamento</li>
            {params.tipo === "spa" && <li><i className="ph-fill ph-shield-check" aria-hidden="true" /> Protetor bucal, protetor de cabeça e parceiro de confiança</li>}
            <li><i className="ph-fill ph-drop" aria-hidden="true" /> Garrafa de água por perto</li>
            <li><i className="ph-fill ph-speaker-high" aria-hidden="true" /> Volume ligado: o sino e o aviso dos 10 s tocam com o app aberto</li>
          </ul>
        </section>

        <button type="button" className={`btn-primary ${styles.comecar}`} onClick={c.iniciar}>
          <i className="ph-fill ph-play" aria-hidden="true" /> Começar ({PREPARO_SEG} s de preparo)
        </button>
        <p className={styles.nota}>Mantenha o app aberto: a tela fica acesa durante o treino. Em segundo plano, o navegador pode silenciar os sons.</p>
      </main>
    );
  }

  // ── Resumo final ───────────────────────────────────────────
  if (c.estado === "fim") {
    const completo = c.roundsFeitos >= params.rounds;
    return (
      <main className={`page-container ${styles.resumo}`}>
        <div className={styles.resumoIcone} aria-hidden="true"><i className={`ph-fill ${completo ? "ph-check" : "ph-flag"}`} /></div>
        <h1 className="page-title">{completo ? "Treino concluído!" : "Treino encerrado"}</h1>
        <p className="muted-copy">{completo ? "Todos os rounds feitos. Bom trabalho." : "Você parou antes do fim, e tudo bem. O que foi feito conta."}</p>

        <div className="stat-grid" style={{ marginTop: 24 }}>
          <section className="surface-card stat-card"><p className="stat-label">Rounds feitos</p><p className="stat-value">{c.roundsFeitos}/{params.rounds}</p></section>
          <section className="surface-card stat-card"><p className="stat-label">Tempo de treino</p><p className="stat-value">{mmss(c.decorridoReal)}</p></section>
        </div>

        {c.roundsFeitos > 0 ? (
          <button type="button" className="btn-primary" onClick={registrar}>
            <i className="ph-bold ph-plus" aria-hidden="true" /> Registrar treino
          </button>
        ) : (
          <p className="muted-copy" style={{ marginTop: 20 }}>Nenhum round foi completo, então não há nada para registrar.</p>
        )}
        <Link href="/hoje" className="btn-ghost" style={{ marginTop: 12, width: "100%" }}>Voltar ao início</Link>
        <div className="section-heading"><h2>Depois do treino</h2><Link href="/tecnicas?aba=preparacao" className="link-muted">Ver guia</Link></div>
        <section className="surface-card empty-state" style={{ justifyItems: "start", textAlign: "left" }}>
          <p>Faça 3 a 5 minutos de desaceleração, alongue ombros, punhos e pernas e hidrate-se.</p>
        </section>
      </main>
    );
  }

  // ── Treino em andamento (tela cheia) ───────────────────────
  const emRound = c.fase.tipo === "round";
  const emDescanso = c.fase.tipo === "descanso";
  // No round: o foco dele. No descanso: o do próximo. No preparo: o do primeiro.
  const indiceFoco = emRound ? c.fase.round - 1 : emDescanso ? c.fase.round : 0;
  const foco = focos[Math.min(indiceFoco, focos.length - 1)];
  const rotulo = emRound ? `Round ${c.fase.round} de ${params.rounds}` : emDescanso ? "Descanso" : "Prepare-se";
  const fracao = Math.min(1, Math.max(0, (c.decorrido - c.fase.inicio) / c.fase.duracao));
  const R = 124;
  const CIRC = 2 * Math.PI * R;

  return (
    <div className={`${styles.tela} ${emRound ? styles.round : emDescanso ? styles.descanso : styles.preparo}`}>
      <div className="sr-only" role="status" aria-live="polite">
        {c.estado === "pausado" ? "Cronômetro pausado" : `${rotulo} começou`}
      </div>

      <header className={styles.topo}>
        <span>{titulo}</span>
        <span>{mmss(c.decorrido)} / {mmss(c.total)}</span>
      </header>

      <div className={styles.centro}>
        <p className={styles.rotulo}>{c.estado === "pausado" ? "Pausado" : rotulo}</p>
        <div className={styles.anel}>
          <svg viewBox="0 0 280 280" aria-hidden="true">
            <circle cx="140" cy="140" r={R} className={styles.anelFundo} />
            <circle cx="140" cy="140" r={R} className={styles.anelProgresso} strokeDasharray={CIRC} strokeDashoffset={CIRC * fracao} transform="rotate(-90 140 140)" />
          </svg>
          <span className={styles.tempo} aria-label={`${c.restante} segundos restantes`}>{mmss(c.restante)}</span>
        </div>

        {emRound && c.restante <= 10 && c.fase.duracao > 25 && <p className={styles.aviso}><i className="ph-fill ph-bell-ringing" aria-hidden="true" /> Últimos segundos: dê tudo</p>}
        {emDescanso && <p className={styles.aviso}><i className="ph-fill ph-drop" aria-hidden="true" /> Respire fundo e beba água</p>}
      </div>

      <section className={styles.foco}>
        <p className={styles.focoRotulo}>{emRound ? `Foco do round ${foco.numero}` : `Próximo: round ${foco.numero}`}</p>
        <strong>{foco.titulo}</strong>
        <p>{foco.texto}</p>
        {foco.combos.length > 0 && (
          <p className={styles.combos}>
            {foco.combos.map(cb => <span key={cb} className="chip">{cb}</span>)}
            <small>Frente: {maoDaFrente(config.postura)} · trás: {maoDeTras(config.postura)}</small>
          </p>
        )}
      </section>

      <div className={styles.controles}>
        <button type="button" className={styles.secundario} onClick={c.pular} aria-label="Pular para a próxima fase">
          <i className="ph-bold ph-skip-forward" aria-hidden="true" />
        </button>
        <button type="button" className={styles.principal} onClick={c.estado === "pausado" ? c.retomar : c.pausar} aria-label={c.estado === "pausado" ? "Retomar" : "Pausar"}>
          <i className={`ph-fill ${c.estado === "pausado" ? "ph-play" : "ph-pause"}`} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.secundario}
          aria-label="Encerrar treino"
          onClick={() => { if (window.confirm("Encerrar o treino agora? Os rounds já completos podem ser registrados.")) c.encerrar(); }}
        >
          <i className="ph-bold ph-stop" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
