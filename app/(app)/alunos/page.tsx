import type { Metadata } from "next";
import AlunosCliente from "./AlunosCliente";

export const metadata: Metadata = {
  title: "Meus Alunos · Corner",
};

export default function AlunosPage() {
  return <AlunosCliente />;
}
