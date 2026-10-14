import type { Metadata } from "next";
import SaudeCliente from "./SaudeCliente";

export const metadata: Metadata = {
  title: "Saúde e corpo · Corner",
};

export default function SaudePage() {
  return <SaudeCliente />;
}
