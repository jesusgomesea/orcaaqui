"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { categoriasSugeridas } from "@/lib/financeiro";
import { formatarNumeroOrcamento, todayStr } from "@/lib/helpers";
import type { Saida } from "@/lib/tipos";

const SEM_ORCAMENTO = "__nenhum__";

export type SaidaForm = Omit<Saida, "id"> & { id?: string };

export function saidaVazia(orcamentoId?: string): SaidaForm {
  return { data: todayStr(), descricao: "", categoria: "", valor: 0, forma: "Pix", ...(orcamentoId ? { orcamentoId } : {}) };
}

/**
 * Formulário de uma saída (dentro de um Dialog). Grava direto no store: nova
 * quando `saida.id` está vazio, edição quando tem id.
 */
export function FormSaida({ saida, onFechar }: { saida: SaidaForm; onFechar: () => void }) {
  const { empresaAtiva, addSaida, updateSaida } = useStore();
  const [f, setF] = useState<SaidaForm>(saida);
  const set = (patch: Partial<SaidaForm>) => setF((p) => ({ ...p, ...patch }));
  const idLista = useId();

  const orcamentos = [...empresaAtiva.orcamentos].sort((a, b) => b.numero - a.numero);
  const nomeCliente = (id: string) => empresaAtiva.clientes.find((c) => c.id === id)?.nome || "sem cliente";

  const salvar = () => {
    if (!f.descricao.trim()) { toast.error("Diga o que foi pago (ex.: Tripé novo)."); return; }
    if (!(f.valor > 0)) { toast.error("Informe um valor maior que zero."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.data)) { toast.error("Informe a data."); return; }
    const { id, ...campos } = f;
    const limpo: Omit<Saida, "id"> = {
      ...campos,
      descricao: campos.descricao.trim(),
      categoria: campos.categoria.trim(),
      forma: campos.forma?.trim() || undefined,
      observacoes: campos.observacoes?.trim() || undefined,
      orcamentoId: campos.orcamentoId || undefined,
    };
    if (id) updateSaida(id, limpo);
    else addSaida(limpo);
    toast.success(id ? "Saída atualizada." : "Saída registrada.");
    onFechar();
  };

  return (
    <>
      <DialogTitle>{f.id ? "Editar saída" : "Nova saída"}</DialogTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>O que foi pago *</Label>
          <Input value={f.descricao} onChange={(e) => set({ descricao: e.target.value })} placeholder="Ex: Tripé novo" autoFocus />
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
          <Input list={idLista} value={f.categoria} onChange={(e) => set({ categoria: e.target.value })} placeholder="Ex: Equipamento" />
          <datalist id={idLista}>
            {categoriasSugeridas(empresaAtiva.saidas).map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div>
          <Label>Forma de pagamento</Label>
          <Input value={f.forma ?? ""} onChange={(e) => set({ forma: e.target.value })} placeholder="Pix, cartão, dinheiro…" />
        </div>
        <div className="sm:col-span-2">
          <Label>Trabalho (opcional)</Label>
          <Select value={f.orcamentoId || SEM_ORCAMENTO} onValueChange={(v) => set({ orcamentoId: v === SEM_ORCAMENTO ? undefined : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_ORCAMENTO}>Nenhum — despesa geral da empresa</SelectItem>
              {orcamentos.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {formatarNumeroOrcamento(o.numero)} · {nomeCliente(o.clienteId)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-[11.5px] text-text-muted">Ligue a um orçamento para ver quanto sobrou daquele trabalho (ex.: Uber, impressão).</p>
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
