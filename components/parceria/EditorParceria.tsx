"use client";

import { Handshake, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { formatMoney } from "@/lib/helpers";
import { novaContrapartida, parceriaVazia, resumoParceria, TIPOS_CONTRAPARTIDA } from "@/lib/parceria";
import type { CodigoMoeda, Contrapartida, Orcamento, Parceria, TipoContrapartida } from "@/lib/tipos";

/**
 * Liga/desliga "É uma parceria" e edita as contrapartidas (o que o parceiro dá
 * em troca). O que VOCÊ entrega continua nos itens do orçamento; o desconto de
 * parceria é o desconto do próprio orçamento.
 */
export function EditorParceria({
  orcamento,
  moeda,
  onChange,
}: {
  orcamento: Pick<Orcamento, "itens" | "desconto" | "descontoTipo" | "acrescimo" | "parceria">;
  moeda: CodigoMoeda;
  onChange: (parceria: Parceria | undefined) => void;
}) {
  const p = orcamento.parceria;
  const $ = (v: number) => formatMoney(v, moeda);
  const setItem = (id: string, patch: Partial<Contrapartida>) =>
    p && onChange({ contrapartidas: p.contrapartidas.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const r = p ? resumoParceria(orcamento) : null;

  return (
    <fieldset className="mb-3.5 rounded-2xl border border-border p-3.5">
      <legend className="px-1.5 text-xs font-semibold text-text-muted">Parceria</legend>
      <label className="flex cursor-pointer items-start gap-2.5 text-[13.5px] text-text">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-primary"
          checked={!!p}
          onChange={(e) => onChange(e.target.checked ? parceriaVazia() : undefined)}
        />
        <span>
          É uma parceria
          <span className="block text-[12px] text-text-muted">
            O parceiro paga com divulgação, permuta ou indicações (com ou sem uma parte em dinheiro). Use o desconto do
            orçamento para o que ele não paga em dinheiro.
          </span>
        </span>
      </label>

      {p && r && (
        <div className="mt-3 space-y-3">
          {p.contrapartidas.map((c) => {
            const tipo = TIPOS_CONTRAPARTIDA.find((t) => t.id === c.tipo);
            const lista = `sugestoes-${c.id}`;
            return (
              <div key={c.id} className="rounded-2xl bg-surface-2/60 p-3">
                <div className="flex flex-wrap items-end gap-2 sm:flex-nowrap">
                  <div className="min-w-0 flex-1 sm:w-44 sm:flex-none">
                    <Label>Contrapartida</Label>
                    <Select value={c.tipo} onValueChange={(v) => setItem(c.id, { tipo: v as TipoContrapartida })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TIPOS_CONTRAPARTIDA.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* No celular a descrição desce para uma linha inteira. */}
                  <div className="order-last w-full sm:order-none sm:w-auto sm:min-w-0 sm:flex-1">
                    <Label>O que o parceiro faz</Label>
                    <Input
                      list={lista}
                      value={c.descricao}
                      placeholder={tipo?.sugestoes[0] ?? "Descreva"}
                      onChange={(e) => setItem(c.id, { descricao: e.target.value })}
                    />
                    <datalist id={lista}>{tipo?.sugestoes.map((s) => <option key={s} value={s} />)}</datalist>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remover contrapartida"
                    onClick={() => onChange({ contrapartidas: p.contrapartidas.filter((x) => x.id !== c.id) })}
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                  </Button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <div>
                    <Label>{c.tipo === "indicacao" ? "Quantas indicações" : "Quantidade"}</Label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={c.quantidade}
                      onChange={(e) => setItem(c.id, { quantidade: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                    />
                  </div>
                  <div>
                    <Label>Até (opcional)</Label>
                    <Input type="date" value={c.prazo} onChange={(e) => setItem(c.id, { prazo: e.target.value })} />
                  </div>
                  {c.tipo === "permuta" && (
                    <div className="col-span-2 sm:col-span-1">
                      <Label>Valor estimado</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={c.valorEstimado || ""}
                        placeholder="0"
                        onChange={(e) => setItem(c.id, { valorEstimado: Math.max(0, Number(e.target.value) || 0) })}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onChange({ contrapartidas: [...p.contrapartidas, novaContrapartida()] })}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Adicionar contrapartida
          </Button>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-primary-tint px-3.5 py-2.5 text-[12.5px] text-text">
            <Handshake className="h-4 w-4 text-primary-texto" strokeWidth={1.8} />
            <span>Valor cheio <b>{$(r.valorCheio)}</b></span>
            {r.desconto > 0 && <span>Desconto de parceria <b>{$(r.desconto)}</b></span>}
            <span>{r.emDinheiro > 0 ? <>Em dinheiro <b>{$(r.emDinheiro)}</b></> : <b>Sem pagamento em dinheiro</b>}</span>
            {r.emPermuta > 0 && <span>Em permuta <b>{$(r.emPermuta)}</b></span>}
          </div>
        </div>
      )}
    </fieldset>
  );
}
