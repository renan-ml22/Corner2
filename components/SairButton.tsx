"use client";

import { logout } from "@/app/actions/auth";

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
      style={{ marginTop: 24 }}
    >
      <button type="submit" className="surface-card logout-button">
        <i className="ph ph-sign-out" aria-hidden="true" /> Sair da conta
      </button>
    </form>
  );
}
