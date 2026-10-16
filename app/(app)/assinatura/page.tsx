import type { Metadata } from "next";
import { Suspense } from "react";
import AssinaturaCliente from "./AssinaturaCliente";

export const metadata: Metadata = {
  title: "Assinatura · Corner",
};

export default function AssinaturaPage() {
  // useSearchParams (retorno do pagamento) exige um limite de Suspense.
  return (
    <Suspense fallback={<main className="page-container" aria-busy="true"><div className="skeleton" /></main>}>
      <AssinaturaCliente />
    </Suspense>
  );
}
