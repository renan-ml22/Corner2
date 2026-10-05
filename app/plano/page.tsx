export default function PlanoPage() {
  return (
    <main className="page-container">
      <header>
        <p className="eyebrow">Sua rotina</p>
        <h1 className="page-title">Plano de treino</h1>
        <p className="muted-copy">Uma semana consistente com espaco para evoluir.</p>
      </header>

      <div className="section-heading">
        <h2>Esta semana</h2>
        <span>4 sessoes</span>
      </div>
      <section className="surface-card checklist-card">
        <ul className="settings-list">
          <li><strong>Segunda</strong><span>Forca · Concluido</span></li>
          <li><strong>Quarta</strong><span>Mobilidade · Concluido</span></li>
          <li><strong>Sexta</strong><span>Forca e estabilidade</span></li>
          <li><strong>Domingo</strong><span>Corrida leve</span></li>
        </ul>
      </section>

      <div className="section-heading">
        <h2>Meta do mes</h2>
        <span>12 / 16 treinos</span>
      </div>
      <section className="surface-card stat-card">
        <p className="stat-label">Consistencia</p>
        <p className="stat-value">75%</p>
        <div className="progress-bar"><span /></div>
      </section>
    </main>
  );
}