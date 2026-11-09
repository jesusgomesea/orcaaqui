"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, Users, Settings, Wrench, Bell, LogOut, CloudOff, RefreshCw, CalendarDays, Menu } from "lucide-react";
import { logout } from "@netlify/identity";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useSessao } from "@/components/auth/ProvedorSessao";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { NOVIDADES } from "@/lib/changelog";
import BotaoTema from "./BotaoTema";

const ITEMS = [
  { href: "/painel", label: "Painel", icon: LayoutDashboard },
  { href: "/orcamentos", label: "Orçamentos", icon: FileText },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/servicos", label: "Serviços", icon: Wrench },
  { href: "/empresa", label: "Empresa", icon: Settings },
];

/** No celular, estes ficam na barra de baixo; os demais vão para "Mais". */
const PRINCIPAIS = ["/painel", "/orcamentos", "/agenda", "/clientes"];

function contarNaoVistas(novidadesVistoId: string | null) {
  if (!novidadesVistoId) return NOVIDADES.length;
  const idx = NOVIDADES.findIndex((n) => n.id === novidadesVistoId);
  return idx === -1 ? NOVIDADES.length : idx;
}

const CLASSE_ITEM =
  "flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13.5px] font-semibold transition-colors cursor-pointer";

/**
 * Navegação do app. Desktop (md+): barra lateral fixa. Celular: barra compacta
 * no topo (marca, empresa, tema) e navegação fixa embaixo com os 4 destinos
 * principais + "Mais" (serviços, empresa, novidades, sair) — antes a barra
 * lateral empilhada ocupava quase meia tela em todas as páginas.
 */
