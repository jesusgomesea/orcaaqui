import type { ReactNode } from "react";
import Protegido from "@/components/auth/Protegido";
import { StoreProvider } from "@/lib/store";
import { Sidebar } from "@/components/layout/Sidebar";
import { CorDaEmpresa } from "@/components/layout/CorDaEmpresa";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Protegido>
      <StoreProvider>
        <div className="flex min-h-screen flex-col bg-bg text-text md:flex-row">
          <CorDaEmpresa />
          <Sidebar />
          {/* pb-32 no celular: a barra de abas flutuante não pode cobrir o fim da página. */}
          <main className="mx-auto w-full min-w-0 max-w-[1220px] flex-1 px-4 pt-3 pb-32 md:p-8 md:pl-4">{children}</main>
          {/* Container do documento impresso — ver gerarOrcamentoHtml. */}
          <div id="orcamento-print" className="hidden" />
        </div>
      </StoreProvider>
    </Protegido>
  );
}
