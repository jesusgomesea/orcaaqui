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
          <main className="mx-auto w-full max-w-[1220px] flex-1 p-5 md:p-8">{children}</main>
          {/* Container do documento impresso — ver gerarOrcamentoHtml. */}
          <div id="orcamento-print" className="hidden" />
        </div>
      </StoreProvider>
    </Protegido>
  );
}
