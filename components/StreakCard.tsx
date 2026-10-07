const LETRAS = ["S", "T", "Q", "Q", "S", "S", "D"];

interface StreakCardProps {
  /** Semanas seguidas batendo a meta */
  sequencia: number;
  /** Treinos na semana atual */
  feitosSemana: number;
  meta: number;
  /** Segunda → domingo: houve treino no dia? */
  dias: boolean[];
  /** Índice de hoje em `dias` (0 = segunda) */
  hojeIndex: number;
}

export default function StreakCard({ sequencia, feitosSemana, meta, dias, hojeIndex }: StreakCardProps) {
  const progresso = Math.min(100, Math.round((feitosSemana / Math.max(1, meta)) * 100));

  return (
    <section className="surface-card streak-card" aria-label="Sequência semanal">
      <div className="streak-card-top">
        <div>
          <p className="streak-label">Sequência atual</p>
          <p className="streak-number">
            {sequencia} <span>{sequencia === 1 ? "semana na meta" : "semanas na meta"}</span>
          </p>
        </div>
        <div className="streak-mark" aria-hidden="true"><i className="ph-fill ph-fire" /></div>
      </div>
      <div className="week-row">
        {dias.map((feito, index) => (
          <div
            className={`day-dot${feito ? " done" : ""}${index === hojeIndex ? " today" : ""}`}
            key={index}
            aria-label={`${LETRAS[index]}: ${feito ? "treinou" : "sem treino"}`}
          >
            <i aria-hidden="true">{feito ? "✓" : "·"}</i>
            {LETRAS[index]}
          </div>
        ))}
      </div>
      <div className="streak-goal">
        <span>{feitosSemana} de {meta} treinos nesta semana</span>
        <div className="progress-bar" aria-hidden="true"><span style={{ width: `${progresso}%` }} /></div>
      </div>
    </section>
  );
}
