"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FormSaida, saidaVazia, type SaidaForm } from "./FormSaida";
import { resultadoDoOrcamento, saidasOrdenadas } from "@/lib/financeiro";
import { formatDateBR, formatMoney } from "@/lib/helpers";
import { cn } from "@/lib/utils";
import type { Orcamento } from "@/lib/tipos";

/**
 * Custos e resultado de um trabalho: saídas ligadas ao orçamento (Uber,
 * impressão…) contra o que já foi recebido nele. Registrar uma saída aqui já
 * a liga ao orçamento.
 */
export function ResultadoTrabalho({ orcamento }: { orcamento: Orcamento }) {
  const { empresaAtiva } = useStore();
  const [editando, setEditando] = useState<SaidaForm | null>(null);
  const r = resultadoDoOrcamento(empresaAtiva, orcamento);
  const ligadas = saidasOrdenadas(empresaAtiva.saidas.filter((s) => s.orcamentoId === orcamento.id));
  const $ = (v: number) => formatMoney(v, empresaAtiva.moeda);

  return (
    <section className="mb-4 rounded-2xl border border-border p-3.5 text-[13px]">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="font-semibold text-text">Custos e resultado</span>
        <Button size="sm" variant="secondary" onClick={() => setEditando(saidaVazia(orcamento.id))}>
          <Plus className="h-3.5 w-3.5" strokeWidth={1.8} /> Registrar saída
        </Button>
      </div>

      {ligadas.length === 0 ? (
        <p className="text-[12.5px] text-text-muted">Nenhuma saída ligada a este trabalho (deslocamento, impressão, assistente…).</p>
      ) : (
        <ul className="space-y-1">
          {ligadas.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2">
              <button type="button" className="min-w-0 truncate text-left text-text hover:underline cursor-pointer" onClick={() => setEditando({ ...s })}>
                {s.descricao}
                <span className="text-text-muted"> · {formatDateBR(s.data)}{s.categoria ? ` · ${s.categoria}` : ""}</span>
              </button>
              <span className="shrink-0 text-danger">−{$(s.valor)}</span>
            </li>
          ))}
        </ul>
      )}

      {r.moedaDiferente ? (
        <p className="mt-2 text-[11.5px] text-text-muted">Este orçamento está em outra moeda; o resultado não é calculado.</p>
      ) : (
        <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-border pt-2.5 text-center">
          <div><div className="text-[11.5px] text-text-muted">Recebido</div><div className="font-semibold text-text">{$(r.recebido)}</div></div>
          <div><div className="text-[11.5px] text-text-muted">Custos</div><div className="font-semibold text-text">{$(r.custos)}</div></div>
          <div>
            <div className="text-[11.5px] text-text-muted">Resultado</div>
            <div className={cn("font-semibold", r.resultado < 0 ? "text-danger" : "text-success")}>{$(r.resultado)}</div>
          </div>
        </div>
      )}

      <Dialog open={!!editando} onOpenChange={(aberto) => !aberto && setEditando(null)}>
        <DialogContent>
          {editando && <FormSaida key={editando.id ?? "nova"} saida={editando} onFechar={() => setEditando(null)} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}
