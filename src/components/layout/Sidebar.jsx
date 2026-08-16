import { LayoutDashboard, FileText, Users, Settings, Wrench, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { NOVIDADES } from "@/lib/changelog";

const ITEMS = [
  { key: "painel", label: "Painel", icon: LayoutDashboard },
  { key: "orcamentos", label: "Orçamentos", icon: FileText },
  { key: "clientes", label: "Clientes", icon: Users },
  { key: "servicos", label: "Serviços", icon: Wrench },
  { key: "config", label: "Empresa", icon: Settings },
];

function contarNaoVistas(novidadesVistoId) {
  if (!novidadesVistoId) return NOVIDADES.length;
  const idx = NOVIDADES.findIndex((n) => n.id === novidadesVistoId);
  return idx === -1 ? NOVIDADES.length : idx;
}

function Sidebar({ active, onChange }) {
  const { state, empresaAtiva, switchEmpresa } = useStore();
  const naoVistas = contarNaoVistas(state.novidadesVistoId);

  return (
    <aside className="flex w-full shrink-0 flex-col gap-1 border-b border-border bg-surface p-4 md:h-screen md:w-56 md:border-b-0 md:border-r md:p-5">
      <div className="mb-3 px-1.5 text-[17px] font-bold text-text">
        Orça <span className="text-primary">Aqui</span>
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
        {ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13.5px] font-semibold transition-colors cursor-pointer",
              active === key ? "bg-primary-tint text-primary-dark" : "text-text-muted hover:bg-bg hover:text-text"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => onChange("novidades")}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13.5px] font-semibold transition-colors cursor-pointer",
            active === "novidades" ? "bg-primary-tint text-primary-dark" : "text-text-muted hover:bg-bg hover:text-text"
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
        </button>
      </nav>
    </aside>
  );
}

export { Sidebar };
