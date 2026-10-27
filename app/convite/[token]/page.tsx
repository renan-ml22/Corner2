import type { Metadata } from "next";
import ConviteCliente from "./ConviteCliente";

export const metadata: Metadata = {
  title: "Convite · Corner",
  // O endereço leva o token do convite: não vale a pena guardar em buscadores.
  robots: { index: false, follow: false },
};

export default async function ConvitePage({ params }: PageProps<'/convite/[token]'>) {
  const { token } = await params;
  return <ConviteCliente token={token} />;
}
