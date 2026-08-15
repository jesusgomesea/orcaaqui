import { useState } from "react";
import { Toaster } from "sonner";
import { StoreProvider } from "@/lib/store";
import { Sidebar } from "@/components/layout/Sidebar";
import PainelPage from "@/pages/PainelPage";
import OrcamentosPage from "@/pages/OrcamentosPage";
import ClientesPage from "@/pages/ClientesPage";
import ConfigPage from "@/pages/ConfigPage";

const PAGES = {
  painel: PainelPage,
  orcamentos: OrcamentosPage,
  clientes: ClientesPage,
  config: ConfigPage,
};

function Shell() {
  const [active, setActive] = useState("painel");
  const Page = PAGES[active] || PainelPage;

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text md:flex-row">
      <Sidebar active={active} onChange={setActive} />
      <main className="mx-auto w-full max-w-[1220px] flex-1 p-5 md:p-8">
        <Page />
      </main>
      <div id="orcamento-print" className="hidden" />
    </div>
  );
}

function App() {
  return (
    <StoreProvider>
      <Shell />
      <Toaster position="bottom-right" richColors closeButton />
    </StoreProvider>
  );
}

export default App;