function Sidebar() {
  const { state, empresaAtiva, switchEmpresa, statusSincronizacao } = useStore();
  const { usuario } = useSessao();
  const pathname = usePathname();
  const naoVistas = contarNaoVistas(state.novidadesVistoId);
  // Guarda em qual rota o "Mais" foi aberto: trocar de página fecha sozinho.
  const [maisAbertoEm, setMaisAbertoEm] = useState<string | null>(null);
  const maisAberto = maisAbertoEm === pathname;

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

  const seletorEmpresa =
    state.empresas.length > 1 ? (
      <Select value={empresaAtiva.id} onValueChange={switchEmpresa}>
        <SelectTrigger className="h-8 text-[12.5px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {state.empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome || "(sem nome)"}</SelectItem>)}
        </SelectContent>
      </Select>
    ) : (
      <div className="truncate text-[12px] text-text-muted">{empresaAtiva.nome || "Configure sua empresa"}</div>
    );

  const secundarios = ITEMS.filter((i) => !PRINCIPAIS.includes(i.href));
  const maisAtivo = pathname === "/novidades" || secundarios.some((i) => i.href === pathname);
  const classeAbaBaixo = (ativo: boolean) =>
    cn(
      "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md py-1.5 text-[10.5px] font-semibold cursor-pointer",
      ativo ? "text-primary" : "text-text-muted"
    );
  const classeLink = (ativo: boolean) => cn(CLASSE_ITEM, ativo ? "bg-primary-tint text-primary-dark" : "text-text-muted hover:bg-bg hover:text-text");

  const sync =
    statusSincronizacao === "ocioso" ? null : statusSincronizacao === "erro" ? (
      <><CloudOff className="h-3 w-3 shrink-0" strokeWidth={2} /> Alterações não salvas</>
    ) : (
      <><RefreshCw className="h-3 w-3 shrink-0 animate-spin" strokeWidth={2} /> Salvando…</>
    );

  return (
    <>
      {/* ---------- Celular: topo ---------- */}
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-surface px-4 py-2.5 md:hidden">
        <div className="shrink-0 text-[16px] font-bold text-text">
          Orça <span className="text-primary">Aqui</span>
        </div>
        <div className="min-w-0 flex-1">{seletorEmpresa}</div>
        {sync && (
          <span
            className={cn("flex shrink-0 items-center", statusSincronizacao === "erro" ? "text-danger" : "text-text-muted")}
            title={statusSincronizacao === "erro" ? "Alterações não salvas" : "Salvando…"}
          >
            {statusSincronizacao === "erro" ? <CloudOff className="h-4 w-4" strokeWidth={2} /> : <RefreshCw className="h-4 w-4 animate-spin" strokeWidth={2} />}
          </span>
        )}
        <BotaoTema />
      </header>

      {/* ---------- Celular: navegação de baixo ---------- */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex items-stretch gap-1 border-t border-border bg-surface px-2 pt-1 md:hidden"
        style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
        aria-label="Navegação principal"
      >
        {ITEMS.filter((i) => PRINCIPAIS.includes(i.href)).map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={classeAbaBaixo(pathname === href)} aria-current={pathname === href ? "page" : undefined}>
            <Icon className="h-5 w-5" strokeWidth={1.8} />
            <span className="max-w-full truncate">{label}</span>
          </Link>
        ))}
        <button
          type="button"
          className={classeAbaBaixo(maisAtivo || maisAberto)}
          onClick={() => setMaisAbertoEm(maisAberto ? null : pathname)}
          aria-expanded={maisAberto}
        >
          <span className="relative">
            <Menu className="h-5 w-5" strokeWidth={1.8} />
            {naoVistas > 0 && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-danger" />}
          </span>
          <span>Mais</span>
        </button>
      </nav>

      {maisAberto && (
        <div className="fixed inset-0 z-20 bg-black/30 md:hidden" onClick={() => setMaisAbertoEm(null)}>
          <div
            className="absolute inset-x-2 rounded-xl border border-border bg-surface p-2 shadow-[var(--shadow-lg)]"
            style={{ bottom: "calc(4rem + env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            {secundarios.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={cn(classeLink(pathname === href), "w-full")}>
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} /> {label}
              </Link>
            ))}
            <Link href="/novidades" className={cn(classeLink(pathname === "/novidades"), "w-full")}>
              <Bell className="h-4 w-4 shrink-0" strokeWidth={1.8} /> Novidades
              {naoVistas > 0 && (
                <span className="ml-auto rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">{naoVistas > 9 ? "9+" : naoVistas}</span>
              )}
            </Link>
            <div className="mt-1 border-t border-border pt-1">
              <div className="truncate px-3 py-1 text-[11.5px] text-text-muted">{usuario?.email}</div>
              <button type="button" onClick={handleSair} className={cn(CLASSE_ITEM, "w-full text-text-muted hover:bg-bg hover:text-text")}>
                <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.8} /> Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Desktop: barra lateral ---------- */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col gap-1 border-r border-border bg-surface p-5 md:flex">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="px-1.5 text-[17px] font-bold text-text">
            Orça <span className="text-primary">Aqui</span>
          </div>
          <BotaoTema />
        </div>

        <div className="mb-3 px-1.5">{seletorEmpresa}</div>

        <nav className="flex flex-col gap-1">
          {ITEMS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={classeLink(pathname === href)}>
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
              <span>{label}</span>
            </Link>
          ))}
          <Link href="/novidades" className={classeLink(pathname === "/novidades")}>
            <span className="relative">
              <Bell className="h-4 w-4 shrink-0" strokeWidth={1.8} />
              {naoVistas > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white">
                  {naoVistas > 9 ? "9+" : naoVistas}
                </span>
              )}
            </span>
            <span>Novidades</span>
          </Link>
        </nav>

        <div className="mt-auto border-t border-border pt-3">
          {sync && (
            <div className={cn("mb-2 flex items-center gap-1.5 px-1.5 text-[11px]", statusSincronizacao === "erro" ? "text-danger" : "text-text-muted")}>
              {sync}
            </div>
          )}
          <div className="truncate px-1.5 text-[11.5px] text-text-muted" title={usuario?.email}>{usuario?.email}</div>
          <button type="button" onClick={handleSair} className={cn(CLASSE_ITEM, "mt-1 w-full text-text-muted hover:bg-bg hover:text-text")}>
            <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}

export { Sidebar };
