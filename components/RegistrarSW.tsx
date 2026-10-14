"use client";

import { useEffect } from "react";

/** Registra o service worker só em produção (em desenvolvimento ele atrapalharia o hot reload). */
export default function RegistrarSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Sem service worker o app funciona normalmente, só não abre offline.
    });
  }, []);

  return null;
}
