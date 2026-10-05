import { logout } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/dal";

export default async function PerfilPage() {
  const user = await getCurrentUser();
  const initial = user.name.charAt(0).toUpperCase();

  return (
    <main className="page-container">
      <header>
        <p className="eyebrow">Seu Corner</p>
        <h1 className="page-title">Perfil</h1>
      </header>

      <section className="surface-card profile-header">
        <div className="avatar">{initial}</div>
        <div>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
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

      <form action={logout} style={{ marginTop: 24 }}>
        <button type="submit" className="surface-card logout-button">
          <i className="ph ph-sign-out" aria-hidden="true" /> Sair da conta
        </button>
      </form>
    </main>
  );
}
