"use client";

import { logout } from "@/app/actions/auth";
import estilos from './SairButton.module.css'

async function limparCachesOffline() {
  try {
    // Telas guardadas para uso offline contêm dados da conta: não podem sobrar no aparelho depois do logout.
    const nomes = await caches.keys();
    await Promise.all(nomes.map(n => caches.delete(n)));
  } catch {
    // Sem Cache API: nada a limpar.
  }
}

export default function SairButton() {
  return (
    <form
      action={async () => {
        await limparCachesOffline();
        await logout();
      }}
      className={estilos.formulario}
    >
      <button type="submit" className={`surface-card ${estilos.logoutButton}`}>
        <i className="ph ph-sign-out" aria-hidden="true" /> Sair da conta
      </button>
    </form>
  );
}
