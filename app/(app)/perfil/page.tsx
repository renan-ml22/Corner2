import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/dal";
import CabecalhoDoPerfil from "@/components/CabecalhoDoPerfil";
import PreferenciasCard from "@/components/PreferenciasCard";
import SairButton from "@/components/SairButton";

export const metadata: Metadata = {
  title: "Perfil · Corner",
};

export default async function PerfilPage() {
  const user = await getCurrentUser();

  return (
    <main className="page-container">
      <header>
        <p className="eyebrow">Seu Corner</p>
        <h1 className="page-title">Perfil</h1>
      </header>

      <CabecalhoDoPerfil nome={user.name} email={user.email} />

      <div className="section-heading"><h2>Preferências</h2></div>
      <PreferenciasCard />

      <SairButton />
    </main>
  );
}
