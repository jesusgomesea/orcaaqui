import type { Metadata } from "next";
import FormularioAuth from "@/components/auth/FormularioAuth";

export const metadata: Metadata = { title: "Entrar — Orça Aqui" };

export default function EntrarPage() {
  return <FormularioAuth modo="entrar" />;
}
