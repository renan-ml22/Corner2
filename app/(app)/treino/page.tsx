import { Suspense } from "react";
import type { Metadata } from "next";
import TreinoCliente from "./TreinoCliente";

export const metadata: Metadata = {
  title: "Treino · Corner",
};

export default function TreinoPage() {
  return (
    <Suspense fallback={<main className="page-container" aria-busy="true"><div className="skeleton" /></main>}>
      <TreinoCliente />
    </Suspense>
  );
}
