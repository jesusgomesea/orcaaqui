"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FileText, Users, Settings, Wrench, Bell, LogOut, CloudOff, RefreshCw, CalendarDays, Menu, Plus,
} from "lucide-react";
import { logout } from "@netlify/identity";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useSessao } from "@/components/auth/ProvedorSessao";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Marca } from "@/components/marca/Marca";
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

/** Atalho do botão "+": abre o montador na página de orçamentos. */
const HREF_MONTAR = "/orcamentos?montar=1";
/** Já na página de orçamentos, o "+" não navega (a página não remontaria): dispara este evento. */
export const EVENTO_MONTAR = "orcaaqui:montar";

function contarNaoVistas(novidadesVistoId: string | null) {
  if (!novidadesVistoId) return NOVIDADES.length;
  const idx = NOVIDADES.findIndex((n) => n.id === novidadesVistoId);
  return idx === -1 ? NOVIDADES.length : idx;
}

const CLASSE_ITEM =
  "flex items-center gap-3 rounded-full px-3.5 py-2.5 text-left text-[14px] font-medium transition-colors cursor-pointer";

/**
 * Navegação do app (visual inspirado no orgfinapp).
 * - Desktop (md+): coluna lateral sobre o fundo, itens em pílula e o botão
 *   "Montar orçamento" em destaque.
 * - Celular: topo leve (marca, empresa, tema) e barra de abas flutuante em
 *   pílula: Painel, Orçamentos, [+ Montar orçamento], Agenda e Mais
 *   (Clientes, Serviços, Empresa, Novidades, Sair).
 */
