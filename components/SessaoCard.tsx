import { DIAS_LONGOS, formatarDataCurta } from "@/lib/datas";
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

interface SessaoCardProps {
  item: SessaoComStatus;
  destaque?: boolean;
  onRegistrar?: () => void;
  /** Mostra a descrição completa (padrão: só no destaque) */
  detalhado?: boolean;
}

export default function SessaoCard({ item, destaque = false, onRegistrar, detalhado }: SessaoCardProps) {
  const { sessao, data, status } = item;
  const mostrarDescricao = detalhado ?? destaque;

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

      {onRegistrar && status !== "feita" && (
        <button type="button" className="btn-primary" onClick={onRegistrar}>
          <i className="ph-bold ph-plus" aria-hidden="true" /> Registrar este treino
        </button>
      )}
    </article>
  );
}
