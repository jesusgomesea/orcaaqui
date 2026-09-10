import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";
import ProvedorSessao from "@/components/auth/ProvedorSessao";
import RegistroServiceWorker from "@/components/pwa/RegistroServiceWorker";
import { SCRIPT_TEMA } from "@/lib/tema";

export const metadata: Metadata = {
  title: "Orça Aqui — Orçamentos",
  description:
    "Monte e envie orçamentos profissionais em minutos. Seus dados ficam salvos na sua conta, acessíveis de qualquer dispositivo.",
  applicationName: "Orça Aqui",
  icons: {
    icon: [
      { url: "/icone.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  // Faz o iOS abrir em tela cheia quando adicionado à tela de início; no
  // Android/desktop quem manda é o `display` do manifest.
  appleWebApp: { capable: true, title: "Orça Aqui", statusBarStyle: "default" },
  // O Next emite só o `mobile-web-app-capable` novo; iOS anterior ao 16.4
  // (que passou a respeitar o `display` do manifest) ainda quer o legado.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  // Pinta a barra do navegador junto com o tema da página.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f9" },
    { media: "(prefers-color-scheme: dark)", color: "#12161f" },
  ],
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
        <RegistroServiceWorker />
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
