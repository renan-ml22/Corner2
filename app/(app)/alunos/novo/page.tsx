import type { Metadata } from "next";
import NovoAlunoCliente from "./NovoAlunoCliente";

export const metadata: Metadata = {
  title: "Novo aluno · Corner",
};

export default function NovoAlunoPage() {
  return <NovoAlunoCliente />;
}
