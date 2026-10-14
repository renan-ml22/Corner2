"use client";

import Link from "next/link";
import { useState } from "react";
import { useCorner } from "@/components/CornerProvider";
import {
  AQUECIMENTO, BANDAGEM, COMBINACOES, DEFESAS, DESAQUECIMENTO, GOLPES, NOTACAO_CORPO, maoDaFrente, maoDeTras,
  type PassoGuia,
} from "@/data/tecnicas";
import { NIVEL_LABEL, type Nivel } from "@/data/planos";
import { nivelDoAtleta } from "@/lib/sessao";

export type Aba = "golpes" | "combinacoes" | "defesa" | "preparacao";

const ABAS: { id: Aba; label: string }[] = [
  { id: "golpes", label: "Golpes" },
  { id: "combinacoes", label: "Combinações" },
  { id: "defesa", label: "Defesa" },
  { id: "preparacao", label: "Preparação" },
];

function Passos({ titulo, passos, icone }: { titulo: string; passos: PassoGuia[]; icone: string }) {
  return (
    <>
      <div className="section-heading"><h2><i className={`ph-fill ${icone}`} aria-hidden="true" style={{ color: "var(--red)", marginRight: 8 }} />{titulo}</h2></div>
      <section className="surface-card">
        <ol className="passos">
          {passos.map((p, i) => (
            <li key={p.titulo}>
              <span className="passo-num">{i + 1}</span>
              <div><strong>{p.titulo}</strong><p>{p.texto}</p></div>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

export default function TecnicasCliente({ abaInicial }: { abaInicial: Aba }) {
  const { config, plano } = useCorner();
  const [aba, setAba] = useState<Aba>(abaInicial);
  const meuNivel = nivelDoAtleta(plano, config.experiencia);
  const [filtro, setFiltro] = useState<Nivel | "todos">(meuNivel);
  const combos = COMBINACOES.filter(c => filtro === "todos" || c.nivel === filtro);

  return (
    <main className="page-container">
      <header>
        <Link href="/hoje" className="link-muted"><i className="ph-bold ph-caret-left" aria-hidden="true" /> Voltar</Link>
        <p className="eyebrow" style={{ marginTop: 18 }}>Aprenda e revise</p>
        <h1 className="page-title">Biblioteca técnica</h1>
        <p className="muted-copy">Mão da frente: <strong>{maoDaFrente(config.postura)}</strong> · mão de trás: <strong>{maoDeTras(config.postura)}</strong> ({config.postura === "ortodoxo" ? "postura ortodoxa" : "postura canhota"}).</p>
      </header>

      <div className="abas" role="tablist" aria-label="Seções da biblioteca">
        {ABAS.map(a => (
          <button key={a.id} type="button" role="tab" id={`aba-${a.id}`} aria-selected={aba === a.id} aria-controls={`painel-${a.id}`} className={aba === a.id ? "ativa" : ""} onClick={() => setAba(a.id)}>
            {a.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`painel-${aba}`} aria-labelledby={`aba-${aba}`}>
        {aba === "golpes" && (
          <>
            <div className="section-heading"><h2>Numeração dos golpes</h2></div>
            <div className="lista-cards">
              {GOLPES.map(g => (
                <article key={g.numero} className="surface-card golpe-card">
                  <span className="golpe-num" aria-hidden="true">{g.numero}</span>
                  <div>
                    <h3>{g.nome}</h3>
                    <p className="sessao-meta">{g.resumo}</p>
                    <p className="sessao-descricao">{g.dica}</p>
                  </div>
                </article>
              ))}
            </div>
            <p className="muted-copy" style={{ marginTop: 14 }}>{NOTACAO_CORPO}</p>
          </>
        )}

        {aba === "combinacoes" && (
          <>
            <div className="chips-filtro" role="group" aria-label="Filtrar por nível">
              {(["todos", "iniciante", "intermediario", "avancado"] as const).map(n => (
                <button key={n} type="button" aria-pressed={filtro === n} className={filtro === n ? "ativo" : ""} onClick={() => setFiltro(n)}>
                  {n === "todos" ? "Todas" : NIVEL_LABEL[n]}
                </button>
              ))}
            </div>
            <div className="lista-cards">
              {combos.map(c => (
                <article key={c.notacao} className="surface-card combo-card">
                  <span className="combo-notacao">{c.notacao}</span>
                  <div>
                    <h3>{c.nome}</h3>
                    <p className="sessao-descricao" style={{ marginTop: 4 }}>{c.descricao}</p>
                  </div>
                  <span className="nivel-badge">{NIVEL_LABEL[c.nivel]}</span>
                </article>
              ))}
            </div>
            <p className="muted-copy" style={{ marginTop: 14 }}>Os números seguem a numeração de golpes. Palavras como “esquiva” e “bloqueio” entram no meio da sequência. Treine devagar antes de acelerar.</p>
          </>
        )}

        {aba === "defesa" && (
          <>
            <div className="section-heading"><h2>Defesa básica</h2></div>
            <div className="lista-cards">
              {DEFESAS.map(d => (
                <article key={d.nome} className="surface-card golpe-card">
                  <span className="golpe-num" aria-hidden="true"><i className="ph-fill ph-shield-check" /></span>
                  <div>
                    <h3>{d.nome}</h3>
                    <p className="sessao-meta">{d.resumo}</p>
                    <p className="sessao-descricao">{d.dica}</p>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {aba === "preparacao" && (
          <>
            <Passos titulo="Aquecimento (cerca de 7 min)" passos={AQUECIMENTO} icone="ph-fire" />
            <Passos titulo="Bandagem das mãos" passos={BANDAGEM} icone="ph-hand-fist" />
            <Passos titulo="Desaquecimento" passos={DESAQUECIMENTO} icone="ph-snowflake" />
          </>
        )}
      </div>
    </main>
  );
}
