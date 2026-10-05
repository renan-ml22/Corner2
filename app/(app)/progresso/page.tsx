export default function ProgressoPage() {
  return (
    <main className="page-container">
      <header>
        <p className="eyebrow">O que voce construiu</p>
        <h1 className="page-title">Seu progresso</h1>
        <p className="muted-copy">Pequenas vitorias, acumuladas todos os dias.</p>
      </header>

      <div className="section-heading">
        <h2>Resumo</h2>
        <span>Ultimos 30 dias</span>
      </div>
      <div className="stat-grid">
        <section className="surface-card stat-card"><p className="stat-label">Treinos feitos</p><p className="stat-value">18</p></section>
        <section className="surface-card stat-card"><p className="stat-label">Tempo total</p><p className="stat-value">9h 42</p></section>
        <section className="surface-card stat-card"><p className="stat-label">Sequencia</p><p className="stat-value">12d</p></section>
        <section className="surface-card stat-card"><p className="stat-label">Melhor semana</p><p className="stat-value">5x</p></section>
      </div>

      <div className="section-heading">
        <h2>Frequencia semanal</h2>
        <span>Meta: 4 treinos</span>
      </div>
      <section className="surface-card stat-card">
        <p className="stat-label">Media atual</p>
        <p className="stat-value">4.2 treinos</p>
        <div className="progress-bar"><span /></div>
      </section>
    </main>
  );
}