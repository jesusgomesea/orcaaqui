"use client";

import { Moon, Sun } from "lucide-react";
import { useTema } from "@/lib/useTema";

export default function BotaoTema({ className = "" }: { className?: string }) {
  const { tema, alternarTema } = useTema();
  const Icone = tema === "dark" ? Sun : Moon;
  const rotulo = tema === "dark" ? "Usar tema claro" : "Usar tema escuro";

  return (
    <button
      type="button"
      onClick={alternarTema}
      title={rotulo}
      aria-label={rotulo}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg hover:text-text cursor-pointer ${className}`}
    >
      <Icone className="h-4 w-4" strokeWidth={1.8} />
    </button>
  );
}
