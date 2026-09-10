import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Orça Aqui — Orçamentos",
    short_name: "Orça Aqui",
    description:
      "Monte orçamentos com a cara da sua empresa, envie por WhatsApp ou PDF e acompanhe o que foi aprovado.",
    lang: "pt-BR",
    dir: "ltr",
    // Instalado, o app abre direto no painel — a landing existe para quem
    // ainda não conhece o sistema.
    start_url: "/painel",
    scope: "/",
    display: "standalone",
    background_color: "#f4f6f9",
    theme_color: "#2563eb",
    categories: ["business", "productivity", "finance"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Maskable separado porque o sistema recorta em círculo/squircle: a
      // marca precisa caber na zona segura e o fundo, sangrar.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Novo orçamento", short_name: "Orçamentos", url: "/orcamentos" },
      { name: "Clientes", short_name: "Clientes", url: "/clientes" },
    ],
  };
}
