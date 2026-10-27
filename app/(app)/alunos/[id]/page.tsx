import type { Metadata } from "next";
import FichaCliente from "./FichaCliente";

export const metadata: Metadata = {
  title: "Ficha do aluno · Corner",
};

export default async function FichaPage({ params }: PageProps<'/alunos/[id]'>) {
  const { id } = await params;
  return <FichaCliente id={id} />;
}
