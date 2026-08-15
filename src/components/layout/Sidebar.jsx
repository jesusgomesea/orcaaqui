import { LayoutDashboard, FileText, Users, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { key: "painel", label: "Painel", icon: LayoutDashboard },
  { key: "orcamentos", label: "Orçamentos", icon: FileText },
  { key: "clientes", label: "Clientes", icon: Users },
  { key: "config", label: "Empresa", icon: Settings },
];

function Sidebar({ active, onChange }) {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-1 border-b border-border bg-surface p-4 md:h-screen md:w-56 md:border-b-0 md:border-r md:p-5">
      <div className="mb-4 px-1.5 text-[17px] font-bold text-text">
        Orça <span className="text-primary">Aqui</span>
      </div>
      <nav className="flex gap-1 md:flex-col">
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
      </nav>
    </aside>
  );
}

export { Sidebar };
