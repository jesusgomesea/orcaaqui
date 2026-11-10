"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, MessageCircle, Plus, Trash2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatarNumeroOrcamento, formatDateBR, formatMoney, todayStr, uuid } from "@/lib/helpers";
import { servicoContratoVazio } from "@/lib/orcamento";
import { linkWhatsApp } from "@/lib/gerador";
import { PAGAMENTO_LABEL } from "@/lib/documentos/campos";
import {
  indiceEtapa,
  mudarEtapa,
  nomeEtapa,
  totalDoOrcamento,
  valorDoSinal,
  valorPago,
  valorRestante,
  valorTotal,
} from "@/lib/agenda";
import { ETAPA_CANCELADO, type Pagamento, type TipoPagamento } from "@/lib/tipos";

const TIPOS: TipoPagamento[] = ["sinal", "restante", "integral", "outro"];

function quandoHistorico(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

/** Detalhe do agendamento: etapas, data/local, valores, pagamentos, extras e notas. */
export function DetalheAgendamento({ agendamentoId, onFechar }: { agendamentoId: string; onFechar: () => void }) {
  const { empresaAtiva, updateAgendamento, removeAgendamento, updateOrcamento } = useStore();
  const a = empresaAtiva.agendamentos.find((x) => x.id === agendamentoId);
  const o = a ? empresaAtiva.orcamentos.find((x) => x.id === a.orcamentoId) : undefined;
  const cliente = a ? empresaAtiva.clientes.find((c) => c.id === a.clienteId) : undefined;
  const etapas = empresaAtiva.config.etapasAgenda;

  const pagamentos = o?.pagamentos ?? [];
  const [tipo, setTipo] = useState<TipoPagamento>(pagamentos.length ? "restante" : "sinal");
  const [valor, setValor] = useState<number | null>(null);
  const [data, setData] = useState(todayStr());
  const [forma, setForma] = useState("Pix");
  const [descricao, setDescricao] = useState("");
  const [extraDesc, setExtraDesc] = useState("");
  const [extraValor, setExtraValor] = useState(0);

  if (!a) return <p className="text-[13px] text-text-muted">Agendamento não encontrado.</p>;

  const moeda = a.moeda;
  const $ = (v: number) => formatMoney(v, moeda);
  const total = valorTotal(a, o);
  const pago = valorPago(o);
  const restante = valorRestante(a, o);
  const sinal = valorDoSinal(a, o);
  const sugerido = (t: TipoPagamento) => (t === "sinal" ? sinal : t === "outro" ? 0 : t === "integral" ? total : restante);
  const valorAtual = valor ?? sugerido(tipo);
  const atual = indiceEtapa(a.etapa, etapas);
  const cancelado = a.etapa === ETAPA_CANCELADO;
  const sc = { ...servicoContratoVazio(), ...o?.servicoContrato };

  const irPara = (etapa: string) => updateAgendamento(a.id, (x) => mudarEtapa(x, etapa));
  const setServico = (patch: Partial<typeof sc>) => o && updateOrcamento(o.id, { servicoContrato: { ...sc, ...patch } });

  const registrarPagamento = () => {
    if (!o) return;
    if (!(valorAtual > 0)) { toast.error("Informe um valor maior que zero."); return; }
    if (tipo === "outro" && !descricao.trim()) { toast.error("Descreva o pagamento (ex: remarcação)."); return; }
    const novo: Pagamento = { id: uuid(), tipo, valor: valorAtual, data, forma: forma.trim() || "Pix", ...(descricao.trim() ? { descricao: descricao.trim() } : {}) };
    updateOrcamento(o.id, { pagamentos: [...pagamentos, novo] });
    // Sinal pago avança a agenda, se ainda estiver antes da etapa "sinal_pago".
    const etapaSinal = indiceEtapa("sinal_pago", etapas);
    if (tipo === "sinal" && etapaSinal > atual && atual >= 0) irPara("sinal_pago");
    setTipo("restante");
    setValor(null);
    setDescricao("");
    toast.success("Pagamento registrado.");
  };

  return (
    <>
      <DialogTitle>{cliente?.nome ?? "(cliente removido)"}</DialogTitle>
      <div className="-mt-2 mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-text-muted">
        {o && <span>{o.codigoRef && o.codigoRef.startsWith("EJ-") ? `${o.codigoRef} · ` : ""}{formatarNumeroOrcamento(o.numero)}</span>}
        <span>{nomeEtapa(a.etapa, etapas)}</span>
        {cliente?.telefone && (
          <a className="inline-flex items-center gap-1 text-primary-texto hover:underline" href={linkWhatsApp(cliente.telefone, "")} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-3.5 w-3.5" /> {cliente.telefone}
          </a>
        )}
      </div>

      {/* Etapas */}
      <section className="mb-4">
        <div className="flex flex-wrap gap-1.5">
          {etapas.map((e, i) => (
            <button
              key={e.id}
              type="button"
              disabled={cancelado}
              onClick={() => irPara(e.id)}
              title={e.descricao}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12.5px] font-medium cursor-pointer disabled:cursor-default disabled:opacity-50",
                i === atual ? "border-primary bg-primary text-sobre-primary" : i < atual ? "border-success bg-success-tint text-success" : "border-border text-text-muted hover:text-text"
              )}
            >
              {i < atual && <Check className="h-3 w-3" />} {e.nome}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {cancelado ? (
            <Button size="sm" variant="secondary" onClick={() => irPara(etapas[0]?.id ?? "recebido")}>Reativar</Button>
          ) : (
            <Button size="sm" variant="danger" onClick={() => confirm("Cancelar este agendamento?") && irPara(ETAPA_CANCELADO)}>
              <X className="h-3.5 w-3.5" /> Cancelar agendamento
            </Button>
          )}
        </div>
        <details className="mt-2 text-[12px] text-text-muted">
          <summary className="cursor-pointer">Histórico</summary>
          <ul className="mt-1 space-y-0.5">
            {a.historico.map((h, i) => <li key={i}>{quandoHistorico(h.em)} — {nomeEtapa(h.etapa, etapas)}</li>)}
          </ul>
        </details>
      </section>

      {/* Data e local (moram no orçamento) */}
      {o && (
        <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div><Label>Data</Label><Input type="date" value={sc.dataServico} onChange={(e) => setServico({ dataServico: e.target.value })} /></div>
          <div><Label>Horário</Label><Input type="time" value={sc.horarioInicio} onChange={(e) => setServico({ horarioInicio: e.target.value })} /></div>
          <div className="col-span-2"><Label>Local</Label><Input value={sc.local} onChange={(e) => setServico({ local: e.target.value })} /></div>
        </section>
      )}

      {/* Valores */}
      <section className="mb-4 rounded-2xl border border-border p-3.5 text-[13px]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Valor combinado (opcional)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={a.valorCombinado ?? ""}
              placeholder={o ? `Orçado: ${$(totalDoOrcamento(o))}` : ""}
              onChange={(e) => {
                const v = e.target.value;
                updateAgendamento(a.id, (x) => ({ ...x, valorCombinado: v === "" ? null : Math.max(0, Number(v) || 0) }));
              }}
            />
            <p className="mt-1 text-[11.5px] text-text-muted">Desconto ou ajuste fechado na conversa. Vazio = vale o orçado.</p>
          </div>
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 self-end">
            <dt className="text-text-muted">Total</dt><dd className="text-right font-semibold text-text">{$(total)}</dd>
            <dt className="text-text-muted">Sinal ({String(a.sinalPercentual).replace(".", ",")}%)</dt><dd className="text-right text-text">{$(sinal)}</dd>
            <dt className="text-text-muted">Pago</dt><dd className="text-right text-success">{$(pago)}</dd>
            <dt className="text-text-muted">Restante</dt><dd className="text-right font-semibold text-text">{$(restante)}</dd>
          </dl>
        </div>

        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-1.5 font-semibold text-text">Extras de pós-venda</div>
          {a.extras.length === 0 && <p className="text-[12.5px] text-text-muted">Nenhum (remarcação, reedição, foto extra pedida depois…).</p>}
          <ul className="space-y-1">
            {a.extras.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-2">
                <span className="text-text">{x.descricao}</span>
                <span className="flex items-center gap-2">
                  {$(x.valor)}
                  <button type="button" className="text-text-muted hover:text-danger cursor-pointer" aria-label="Remover extra" onClick={() => updateAgendamento(a.id, (y) => ({ ...y, extras: y.extras.filter((e) => e.id !== x.id) }))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <Input placeholder="Ex: Remarcação" value={extraDesc} onChange={(e) => setExtraDesc(e.target.value)} />
            <Input className="w-20 shrink-0 sm:w-28" type="number" min="0" step="0.01" value={extraValor || ""} placeholder="0" onChange={(e) => setExtraValor(Number(e.target.value) || 0)} />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              aria-label="Adicionar extra"
              onClick={() => {
                if (!extraDesc.trim() || extraValor <= 0) { toast.error("Informe descrição e valor do extra."); return; }
                updateAgendamento(a.id, (y) => ({ ...y, extras: [...y.extras, { id: uuid(), descricao: extraDesc.trim(), valor: extraValor }] }));
                setExtraDesc("");
                setExtraValor(0);
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Pagamentos (os mesmos do orçamento e dos recibos) */}
      {o && (
        <section className="mb-4 rounded-2xl border border-border p-3.5 text-[13px]">
          <div className="mb-1.5 font-semibold text-text">Pagamentos</div>
          {pagamentos.length === 0 && <p className="text-[12.5px] text-text-muted">Nenhum pagamento ainda.</p>}
          <ul className="space-y-1">
            {pagamentos.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span className="text-text">
                  {p.tipo === "outro" && p.descricao ? p.descricao : PAGAMENTO_LABEL[p.tipo]}
                  <span className="text-text-muted"> · {formatDateBR(p.data)} · {p.forma}</span>
                </span>
                <span className="flex items-center gap-2">
                  {$(p.valor)}
                  <button
                    type="button"
                    className="text-text-muted hover:text-danger cursor-pointer"
                    aria-label="Remover pagamento"
                    onClick={() => confirm("Remover este pagamento?") && updateOrcamento(o.id, { pagamentos: pagamentos.filter((x) => x.id !== p.id) })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => { setTipo(v as TipoPagamento); setValor(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{PAGAMENTO_LABEL[t]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Valor</Label><Input type="number" min="0" step="0.01" value={valorAtual || ""} onChange={(e) => setValor(Number(e.target.value) || 0)} /></div>
            <div><Label>Data</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
            <div><Label>Forma</Label><Input value={forma} onChange={(e) => setForma(e.target.value)} /></div>
            {tipo === "outro" && (
              <div className="col-span-2 sm:col-span-4"><Label>Descrição</Label><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Remarcação" /></div>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[11.5px] text-text-muted">
              {empresaAtiva.prestador?.habilitado ? "Recibos: botão \"Contrato e recibos\" do orçamento." : ""}
            </p>
            <Button size="sm" variant="secondary" onClick={registrarPagamento}>Registrar pagamento</Button>
          </div>
        </section>
      )}

      <section className="mb-4">
        <Label>Notas (só você vê)</Label>
        <Textarea rows={3} value={a.notas} onChange={(e) => updateAgendamento(a.id, (x) => ({ ...x, notas: e.target.value }))} />
      </section>

      <div className="flex justify-between gap-2">
        <Button
          variant="ghost"
          className="text-danger"
          onClick={() => {
            if (!confirm("Excluir este agendamento? O orçamento e os pagamentos continuam salvos.")) return;
            removeAgendamento(a.id);
            onFechar();
          }}
        >
          Excluir agendamento
        </Button>
        <Button onClick={onFechar}>Fechar</Button>
      </div>
    </>
  );
}
