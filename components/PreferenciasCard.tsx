"use client";

import Link from "next/link";
import { ChangeEvent, useState } from "react";
import { useHidratado } from "@/hooks/useEntidade";
import { usePlano } from "@/hooks/usePlano";
import { usePreferencias } from "@/hooks/usePreferencias";
import { useToast } from "@/hooks/useToast";
import { usePainelAcoes } from "./PainelProvider";
import { chaveDia } from "@/lib/datas";
import { pedirPermissaoNotificacao } from "@/lib/notificar";
import type { Postura } from "@/lib/tipos";
import estilos from './PreferenciasCard.module.css'

export default function PreferenciasCard() {
  const pronto = useHidratado();
  const { config, atualizarConfig, exportarDados, importarDados } = usePreferencias();
  const { plano } = usePlano();
  const { openOnboarding } = usePainelAcoes();
  const showToast = useToast();
  const [permissao, setPermissao] = useState<string>(() => (typeof Notification === "undefined" ? "indisponivel" : Notification.permission));

  if (!pronto) return <div className="skeleton" />;

  const meta = config.metaSemanal;

  const alternarNotificacoes = async (ligado: boolean) => {
    atualizarConfig({ notificacoes: ligado });
    if (ligado && config.lembreteHora) setPermissao(await pedirPermissaoNotificacao());
  };

  const definirLembrete = async (hora: string) => {
    atualizarConfig({ lembreteHora: hora });
    if (hora) {
      const r = await pedirPermissaoNotificacao();
      setPermissao(r);
      if (r !== "granted") showToast("Permita as notificações no navegador para receber o lembrete");
    }
  };

  const exportar = () => {
    const url = URL.createObjectURL(new Blob([exportarDados()], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `corner-backup-${chaveDia(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Backup baixado");
  };

  const importar = async (e: ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!arquivo) return;
    if (arquivo.size > 2_000_000) { showToast("Arquivo grande demais para ser um backup do Corner"); return; }
    if (!window.confirm("Importar substitui os dados atuais deste aparelho pelos do backup. Continuar?")) return;
    const r = importarDados(await arquivo.text());
    showToast(r.ok ? "Backup importado" : (r.erro ?? "Não foi possível importar"));
  };

  return (
    <>
      <section className="surface-card">
        <ul className={estilos.settingsList}>
          <li>
            Plano ativo
            <Link href="/plano" className={estilos.settingsLink}>{plano ? plano.nome : "Nenhum"} <i className="ph-bold ph-caret-right" aria-hidden="true" /></Link>
          </li>
          <li>
            <span className={estilos.settingsLabel}>Postura<small>Define qual mão fica à frente nas orientações</small></span>
            <select className={`field-input ${estilos.compacto}`} value={config.postura} onChange={e => atualizarConfig({ postura: e.target.value as Postura })} aria-label="Postura">
              <option value="ortodoxo">Ortodoxo</option>
              <option value="canhoto">Canhoto</option>
            </select>
          </li>
          <li>
            <span className={estilos.settingsLabel}>Meta semanal<small>Treinos por semana para manter a sequência</small></span>
            <div className={estilos.miniStepper}>
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
            <label htmlFor="pref-notif" className={estilos.settingsLabel}>Lembretes<small>Aviso diário no horário escolhido</small></label>
            <input id="pref-notif" type="checkbox" role="switch" className="switch" checked={config.notificacoes} onChange={e => void alternarNotificacoes(e.target.checked)} />
          </li>
          {config.notificacoes && (
            <li>
              <label htmlFor="pref-hora" className={estilos.settingsLabel}>Horário do lembrete<small>Só dispara com o app aberto neste aparelho</small></label>
              <input id="pref-hora" type="time" className={`field-input ${estilos.compacto}`} value={config.lembreteHora} onChange={e => void definirLembrete(e.target.value)} />
            </li>
          )}
        </ul>
        {config.notificacoes && config.lembreteHora && permissao !== "granted" && (
          <p className="muted-copy" style={{ padding: "0 1.2rem 1rem" }}>
            {permissao === "denied" ? "As notificações estão bloqueadas neste navegador. Libere nas configurações do site para receber o lembrete." : permissao === "indisponivel" ? "Este navegador não oferece notificações." : "Falta permitir as notificações no navegador."}
          </p>
        )}
      </section>

      <div className="section-heading"><h2>Ferramentas</h2></div>
      <div className="atalhos">
        <Link href="/saude" className="surface-card cta-card">
          <i className="ph-fill ph-heartbeat" aria-hidden="true" />
          <span><strong>Saúde e corpo</strong><small>Peso, lesões e pancadas na cabeça</small></span>
          <i className="ph-bold ph-caret-right" aria-hidden="true" />
        </Link>
        <Link href="/tecnicas" className="surface-card cta-card">
          <i className="ph-fill ph-books" aria-hidden="true" />
          <span><strong>Biblioteca técnica</strong><small>Golpes, combinações, defesa e preparação</small></span>
          <i className="ph-bold ph-caret-right" aria-hidden="true" />
        </Link>
        <button type="button" className="surface-card cta-card" onClick={openOnboarding}>
          <i className="ph-fill ph-boxing-glove" aria-hidden="true" />
          <span><strong>{config.onboardingFeito ? "Refazer perfil de atleta" : "Montar perfil de atleta"}</strong><small>Postura, experiência e plano recomendado</small></span>
          <i className="ph-bold ph-caret-right" aria-hidden="true" />
        </button>
      </div>

      <div className="section-heading"><h2>Backup dos dados</h2></div>
      <section className="surface-card form-card">
        <p className="muted-copy" style={{ marginTop: 0 }}>Seus dados ficam só neste aparelho. Baixe um backup de vez em quando, principalmente antes de trocar de celular ou limpar o navegador.</p>
        <div className="linha-form" style={{ marginTop: 14 }}>
          <button type="button" className="btn-ghost" style={{ flex: 1, height: 46 }} onClick={exportar}><i className="ph ph-download-simple" aria-hidden="true" /> Baixar backup</button>
          <label className="btn-ghost" style={{ flex: 1, height: 46, cursor: "pointer" }}>
            <i className="ph ph-upload-simple" aria-hidden="true" /> Importar
            <input type="file" accept="application/json,.json" className="sr-only" onChange={e => void importar(e)} />
          </label>
        </div>
      </section>
    </>
  );
}
