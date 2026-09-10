"use client";

import { useSyncExternalStore } from "react";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * `beforeinstallprompt` não está na lib padrão do TS porque não é padrão web:
 * é do Chromium. Safari não dispara — no iOS a instalação é manual, pelo menu
 * Compartilhar, e por isso o componente cai numa dica em vez de um botão.
 */
interface EventoDeInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Estado = "nada" | "ios" | "pronto";

// O evento vive fora do React de propósito: ele costuma disparar antes de
// qualquer componente montar, e guardá-lo em estado perderia essa janela.
let evento: EventoDeInstalacao | null = null;
const ouvintes = new Set<() => void>();

function notificar() {
  for (const aoMudar of ouvintes) aoMudar();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Sem isso o Chrome mostra o próprio banner na hora que quiser; segurando
    // o evento, a instalação acontece quando a pessoa clica no botão.
    e.preventDefault();
    evento = e as EventoDeInstalacao;
    notificar();
  });
  window.addEventListener("appinstalled", () => {
    evento = null;
    notificar();
  });
}

function subscrever(aoMudar: () => void) {
  ouvintes.add(aoMudar);
  return () => {
    ouvintes.delete(aoMudar);
  };
}

function jaInstalado() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari no iOS não implementa display-mode: standalone.
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

function lerNoCliente(): Estado {
  if (jaInstalado()) return "nada";
  if (evento) return "pronto";
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return "ios";
  return "nada";
}

function lerNoServidor(): Estado {
  return "nada";
}

export default function BotaoInstalar({ className }: { className?: string }) {
  const estado = useSyncExternalStore(subscrever, lerNoCliente, lerNoServidor);

  if (estado === "ios") {
    return (
      <p className={cn("text-[11px] leading-snug text-text-muted", className)}>
        Para instalar: toque em Compartilhar e depois em “Adicionar à Tela de Início”.
      </p>
    );
  }

  if (estado !== "pronto") return null;

  const instalar = async () => {
    if (!evento) return;
    await evento.prompt();
    await evento.userChoice;
    // O evento só serve uma vez.
    evento = null;
    notificar();
  };

  return (
    <button
      type="button"
      onClick={instalar}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13.5px] font-semibold text-text-muted transition-colors hover:bg-bg hover:text-text cursor-pointer",
        className
      )}
    >
      <Download className="h-4 w-4 shrink-0" strokeWidth={1.8} />
      Instalar app
    </button>
  );
}
