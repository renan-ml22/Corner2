import type { Metadata } from "next";
import TecnicasCliente, { type Aba } from "./TecnicasCliente";

export const metadata: Metadata = {
  title: "Biblioteca técnica · Corner",
};

const ABAS: Aba[] = ["golpes", "combinacoes", "defesa", "preparacao"];

export default async function TecnicasPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const { aba } = await searchParams;
  const inicial = ABAS.find(a => a === aba) ?? "golpes";
  return <TecnicasCliente abaInicial={inicial} />;
}
