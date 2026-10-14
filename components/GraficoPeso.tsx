"use client";

import { useState } from "react";
import { deChave, formatarDataCurta } from "@/lib/datas";
import type { PesoRegistro } from "@/lib/tipos";

const L = 340;
const A = 170;
const ML = 38;
const MR = 14;
const MT = 16;
const MB = 24;

const fmt = (kg: number) => kg.toFixed(1).replace(".", ",");

/** Uma série só (peso), uma escala só: linha fina, marcadores com anel, grade discreta e valor direto no último ponto. */
export default function GraficoPeso({ pesos, categoria }: { pesos: PesoRegistro[]; categoria: number | null }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const pontos = pesos.slice(-30);

  if (pontos.length < 2) {
    return <p className="muted-copy">Registre o peso em pelo menos dois dias para ver a evolução.</p>;
  }

  const valores = pontos.map(p => p.kg).concat(categoria ? [categoria] : []);
  const min = Math.floor(Math.min(...valores) - 0.5);
  const max = Math.ceil(Math.max(...valores) + 0.5);
  const x = (i: number) => ML + (i / (pontos.length - 1)) * (L - ML - MR);
  const y = (kg: number) => MT + (1 - (kg - min) / (max - min)) * (A - MT - MB);
  const linha = pontos.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.kg).toFixed(1)}`).join(" ");
  const grade = [min, (min + max) / 2, max];
  const ultimo = pontos.length - 1;
  const destaque = ativo ?? ultimo;
  const p = pontos[destaque];

  return (
    <div className="grafico-peso">
      <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label={`Peso de ${formatarDataCurta(deChave(pontos[0].data))} a ${formatarDataCurta(deChave(pontos[ultimo].data))}: de ${fmt(pontos[0].kg)} a ${fmt(pontos[ultimo].kg)} kg`} onMouseLeave={() => setAtivo(null)}>
        {grade.map(g => (
          <g key={g}>
            <line x1={ML} x2={L - MR} y1={y(g)} y2={y(g)} className="gp-grade" />
            <text x={ML - 6} y={y(g) + 3.5} textAnchor="end" className="gp-eixo">{fmt(g)}</text>
          </g>
        ))}
        {categoria !== null && categoria >= min && categoria <= max && (
          <g>
            <line x1={ML} x2={L - MR} y1={y(categoria)} y2={y(categoria)} className="gp-meta" />
            <text x={L - MR} y={y(categoria) - 5} textAnchor="end" className="gp-eixo">Categoria {fmt(categoria)} kg</text>
          </g>
        )}
        <path d={linha} className="gp-linha" />
        {pontos.map((pt, i) => (
          <g key={pt.id} tabIndex={0} role="img" aria-label={`${formatarDataCurta(deChave(pt.data))}: ${fmt(pt.kg)} kg`} onMouseEnter={() => setAtivo(i)} onFocus={() => setAtivo(i)} onBlur={() => setAtivo(null)} className="gp-ponto">
            <circle cx={x(i)} cy={y(pt.kg)} r={14} fill="transparent" />
            <circle cx={x(i)} cy={y(pt.kg)} r={i === destaque ? 5.5 : 4.5} className="gp-marca" />
          </g>
        ))}
        <text x={Math.min(Math.max(x(destaque), ML + 28), L - MR - 28)} y={y(p.kg) - 14} textAnchor="middle" className="gp-valor" paintOrder="stroke" stroke="var(--surface)" strokeWidth="4">{fmt(p.kg)} kg</text>
        <text x={ML} y={A - 6} className="gp-eixo">{formatarDataCurta(deChave(pontos[0].data))}</text>
        <text x={L - MR} y={A - 6} textAnchor="end" className="gp-eixo">{formatarDataCurta(deChave(pontos[ultimo].data))}</text>
      </svg>
      <table className="sr-only">
        <caption>Registros de peso</caption>
        <thead><tr><th>Data</th><th>Peso (kg)</th></tr></thead>
        <tbody>{pontos.map(pt => <tr key={pt.id}><td>{formatarDataCurta(deChave(pt.data))}</td><td>{fmt(pt.kg)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
