const days = [
  ["S", true],
  ["T", true],
  ["Q", true],
  ["Q", true],
  ["S", true],
  ["S", false],
  ["D", false],
] as const;

export default function StreakCard() {
  return (
    <section className="surface-card streak-card" aria-label="Sequencia semanal">
      <div className="streak-card-top">
        <div>
          <p className="streak-label">Sequencia atual</p>
          <p className="streak-number">12 <span>dias</span></p>
        </div>
        <div className="streak-mark" aria-hidden="true">✦</div>
      </div>
      <div className="week-row">
        {days.map(([day, done], index) => (
          <div className={`day-dot${done ? " done" : ""}${index === 4 ? " today" : ""}`} key={`${day}-${index}`}>
            <i>{done ? "✓" : "·"}</i>
            {day}
          </div>
        ))}
      </div>
    </section>
  );
}