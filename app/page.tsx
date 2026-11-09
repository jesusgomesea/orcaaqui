import type { Metadata } from "next";
import Landing from "@/components/landing/Landing";

/**
 * A landing é a porta de entrada pública e circula como link (WhatsApp, redes),
 * então precisa de metadata própria. Por isso a página é Server Component e o
 * conteúdo mora numa ilha cliente: `export const metadata` não existe em
 * arquivo com "use client".
 */
const DESCRICAO =
  "Monte orçamentos com a logo e a cor da sua empresa, gere o PDF e envie pro cliente pelo WhatsApp. Sem mensalidade, com seus dados salvos na conta.";

export const metadata: Metadata = {
  title: "Orça Aqui — orçamentos profissionais em minutos",
  description: DESCRICAO,
  openGraph: {
    title: "Orça Aqui — orçamentos profissionais em minutos",
    description: DESCRICAO,
    type: "website",
    locale: "pt_BR",
    siteName: "Orça Aqui",
  },
  twitter: { card: "summary", title: "Orça Aqui", description: DESCRICAO },
};

export default function LandingPage() {
  return <Landing />;
}
