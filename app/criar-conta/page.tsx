import type { Metadata } from "next";
import FormularioAuth from "@/components/auth/FormularioAuth";

export const metadata: Metadata = { title: "Criar conta — Orça Aqui" };

export default function CriarContaPage() {
  return <FormularioAuth modo="cadastrar" />;
}
