"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, Users, Settings, Wrench, Bell, LogOut, CloudOff, RefreshCw } from "lucide-react";
import { logout } from "@netlify/identity";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useSessao } from "@/components/auth/ProvedorSessao";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { NOVIDADES } from "@/lib/changelog";
import BotaoTema from "./BotaoTema";
import BotaoInstalar from "@/components/pwa/BotaoInstalar";

const ITEMS = [
  { href: "/painel", label: "Painel", icon: LayoutDashboard },
  { href: "/orcamentos", label: "Orçamentos", icon: FileText },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/servicos", label: "Serviços", icon: Wrench },
  { href: "/empresa", label: "Empresa", icon: Settings },
];

function contarNaoVistas(novidadesVistoId: string | null) {
  if (!novidadesVistoId) return NOVIDADES.length;
  const idx = NOVIDADES.findIndex((n) => n.id === novidadesVistoId);
  return idx === -1 ? NOVIDADES.length : idx;
}

const CLASSE_ITEM =
  "flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13.5px] font-semibold transition-colors cursor-pointer";

function Sidebar() {
  const { state, empresaAtiva, switchEmpresa, statusSincronizacao } = useStore();
  const { usuario } = useSessao();
  const pathname = usePathname();
  const naoVistas = contarNaoVistas(state.novidadesVistoId);

  const handleSair = async () => {
    try {
      await logout();
    } catch (e) {
      console.error("Falha ao encerrar a sessão.", e);
      toast.error("Não foi possível sair. Tente de novo.");
      return;
    }
    // Navegação completa é obrigatória aqui: router.push() faz navegação suave
    // e o cookie de sessão recém-limpo não chegaria ao servidor.
    window.location.href = "/";
  };

  return (
    <aside className="flex w-full shrink-0 flex-col gap-1 border-b border-border bg-surface p-4 md:h-screen md:w-56 md:border-b-0 md:border-r md:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="px-1.5 text-[17px] font-bold text-text">
          Orça <span className="text-primary">Aqui</span>
        </div>
        <BotaoTema />
      </div>

      {state.empresas.length > 1 ? (
        <div className="mb-3">
          <Select value={empresaAtiva.id} onValueChange={switchEmpresa}>
            <SelectTrigger className="text-[12.5px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {state.empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome || "(sem nome)"}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="mb-3 truncate px-1.5 text-[12px] text-text-muted">{empresaAtiva.nome || "Configure sua empresa"}</div>
      )}

      <nav className="flex flex-wrap gap-1 md:flex-col">
        {ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              CLASSE_ITEM,
              pathname === href ? "bg-primary-tint text-primary-dark" : "text-text-muted hover:bg-bg hover:text-text"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            <span className="hidden sm:inline">{label}</span>
          </Link>
        ))}
        <Link
          href="/novidades"
          className={cn(
            CLASSE_ITEM,
            pathname === "/novidades" ? "bg-primary-tint text-primary-dark" : "text-text-muted hover:bg-bg hover:text-text"
          )}
        >
          <span className="relative">
            <Bell className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            {naoVistas > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white">
                {naoVistas > 9 ? "9+" : naoVistas}
              </span>
            )}
          </span>
          <span className="hidden sm:inline">Novidades</span>
        </Link>
      </nav>

      <div className="mt-3 border-t border-border pt-3 md:mt-auto">
        {statusSincronizacao !== "ocioso" && (
          <div
            className={cn(
              "mb-2 flex items-center gap-1.5 px-1.5 text-[11px]",
              statusSincronizacao === "erro" ? "text-danger" : "text-text-muted"
            )}
          >
            {statusSincronizacao === "erro" ? (
              <><CloudOff className="h-3 w-3 shrink-0" strokeWidth={2} /> Alterações não salvas</>
            ) : (
              <><RefreshCw className="h-3 w-3 shrink-0 animate-spin" strokeWidth={2} /> Salvando…</>
            )}
          </div>
        )}
        <BotaoInstalar className="mb-1 w-full" />
        <div className="truncate px-1.5 text-[11.5px] text-text-muted" title={usuario?.email}>{usuario?.email}</div>
        <button type="button" onClick={handleSair} className={cn(CLASSE_ITEM, "mt-1 w-full text-text-muted hover:bg-bg hover:text-text")}>
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.8} />
          Sair
        </button>
      </div>
    </aside>
  );
}

export { Sidebar };
