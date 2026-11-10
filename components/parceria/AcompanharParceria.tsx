"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatDateBR, formatMoney, todayStr, uuid } from "@/lib/helpers";
import { atrasada, nomeTipoContrapartida, progresso } from "@/lib/parceria";
import type { Contrapartida, Orcamento } from "@/lib/tipos";

const ehLink = (t: string) => /^https?:\/\/\S+$/i.test(t.trim());

/** Uma contrapartida: progresso, prazo e os registros do que o parceiro já cumpriu. */
function ItemContrapartida({ c, moeda, hoje, onChange }: { c: Contrapartida; moeda: Orcamento["moeda"]; hoje: string; onChange: (c: Contrapartida) => void }) {
  const [detalhe, setDetalhe] = useState("");
  const [data, setData] = useState(hoje);
  const { feitas, total, cumprida } = progresso(c);
  const vencida = atrasada(c, hoje);

  const registrar = () => {
    onChange({ ...c, registros: [...c.registros, { id: uuid(), data: data || hoje, detalhe: detalhe.trim() }] });
    setDetalhe("");
    toast.success(feitas + 1 >= total ? "Contrapartida cumprida." : "Registrado.");
  };

  return (
    <li className="rounded-2xl bg-surface-2/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-text">
            {total > 1 ? `${total}× ` : ""}
            {c.descricao || nomeTipoContrapartida(c.tipo)}
          </div>
          <div className="text-[12px] text-text-muted">
            {nomeTipoContrapartida(c.tipo)}
            {c.tipo === "permuta" && c.valorEstimado > 0 && ` · vale ${formatMoney(c.valorEstimado, moeda)}`}
            {c.prazo && <span className={cn(vencida && "font-semibold text-danger")}> · até {formatDateBR(c.prazo)}{vencida && " (atrasada)"}</span>}
          </div>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold",
            cumprida ? "bg-success-tint text-success" : "bg-warning-tint text-warning"
          )}
        >
          {cumprida && <Check className="h-3 w-3" />} {feitas}/{total}
        </span>
      </div>

      {c.registros.length > 0 && (
        <ul className="mt-2 space-y-1 text-[12.5px]">
          {c.registros.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-text">
                <span className="text-text-muted">{r.data ? formatDateBR(r.data) : "—"} · </span>
                {ehLink(r.detalhe) ? (
                  <a href={r.detalhe} target="_blank" rel="noopener noreferrer" className="text-primary-texto underline-offset-2 hover:underline">
                    {r.detalhe.replace(/^https?:\/\/(www\.)?/, "")}
                  </a>
                ) : (
                  r.detalhe || "feito"
                )}
              </span>
              <button
                type="button"
                className="shrink-0 text-text-muted hover:text-danger cursor-pointer"
                aria-label="Remover registro"
                onClick={() => onChange({ ...c, registros: c.registros.filter((x) => x.id !== r.id) })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!cumprida && (
        <div className="mt-2 flex flex-wrap gap-2 sm:flex-nowrap">
          <Input className="min-w-0 flex-1 sm:w-36 sm:flex-none" type="date" value={data} onChange={(e) => setData(e.target.value)} aria-label="Data" />
          <Input
            className="order-first w-full sm:order-none sm:w-auto sm:min-w-0 sm:flex-1"
            value={detalhe}
            placeholder={c.tipo === "indicacao" ? "Quem foi indicado" : "Link do post (opcional)"}
            onChange={(e) => setDetalhe(e.target.value)}
          />
          <Button type="button" variant="secondary" size="icon" aria-label="Registrar" onClick={registrar}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}
    </li>
  );
}

/** Seção da Agenda: o que o parceiro já cumpriu de cada contrapartida. */
export function AcompanharParceria({ orcamento }: { orcamento: Orcamento }) {
  const { updateOrcamento } = useStore();
  const p = orcamento.parceria;
  if (!p) return null;
  const hoje = todayStr();
  const cumpridas = p.contrapartidas.filter((c) => progresso(c).cumprida).length;

  return (
    <section className="mb-4 rounded-2xl border border-border p-3.5 text-[13px]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold text-text">Contrapartidas da parceria</span>
        <span className="text-[12px] text-text-muted">
          {cumpridas} de {p.contrapartidas.length} cumpridas
        </span>
      </div>
      {p.contrapartidas.length === 0 ? (
        <p className="text-[12.5px] text-text-muted">Nenhuma contrapartida cadastrada. Edite o orçamento para incluir.</p>
      ) : (
        <ul className="space-y-2">
          {p.contrapartidas.map((c) => (
            <ItemContrapartida
              key={c.id}
              c={c}
              moeda={orcamento.moeda}
              hoje={hoje}
              onChange={(nova) =>
                updateOrcamento(orcamento.id, { parceria: { contrapartidas: p.contrapartidas.map((x) => (x.id === nova.id ? nova : x)) } })
              }
            />
          ))}
        </ul>
      )}
    </section>
  );
}
