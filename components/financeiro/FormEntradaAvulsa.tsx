"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea, Label } from "@/components/ui/input";
import { CATEGORIAS_ENTRADA, categoriasSugeridas } from "@/lib/financeiro";
import { todayStr } from "@/lib/helpers";
import type { EntradaAvulsa } from "@/lib/tipos";

export type EntradaAvulsaForm = Omit<EntradaAvulsa, "id"> & { id?: string };

export function entradaAvulsaVazia(): EntradaAvulsaForm {
  return { data: todayStr(), descricao: "", categoria: "", valor: 0, forma: "Pix" };
}

/**
 * Formulário de uma entrada avulsa (dentro de um Dialog): dinheiro que entrou
 * sem ser pagamento de orçamento. Pagamento de trabalho continua sendo
 * registrado na Agenda, senão entraria duas vezes.
 */
export function FormEntradaAvulsa({ entrada, onFechar }: { entrada: EntradaAvulsaForm; onFechar: () => void }) {
  const { empresaAtiva, addEntradaAvulsa, updateEntradaAvulsa } = useStore();
  const [f, setF] = useState<EntradaAvulsaForm>(entrada);
  const set = (patch: Partial<EntradaAvulsaForm>) => setF((p) => ({ ...p, ...patch }));
  const idLista = useId();

  const salvar = () => {
    if (!f.descricao.trim()) { toast.error("Diga de onde veio o dinheiro (ex.: Venda do notebook)."); return; }
    if (!(f.valor > 0)) { toast.error("Informe um valor maior que zero."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.data)) { toast.error("Informe a data."); return; }
    const { id, ...campos } = f;
    const limpo: Omit<EntradaAvulsa, "id"> = {
      ...campos,
      descricao: campos.descricao.trim(),
      categoria: campos.categoria.trim(),
      forma: campos.forma?.trim() || undefined,
      observacoes: campos.observacoes?.trim() || undefined,
    };
    if (id) updateEntradaAvulsa(id, limpo);
    else addEntradaAvulsa(limpo);
    toast.success(id ? "Entrada atualizada." : "Entrada registrada.");
    onFechar();
  };

  return (
    <>
      <DialogTitle>{f.id ? "Editar entrada avulsa" : "Nova entrada avulsa"}</DialogTitle>
      <p className="-mt-1 mb-3 text-[12px] text-text-muted">
        Para dinheiro que não veio de um orçamento. Pagamento de trabalho se registra na Agenda.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>De onde veio *</Label>
          <Input value={f.descricao} onChange={(e) => set({ descricao: e.target.value })} placeholder="Ex: Venda do notebook" autoFocus />
        </div>
        <div>
          <Label>Valor ({empresaAtiva.moeda}) *</Label>
          <Input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={f.valor || ""}
            onChange={(e) => set({ valor: Math.max(0, Number(e.target.value) || 0) })}
          />
        </div>
        <div>
          <Label>Data *</Label>
          <Input type="date" value={f.data} onChange={(e) => set({ data: e.target.value })} />
        </div>
        <div>
          <Label>Categoria</Label>
          <Input list={idLista} value={f.categoria} onChange={(e) => set({ categoria: e.target.value })} placeholder="Ex: Venda de equipamento" />
          <datalist id={idLista}>
            {categoriasSugeridas(empresaAtiva.entradasAvulsas, CATEGORIAS_ENTRADA).map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div>
          <Label>Forma de recebimento</Label>
          <Input value={f.forma ?? ""} onChange={(e) => set({ forma: e.target.value })} placeholder="Pix, cartão, dinheiro…" />
        </div>
        <div className="sm:col-span-2">
          <Label>Observações</Label>
          <Textarea rows={2} value={f.observacoes ?? ""} onChange={(e) => set({ observacoes: e.target.value })} />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onFechar}>Cancelar</Button>
        <Button onClick={salvar}>Salvar</Button>
      </div>
    </>
  );
}
