import Link from "next/link";
import { DIAS_CURTOS, DIAS_LONGOS, formatarDataCurta } from "@/lib/datas";
import { CAT_ICONS, CAT_LABELS } from "@/lib/tipos";
import type { SessaoComStatus, StatusSessao } from "@/lib/treinos";

const STATUS_LABEL: Record<StatusSessao, string> = {
  feita: "Feita",
  perdida: "Não feita",
  hoje: "Hoje",
  futura: "A fazer",
};

const STATUS_ICON: Record<StatusSessao, string> = {
  feita: "ph-fill ph-check-circle",
  perdida: "ph ph-x-circle",
  hoje: "ph-fill ph-lightning",
  futura: "ph ph-circle-dashed",
};

// Segunda → domingo, no padrão do JS (0 = domingo).
const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0];

interface SessaoCardProps {
  item: SessaoComStatus;
  destaque?: boolean;
  /** Abre o cronômetro de rounds para esta sessão */
  iniciarHref?: string;
  /** Registra o treino manualmente, sem cronômetro */
  onRegistrar?: () => void;
  /** Move a sessão para outro dia da mesma semana */
  onReagendar?: (diaSemana: number) => void;
  /** Mostra a descrição completa (padrão: só no destaque) */
  detalhado?: boolean;
}

export default function SessaoCard({ item, destaque = false, iniciarHref, onRegistrar, onReagendar, detalhado }: SessaoCardProps) {
  const { sessao, data, status } = item;
  const mostrarDescricao = detalhado ?? destaque;
  const pendente = status !== "feita";

  return (
    <article className={`surface-card sessao-card status-${status}${destaque ? " destaque" : ""}`}>
      <div className="sessao-top">
        <div className="sessao-dia">
          <strong>{DIAS_LONGOS[data.getDay()]}</strong>
          <span>{formatarDataCurta(data)}</span>
        </div>
        <span className={`sessao-status status-${status}`}>
          <i className={STATUS_ICON[status]} aria-hidden="true" /> {STATUS_LABEL[status]}
        </span>
      </div>

      <div className="sessao-body">
        <span className="tipo-icon" aria-hidden="true"><i className={`ph-fill ${CAT_ICONS[sessao.tipo]}`} /></span>
        <div>
          <h3>{sessao.titulo}</h3>
          <p className="sessao-meta">
            {CAT_LABELS[sessao.tipo]} · {sessao.rounds} rounds de {sessao.minPorRound} min · descanso {sessao.descansoSeg}s
          </p>
        </div>
      </div>

      {mostrarDescricao && <p className="sessao-descricao">{sessao.descricao}</p>}

      {pendente && (iniciarHref || onRegistrar) && (
        <div className="sessao-acoes">
          {iniciarHref && (
            <Link href={iniciarHref} className="btn-primary">
              <i className="ph-fill ph-timer" aria-hidden="true" /> Iniciar com cronômetro
            </Link>
          )}
          {onRegistrar && (
            <button type="button" className={iniciarHref ? "btn-ghost" : "btn-primary"} onClick={onRegistrar}>
              <i className="ph-bold ph-plus" aria-hidden="true" /> Registrar sem cronômetro
            </button>
          )}
        </div>
      )}

      {pendente && onReagendar && (
        <label className="sessao-mover">
          <i className="ph ph-calendar-blank" aria-hidden="true" /> Mudar dia
          <select value={data.getDay()} onChange={e => onReagendar(Number(e.target.value))} aria-label={`Mudar o dia de ${sessao.titulo}`}>
            {ORDEM_DIAS.map(d => <option key={d} value={d}>{DIAS_CURTOS[d]}</option>)}
          </select>
        </label>
      )}
    </article>
  );
}
