"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useHidratado } from "@/hooks/useEntidade";
import { useHistorico } from "@/hooks/useHistorico";
import { usePreferencias } from "@/hooks/usePreferencias";
import { useCheckins, useLesoes, usePesos } from "@/hooks/useSaude";
import { useToast } from "@/hooks/useToast";
import { aoTeclarNoGrupo } from "@/lib/teclado";
import GraficoPeso from "@/components/GraficoPeso";
import { deChave, diferencaDias, formatarDataCurta } from "@/lib/datas";
import { prontidao, resumoCabeca } from "@/lib/saude";
import { REGIOES, type RegiaoCorpo } from "@/lib/tipos";
import estilos from './saude.module.css'
import { TEXTOS } from "@/lib/textos";

const fmt = (n: number) => n.toFixed(1).replace(".", ",");

export default function SaudeCliente() {
  const pronto = useHidratado();
  const { historico } = useHistorico();
  const { pesos, registrarPeso, removerPeso } = usePesos();
  const { lesoes, adicionarLesao, resolverLesao, removerLesao } = useLesoes();
  const { checkins } = useCheckins();
  const { config, atualizarConfig } = usePreferencias();
  const showToast = useToast();

  const [kgTexto, setKgTexto] = useState("");
  const [erroPeso, setErroPeso] = useState("");
  const [catTexto, setCatTexto] = useState("");
  const [regiao, setRegiao] = useState<RegiaoCorpo>("punhos");
  const [intensidade, setIntensidade] = useState(2);
  const [nota, setNota] = useState("");

  if (!pronto) return <main className="page-container" aria-busy="true"><div className="skeleton" /></main>;

  const hoje = new Date();
  const cabeca = resumoCabeca(historico, hoje, 30);
  const ativas = lesoes.filter(l => !l.resolvidaEm);
  const resolvidas = lesoes.filter(l => l.resolvidaEm);
  const ultimoPeso = pesos[pesos.length - 1];
  const categoria = config.pesoCategoria;
  const diff = ultimoPeso && categoria ? ultimoPeso.kg - categoria : null;

  // Perda rápida: mais de 2% do peso em até 7 dias é um sinal de alerta.
  const referencia = ultimoPeso ? [...pesos].reverse().find(p => diferencaDias(deChave(ultimoPeso.data), deChave(p.data)) >= 5 && diferencaDias(deChave(ultimoPeso.data), deChave(p.data)) <= 10) : undefined;
  const perdaPct = ultimoPeso && referencia ? ((referencia.kg - ultimoPeso.kg) / referencia.kg) * 100 : 0;

  const salvarPeso = (e: FormEvent) => {
    e.preventDefault();
    const kg = Number(kgTexto.replace(",", "."));
    if (!(kg >= 30 && kg <= 250)) { setErroPeso(TEXTOS.erro.pesoForaDaFaixa); return; }
    setErroPeso("");
    registrarPeso(Math.round(kg * 10) / 10);
    setKgTexto("");
    showToast(TEXTOS.aviso.pesoRegistrado);
  };

  const salvarCategoria = (e: FormEvent) => {
    e.preventDefault();
    const txt = catTexto.trim();
    if (txt === "") { atualizarConfig({ pesoCategoria: null }); showToast(TEXTOS.aviso.categoriaRemovida); return; }
    const kg = Number(txt.replace(",", "."));
    if (!(kg >= 30 && kg <= 250)) { showToast(TEXTOS.aviso.categoriaInvalida); return; }
    atualizarConfig({ pesoCategoria: kg });
    setCatTexto("");
    showToast(TEXTOS.aviso.categoriaSalva);
  };

  const salvarLesao = (e: FormEvent) => {
    e.preventDefault();
    adicionarLesao({ regiao, intensidade, nota });
    setNota("");
    showToast(TEXTOS.aviso.lesaoRegistrada);
  };

  return (
    <main className="page-container">
      <header>
        <Link href="/perfil" className="link-muted"><i className="ph-bold ph-caret-left" aria-hidden="true" /> Perfil</Link>
        <p className="eyebrow" style={{ marginTop: 18 }}>Cuide do corpo</p>
        <h1 className="page-title">Saúde e corpo</h1>
        <p className="muted-copy">Estas ferramentas ajudam a acompanhar, mas não substituem avaliação de um médico ou fisioterapeuta.</p>
      </header>

      {/* ── Pancadas na cabeça ─────────────────────────── */}
      <div className="section-heading"><h2>Pancadas na cabeça</h2><span>Últimos 30 dias</span></div>
      <section className={`surface-card ${estilos.cabecaCard}`}>
        <div className="stat-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div><p className="stat-label">Sparrings</p><p className="stat-value">{cabeca.sparrings}</p></div>
          <div><p className="stat-label">Leves</p><p className="stat-value">{cabeca.leves}</p></div>
          <div><p className="stat-label">Fortes</p><p className="stat-value">{cabeca.fortes}</p></div>
        </div>
        <p className="muted-copy" style={{ marginTop: 14 }}>
          {cabeca.fortes === 0
            ? "Nenhum sparring com pancadas fortes registrado. Continue marcando a cada sparring."
            : `Último sparring com pancadas fortes: ${formatarDataCurta(cabeca.ultimoForte ?? hoje)}. Após pancadas fortes, evite sparring por 7 dias. Dor de cabeça persistente, tontura, náusea, visão turva ou confusão exigem atendimento médico.`}
        </p>
      </section>

      {/* ── Peso ───────────────────────────────────────── */}
      <div className="section-heading"><h2>Peso corporal</h2>{ultimoPeso && <span>Último: {fmt(ultimoPeso.kg)} kg</span>}</div>
      <section className="surface-card form-card">
        <form onSubmit={salvarPeso} className="linha-form" noValidate>
          <input className="field-input" inputMode="decimal" placeholder="Peso de hoje (kg)" value={kgTexto} onChange={e => setKgTexto(e.target.value)} aria-label="Peso de hoje em quilos" aria-invalid={erroPeso ? true : undefined} />
          <button type="submit" className="btn-primary" style={{ marginTop: 0, width: "auto" }}>Registrar</button>
        </form>
        {erroPeso && <p role="alert" className={estilos.erroTexto}>{erroPeso}</p>}
        <div style={{ marginTop: 14 }}><GraficoPeso pesos={pesos} categoria={categoria} /></div>

        <form onSubmit={salvarCategoria} className="linha-form" style={{ marginTop: 14 }} noValidate>
          <input className="field-input" inputMode="decimal" placeholder={categoria ? `Categoria atual: ${fmt(categoria)} kg` : "Categoria de peso (kg), se compete"} value={catTexto} onChange={e => setCatTexto(e.target.value)} aria-label="Categoria de peso em quilos" />
          <button type="submit" className="btn-ghost" style={{ height: 46 }}>Salvar</button>
        </form>
        {diff !== null && (
          <p className="muted-copy" style={{ marginTop: 10 }}>
            {diff > 0.05 ? `${fmt(diff)} kg acima da categoria. Ajuste com calma e acompanhamento de um nutricionista.` : diff < -0.05 ? `${fmt(-diff)} kg abaixo da categoria.` : "Você está exatamente no peso da categoria."}
          </p>
        )}
        {perdaPct > 2 && (
          <p role="alert" className={estilos.erroTexto} style={{ marginTop: 10 }}>
            <i className="ph-fill ph-warning" aria-hidden="true" /> Você perdeu {fmt(perdaPct)}% do peso em cerca de uma semana. Cortes rápidos reduzem o rendimento e aumentam o risco de lesão e desidratação. Converse com seu treinador e um nutricionista.
          </p>
        )}
        {pesos.length > 0 && (
          <details className={estilos.detalhes}>
            <summary>Ver registros ({pesos.length})</summary>
            <ul className="historico-list">
              {[...pesos].reverse().slice(0, 15).map(p => (
                <li key={p.id}>
                  <div className="historico-info"><strong>{fmt(p.kg)} kg</strong><span>{formatarDataCurta(deChave(p.data))}</span></div>
                  <button type="button" className="btn-ghost small" onClick={() => removerPeso(p.id)} aria-label={`Remover registro de ${fmt(p.kg)} kg`}>Remover</button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* ── Lesões ─────────────────────────────────────── */}
      <div className="section-heading"><h2>Lesões e dores</h2><span>{ativas.length} {ativas.length === 1 ? "ativa" : "ativas"}</span></div>
      {ativas.length > 0 && (
        <section className="surface-card" style={{ marginBottom: 12 }}>
          <ul className="historico-list">
            {ativas.map(l => (
              <li key={l.id}>
                <span className="tipo-icon small" aria-hidden="true"><i className="ph-fill ph-bandaids" /></span>
                <div className="historico-info">
                  <strong>{REGIOES[l.regiao]} · {l.intensidade}/5</strong>
                  <span>Desde {formatarDataCurta(deChave(l.inicio))}{l.nota ? ` · ${l.nota}` : ""}</span>
                </div>
                <div className={estilos.acoesLinha}>
                  <button type="button" className="btn-ghost small" onClick={() => { resolverLesao(l.id); showToast(TEXTOS.aviso.lesaoResolvida); }}>Resolvida</button>
                  <button type="button" className="btn-ghost small" onClick={() => removerLesao(l.id)} aria-label={`Remover lesão em ${REGIOES[l.regiao]}`}>Remover</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="surface-card form-card">
        <form onSubmit={salvarLesao} noValidate>
          <label className={estilos.campoRotulo} htmlFor="regiao">Onde dói?</label>
          <select id="regiao" className="field-input" value={regiao} onChange={e => setRegiao(e.target.value as RegiaoCorpo)}>
            {(Object.keys(REGIOES) as RegiaoCorpo[]).map(r => <option key={r} value={r}>{REGIOES[r]}</option>)}
          </select>
          <p className={estilos.campoRotulo}>Intensidade (1 = leve, 5 = forte)</p>
          <div className="seg" role="radiogroup" aria-label="Intensidade da dor" onKeyDown={e => aoTeclarNoGrupo(e, "radio")}>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} type="button" role="radio" aria-checked={intensidade === n} tabIndex={intensidade === n ? 0 : -1} className={intensidade === n ? "ativo" : ""} onClick={() => setIntensidade(n)}>{n}</button>
            ))}
          </div>
          <input className="field-input" style={{ marginTop: 12 }} placeholder="Observação (opcional)" maxLength={200} value={nota} onChange={e => setNota(e.target.value)} aria-label="Observação sobre a lesão" />
          <button type="submit" className="btn-primary">Registrar lesão</button>
        </form>
        {resolvidas.length > 0 && (
          <details className={estilos.detalhes}>
            <summary>Histórico de lesões resolvidas ({resolvidas.length})</summary>
            <ul className="historico-list">
              {resolvidas.map(l => (
                <li key={l.id}>
                  <div className="historico-info"><strong>{REGIOES[l.regiao]} · {l.intensidade}/5</strong><span>{formatarDataCurta(deChave(l.inicio))} → {formatarDataCurta(deChave(l.resolvidaEm ?? l.inicio))}</span></div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* ── Check-ins ──────────────────────────────────── */}
      <div className="section-heading"><h2>Check-ins recentes</h2></div>
      {checkins.length === 0 ? (
        <section className="surface-card empty-state">
          <i className="ph-fill ph-pulse" aria-hidden="true" />
          <p>Faça o check-in diário na tela Hoje para acompanhar sono, energia e dor.</p>
        </section>
      ) : (
        <section className="surface-card">
          <ul className="historico-list">
            {checkins.slice(0, 7).map(c => (
              <li key={c.data}>
                <div className="historico-info"><strong>Prontidão {fmt(prontidao(c))}/5</strong><span>Sono {c.sono} · Energia {c.energia} · Dor {c.dor}</span></div>
                <time dateTime={c.data}>{formatarDataCurta(deChave(c.data))}</time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
