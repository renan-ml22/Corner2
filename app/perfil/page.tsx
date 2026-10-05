export default function PerfilPage() {
  return (
    <main className="page-container">
      <header>
        <p className="eyebrow">Seu Corner</p>
        <h1 className="page-title">Perfil</h1>
      </header>

      <section className="surface-card profile-header">
        <div className="avatar">R</div>
        <div>
          <h2>Renan Lopes</h2>
          <p>Treinando desde janeiro de 2026</p>
        </div>
      </section>

      <div className="section-heading"><h2>Preferencias</h2></div>
      <section className="surface-card">
        <ul className="settings-list">
          <li>Objetivo <span>Forca e saude</span></li>
          <li>Frequencia <span>4x por semana</span></li>
          <li>Duracao media <span>35 minutos</span></li>
          <li>Notificacoes <span>Ativadas</span></li>
        </ul>
      </section>
    </main>
  );
}