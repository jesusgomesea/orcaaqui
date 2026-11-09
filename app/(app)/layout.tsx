import type { ReactNode } from "react";
import Protegido from "@/components/auth/Protegido";
import { StoreProvider } from "@/lib/store";
import { Sidebar } from "@/components/layout/Sidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Protegido>
      <StoreProvider>
        <div className="flex min-h-screen flex-col bg-bg text-text md:flex-row">
          <Sidebar />
          {/* pb-24 no celular: a navegação fixa de baixo não pode cobrir o fim da página. */}
          <main className="mx-auto w-full min-w-0 max-w-[1220px] flex-1 px-4 pt-4 pb-24 md:p-8">{children}</main>
          {/* Container do documento impresso — ver gerarOrcamentoHtml. */}
          <div id="orcamento-print" className="hidden" />
        </div>
      </StoreProvider>
    </Protegido>
  );
}
