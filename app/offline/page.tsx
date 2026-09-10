import type { Metadata } from "next";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = { title: "Sem conexão — Orça Aqui" };

/**
 * Tela que o service worker serve quando a navegação falha por falta de rede.
 * O texto vem no HTML renderizado no servidor de propósito: se o JS não
 * carregar, a mensagem ainda aparece.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="max-w-[340px] text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-tint text-primary">
          <WifiOff className="h-6 w-6" strokeWidth={1.8} />
        </div>
        <h1 className="mb-2 text-[17px] font-bold text-text">Sem conexão</h1>
        <p className="text-[13.5px] leading-relaxed text-text-muted">
          Seus orçamentos ficam guardados na sua conta, então o Orça Aqui precisa de internet para
          carregá-los. Assim que a conexão voltar, é só recarregar a página.
        </p>
      </div>
    </div>
  );
}
