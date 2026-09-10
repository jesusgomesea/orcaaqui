"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSessao } from "./ProvedorSessao";

/**
 * Portão de entrada do app. A sessão é resolvida no cliente (ver
 * ProvedorSessao) — a garantia de verdade está no servidor: /api/dados só
 * responde com `getUser()` válido, então um cliente adulterado não alcança
 * dado de ninguém.
 */
export default function Protegido({ children }: { children: ReactNode }) {
  const { usuario, carregando } = useSessao();
  const router = useRouter();

  useEffect(() => {
    if (!carregando && !usuario) router.replace("/entrar");
  }, [carregando, usuario, router]);

  if (carregando || !usuario) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-[13.5px] text-text-muted">Carregando…</p>
      </div>
    );
  }

  return <>{children}</>;
}
