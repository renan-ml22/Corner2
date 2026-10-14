"use client";

import { useState } from "react";
import { useCheckins } from "@/hooks/useSaude";
import { useToast } from "@/hooks/useToast";
import { prontidao } from "@/lib/saude";

type Campo = "sono" | "energia" | "dor";

const CAMPOS: { id: Campo; rotulo: string; baixo: string; alto: string }[] = [
  { id: "sono", rotulo: "Como foi o sono?", baixo: "Ruim", alto: "Ótimo" },
  { id: "energia", rotulo: "Nível de energia", baixo: "Baixa", alto: "Alta" },
  { id: "dor", rotulo: "Dor muscular ou nas articulações", baixo: "Nenhuma", alto: "Muita" },
];

export default function CheckinCard() {
  const { checkinHoje, registrarCheckin } = useCheckins();
  const showToast = useToast();
  const [valores, setValores] = useState<Partial<Record<Campo, number>>>({});
  const [refazendo, setRefazendo] = useState(false);

  if (checkinHoje && !refazendo) {
    const p = prontidao(checkinHoje);
    return (
      <section className="surface-card checkin-resumo" aria-label="Check-in de hoje">
        <div>
          <p className="stat-label">Prontidão de hoje</p>
          <p className="stat-value" style={{ marginTop: 4 }}>{p.toFixed(1).replace(".", ",")}<small>/5</small></p>
        </div>
        <p className="checkin-detalhe">Sono {checkinHoje.sono} · Energia {checkinHoje.energia} · Dor {checkinHoje.dor}</p>
        <button type="button" className="btn-ghost small" onClick={() => { setValores({}); setRefazendo(true); }}>Refazer</button>
      </section>
    );
  }

  const completo = valores.sono !== undefined && valores.energia !== undefined && valores.dor !== undefined;

  return (
    <section className="surface-card checkin-card" aria-label="Check-in de hoje">
      <h3>Como você está hoje?</h3>
      <p className="muted-copy" style={{ marginTop: 4 }}>Leva 10 segundos e ajusta o treino ao seu corpo.</p>
      {CAMPOS.map(c => (
        <div key={c.id} className="checkin-campo" role="radiogroup" aria-label={c.rotulo}>
          <span>{c.rotulo}</span>
          <div className="checkin-notas">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={valores[c.id] === n}
                className={valores[c.id] === n ? "ativo" : ""}
                onClick={() => setValores(v => ({ ...v, [c.id]: n }))}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="checkin-extremos"><small>1 = {c.baixo}</small><small>5 = {c.alto}</small></div>
        </div>
      ))}
      <button
        type="button"
        className="btn-primary"
        disabled={!completo}
        onClick={() => {
          if (valores.sono === undefined || valores.energia === undefined || valores.dor === undefined) return;
          registrarCheckin({ sono: valores.sono, energia: valores.energia, dor: valores.dor });
          setRefazendo(false);
          showToast("Check-in salvo");
        }}
      >
        Salvar check-in
      </button>
    </section>
  );
}
