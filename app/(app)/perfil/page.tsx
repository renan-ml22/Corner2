import { getCurrentUser } from "@/lib/dal";
import PreferenciasCard from "@/components/PreferenciasCard";
import SairButton from "@/components/SairButton";
import estilos from './perfil.module.css'

export default async function PerfilPage() {
  const user = await getCurrentUser();
  const initial = user.name.charAt(0).toUpperCase();

  return (
    <main className="page-container">
      <header>
        <p className="eyebrow">Seu Corner</p>
        <h1 className="page-title">Perfil</h1>
      </header>

      <section className={`surface-card ${estilos.profileHeader}`}>
        <div className={estilos.avatar}>{initial}</div>
        <div>
          <h2>{user.name}</h2>
          <p>{user.email}</p>
        </div>
      </section>

      <div className="section-heading"><h2>Preferências</h2></div>
      <PreferenciasCard />

      <SairButton />
    </main>
  );
}