function Sidebar() {
  const { state, empresaAtiva, switchEmpresa, statusSincronizacao } = useStore();
  const { usuario } = useSessao();
  const pathname = usePathname();
  const naoVistas = contarNaoVistas(state.novidadesVistoId);
  // Guarda em qual rota o "Mais" foi aberto: trocar de página fecha sozinho.
  const [maisAbertoEm, setMaisAbertoEm] = useState<string | null>(null);
  const maisAberto = maisAbertoEm === pathname;
  const comProblema = statusSincronizacao === "erro" || statusSincronizacao === "conflito";

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
        <SelectTrigger className="h-9 bg-surface text-[13px] sm:h-9 sm:text-[13px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {state.empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome || "(sem nome)"}</SelectItem>)}
        </SelectContent>
      </Select>
    ) : (
      <div className="truncate text-[12.5px] text-text-muted">{empresaAtiva.nome || "Configure sua empresa"}</div>
    );

  const ativo = (href: string) => pathname === href;
  const abrirMontador = (e: React.MouseEvent) => {
    if (pathname !== "/orcamentos") return;
    e.preventDefault();
    window.dispatchEvent(new Event(EVENTO_MONTAR));
  };
  const maisAtivo = ["/clientes", "/servicos", "/empresa", "/novidades"].includes(pathname);

  const iconeSync = comProblema ? (
    <CloudOff className="h-4 w-4" strokeWidth={2} />
  ) : statusSincronizacao === "salvando" ? (
    <RefreshCw className="h-4 w-4 animate-spin" strokeWidth={2} />
  ) : null;

  const aba = (href: string, label: string, Icon: typeof LayoutDashboard) => (
    <Link
      key={href}
      href={href}
      aria-current={ativo(href) ? "page" : undefined}
      className={cn("flex min-w-0 flex-col items-center gap-0.5 text-[10.5px] font-medium", ativo(href) ? "text-text" : "text-text-muted")}
    >
      <Icon className={cn("h-[22px] w-[22px]", ativo(href) && "text-primary-texto")} strokeWidth={1.8} />
      <span className="max-w-full truncate">{label}</span>
      <span className={cn("h-1 w-1 rounded-full", ativo(href) ? "bg-primary" : "bg-transparent")} />
    </Link>
  );

  return (
    <>
      {/* ---------- Celular: topo ---------- */}
      <header
        className="sticky top-0 z-30 flex items-center gap-3 bg-bg/85 px-4 pb-2.5 backdrop-blur-md md:hidden"
        style={{ paddingTop: "max(0.625rem, env(safe-area-inset-top))" }}
      >
        <Marca tamanho={26} className="shrink-0" />
        <div className="min-w-0 flex-1 text-right">{seletorEmpresa}</div>
        {iconeSync && (
          <span
            className={cn("flex shrink-0 items-center", comProblema ? "text-danger" : "text-text-muted")}
            title={comProblema ? "Alterações não salvas" : "Salvando…"}
          >
            {iconeSync}
          </span>
        )}
        <BotaoTema />
      </header>

      {/* ---------- Celular: abas flutuantes ---------- */}
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-3 z-30 mx-auto grid h-16 max-w-[536px] grid-cols-5 items-center rounded-full border border-border bg-surface/85 px-1.5 shadow-[var(--shadow-lg)] backdrop-blur-xl md:hidden"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 10px)" }}
      >
        {aba("/painel", "Painel", LayoutDashboard)}
        {aba("/orcamentos", "Orçamentos", FileText)}
        <Link href={HREF_MONTAR} onClick={abrirMontador} aria-label="Montar orçamento" className="flex justify-center">
          <span className="grid h-[50px] w-[50px] place-items-center rounded-full bg-primary text-sobre-primary shadow-[var(--shadow-md)] transition-transform active:scale-95">
            <Plus className="h-[26px] w-[26px]" strokeWidth={2.2} />
          </span>
        </Link>
        {aba("/agenda", "Agenda", CalendarDays)}
        <button
          type="button"
          onClick={() => setMaisAbertoEm(maisAberto ? null : pathname)}
          aria-expanded={maisAberto}
          className={cn("flex flex-col items-center gap-0.5 text-[10.5px] font-medium cursor-pointer", maisAtivo || maisAberto ? "text-text" : "text-text-muted")}
        >
          <span className="relative">
            <Menu className={cn("h-[22px] w-[22px]", (maisAtivo || maisAberto) && "text-primary-texto")} strokeWidth={1.8} />
            {naoVistas > 0 && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-danger" />}
          </span>
          <span>Mais</span>
          <span className={cn("h-1 w-1 rounded-full", maisAtivo ? "bg-primary" : "bg-transparent")} />
        </button>
      </nav>

      {maisAberto && (
        <div className="fixed inset-0 z-20 bg-black/40 backdrop-blur-[2px] md:hidden" onClick={() => setMaisAbertoEm(null)}>
          <div
            className="absolute inset-x-3 mx-auto max-w-[536px] rounded-[var(--radius-cartao)] border border-border bg-surface p-2 shadow-[var(--shadow-lg)]"
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 86px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {ITEMS.slice(3).map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={cn(CLASSE_ITEM, "w-full", ativo(href) ? "bg-surface-2 text-text" : "text-text hover:bg-surface-2")}>
                <Icon className={cn("h-5 w-5 shrink-0", ativo(href) ? "text-primary-texto" : "text-text-muted")} strokeWidth={1.8} /> {label}
              </Link>
            ))}
            <Link href="/novidades" className={cn(CLASSE_ITEM, "w-full", ativo("/novidades") ? "bg-surface-2 text-text" : "text-text hover:bg-surface-2")}>
              <Bell className="h-5 w-5 shrink-0 text-text-muted" strokeWidth={1.8} /> Novidades
              {naoVistas > 0 && (
                <span className="ml-auto rounded-full bg-danger px-2 text-[11px] font-bold text-white">{naoVistas > 9 ? "9+" : naoVistas}</span>
              )}
            </Link>
            <div className="mt-1 border-t border-border pt-1">
              <div className="truncate px-3.5 py-1.5 text-[12px] text-text-muted">{usuario?.email}</div>
              <button type="button" onClick={handleSair} className={cn(CLASSE_ITEM, "w-full text-danger hover:bg-surface-2")}>
                <LogOut className="h-5 w-5 shrink-0" strokeWidth={1.8} /> Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Desktop: coluna lateral ---------- */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-1 p-5 md:flex">
        <div className="mb-4 flex items-center justify-between gap-2 px-1">
          <Marca />
          <BotaoTema />
        </div>

        <div className="mb-4 px-1">{seletorEmpresa}</div>

        <Link
          href={HREF_MONTAR}
          onClick={abrirMontador}
          className="mb-3 flex h-11 items-center justify-center gap-2 rounded-full bg-primary text-[14px] font-semibold text-sobre-primary transition-[filter,transform] hover:brightness-95 active:scale-[.98]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.4} /> Montar orçamento
        </Link>

        <nav className="flex flex-col gap-0.5">
          {ITEMS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={cn(CLASSE_ITEM, ativo(href) ? "bg-surface text-text" : "text-text-muted hover:bg-surface hover:text-text")}>
              <Icon className={cn("h-[18px] w-[18px] shrink-0", ativo(href) && "text-primary-texto")} strokeWidth={1.8} />
              <span>{label}</span>
            </Link>
          ))}
          <Link href="/novidades" className={cn(CLASSE_ITEM, ativo("/novidades") ? "bg-surface text-text" : "text-text-muted hover:bg-surface hover:text-text")}>
            <span className="relative">
              <Bell className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
              {naoVistas > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-danger px-0.5 text-[9px] font-bold text-white">
                  {naoVistas > 9 ? "9+" : naoVistas}
                </span>
              )}
            </span>
            <span>Novidades</span>
          </Link>
        </nav>

        <div className="mt-auto pt-3">
          {statusSincronizacao !== "ocioso" && (
            <div className={cn("mb-2 flex items-center gap-1.5 px-3.5 text-[11.5px]", comProblema ? "text-danger" : "text-text-muted")}>
              {comProblema ? (
                <><CloudOff className="h-3.5 w-3.5 shrink-0" strokeWidth={2} /> Alterações não salvas</>
              ) : (
                <><RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" strokeWidth={2} /> Salvando…</>
              )}
            </div>
          )}
          <div className="truncate px-3.5 text-[12px] text-text-muted" title={usuario?.email}>{usuario?.email}</div>
          <button type="button" onClick={handleSair} className={cn(CLASSE_ITEM, "mt-1 w-full text-text-muted hover:bg-surface hover:text-text")}>
            <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}

export { Sidebar };
