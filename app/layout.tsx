import type { Metadata } from "next";
import { Toaster } from "sonner";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";
import ProvedorSessao from "@/components/auth/ProvedorSessao";
import { SCRIPT_TEMA } from "@/lib/tema";

export const metadata: Metadata = {
  title: "Orça Aqui — Orçamentos",
  description:
    "Monte e envie orçamentos profissionais em minutos. Seus dados ficam salvos na sua conta, acessíveis de qualquer dispositivo.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body>
        {/*
          ProvedorSessao mora aqui no layout raiz porque os links de e-mail do
          Identity (confirmação, recuperação, troca de e-mail) voltam com o
          token no hash e podem cair em qualquer página.
        */}
        <ProvedorSessao>{children}</ProvedorSessao>
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
