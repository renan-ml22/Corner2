"use client";

import Link from "next/link";
import { useCorner } from "./CornerProvider";

export default function PreferenciasCard() {
  const { pronto, config, atualizarConfig, plano } = useCorner();

  if (!pronto) return <div className="skeleton" />;

  const meta = config.metaSemanal;

  return (
    <section className="surface-card">
      <ul className="settings-list">
        <li>
          Plano ativo
          <Link href="/plano" className="settings-link">{plano ? plano.nome : "Nenhum"} <i className="ph-bold ph-caret-right" aria-hidden="true" /></Link>
        </li>
        <li>
          <span className="settings-label">Meta semanal<small>Treinos por semana para manter a sequência</small></span>
          <div className="mini-stepper">
            <button type="button" onClick={() => atualizarConfig({ metaSemanal: Math.max(1, meta - 1) })} disabled={meta <= 1} aria-label="Diminuir meta semanal">
              <i className="ph-bold ph-minus" />
            </button>
            <output aria-live="polite">{meta}×</output>
            <button type="button" onClick={() => atualizarConfig({ metaSemanal: Math.min(7, meta + 1) })} disabled={meta >= 7} aria-label="Aumentar meta semanal">
              <i className="ph-bold ph-plus" />
            </button>
          </div>
        </li>
        <li>
          <label htmlFor="pref-notif" className="settings-label">Notificações<small>Lembretes e sugestões de ajuste no plano</small></label>
          <input
            id="pref-notif"
            type="checkbox"
            role="switch"
            className="switch"
            checked={config.notificacoes}
            onChange={e => atualizarConfig({ notificacoes: e.target.checked })}
          />
        </li>
      </ul>
    </section>
  );
}
