import estilos from './StreakCard.module.css'

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
    <section className={`surface-card ${estilos.streakCard}`} aria-label="Sequência semanal">
      <div className={estilos.streakCardTop}>
        <div>
          <p className={estilos.streakLabel}>Sequência atual</p>
          <p className={estilos.streakNumber}>
            {sequencia} <span>{sequencia === 1 ? "semana na meta" : "semanas na meta"}</span>
          </p>
        </div>
        <div className={estilos.streakMark} aria-hidden="true"><i className="ph-fill ph-fire" /></div>
      </div>
      <div className={estilos.weekRow}>
        {dias.map((feito, index) => (
          <div
            className={`${estilos.dayDot}${feito ? ` ${estilos.done}` : ""}${index === hojeIndex ? ` ${estilos.today}` : ""}`}
            key={index}
            aria-label={`${LETRAS[index]}: ${feito ? "treinou" : "sem treino"}`}
          >
            <i aria-hidden="true">{feito ? "✓" : "·"}</i>
            {LETRAS[index]}
          </div>
        ))}
      </div>
      <div className={estilos.streakGoal}>
        <span>{feitosSemana} de {meta} treinos nesta semana</span>
        <div className="progress-bar" aria-hidden="true"><span style={{ width: `${progresso}%` }} /></div>
      </div>
    </section>
  );
}
