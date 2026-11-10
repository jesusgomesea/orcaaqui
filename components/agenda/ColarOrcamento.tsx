"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ClipboardPaste } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import { formatDateBR, formatMoney } from "@/lib/helpers";
import { calcularSinal } from "@/lib/documentos/formatos";
import { lerColagemEj, lerColagemOrc, tipoDeRef, type LeituraColada } from "@/lib/colar";
import { recalcularEj } from "@/lib/ej";

/**
 * Colar a mensagem que o cliente devolveu (do gerador daqui ou do site do EJ):
 * recalcula pela [ref], mostra o que muda e cria orçamento aprovado + agendamento.
 */
export function ColarOrcamento({ onCriado, onFechar }: { onCriado: (agendamentoId: string) => void; onFechar: () => void }) {
  const { empresaAtiva, aprovarColagem } = useStore();
  const [texto, setTexto] = useState("");
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState("");
  const [leitura, setLeitura] = useState<LeituraColada | null>(null);

  const colarDaAreaDeTransferencia = async () => {
    try {
      const lido = (await navigator.clipboard?.readText?.()) ?? "";
      if (!lido.trim()) throw new Error("vazio");
      setTexto(lido);
      setLeitura(null);
      setErro("");
    } catch {
      // Celulares costumam negar o acesso: avisar, nunca engolir em silêncio.
      toast.error("Não consegui ler a área de transferência. Toque na caixa e cole (segure → Colar).");
    }
  };

  const ler = async () => {
    setErro("");
    setLeitura(null);
    const tipo = tipoDeRef(texto);
    if (!tipo) {
      setErro("Não encontrei a linha [ref …] no texto. Cole a mensagem inteira, do jeito que o cliente enviou.");
      return;
    }
    if (tipo === "ej" && !empresaAtiva.config.urlTabelaEj) {
      setErro("Esta mensagem é do site do EJ. Configure o endereço da tabela do EJ em Empresa → Orçamento e agenda.");
      return;
    }
    setLendo(true);
    try {
      const r =
        tipo === "orc"
          ? lerColagemOrc(texto, empresaAtiva)
          : await lerColagemEj(texto, empresaAtiva, (linha) => recalcularEj(empresaAtiva.config.urlTabelaEj!, linha));
      if (r.ok) setLeitura(r.leitura);
      else setErro(r.erro);
    } finally {
      setLendo(false);
    }
  };

  const criar = () => {
    if (!leitura) return;
    const r = aprovarColagem(leitura);
    toast.success(
      `${r.orcamentoNovo ? "Orçamento aprovado criado" : "Orçamento atualizado e aprovado"}${r.clienteNovo ? ", cliente cadastrado" : ""} e agendamento pronto.`
    );
    onCriado(r.agendamentoId);
  };

  const $ = (v: number) => formatMoney(v, leitura?.moeda ?? empresaAtiva.moeda);
  const sinal = leitura ? calcularSinal(leitura.total, leitura.sinalPercentual) : null;

  return (
    <>
      <DialogTitle>Colar orçamento aprovado</DialogTitle>
      <p className="mb-2 text-[12.5px] text-text-muted">
        Cole a mensagem inteira que o cliente devolveu — do &quot;Montar orçamento&quot; daqui ou do site do EJ. O valor é
        recalculado pela linha <code>[ref …]</code>; o total escrito só serve para avisar se o texto foi editado.
      </p>
      <Textarea
        rows={7}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setLeitura(null);
          setErro("");
        }}
        placeholder="📋 *Orçamento ORC-0012* …"
        aria-label="Mensagem do orçamento"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={colarDaAreaDeTransferencia}>
          <ClipboardPaste className="h-4 w-4" strokeWidth={1.8} /> Colar
        </Button>
        <Button type="button" onClick={ler} disabled={!texto.trim() || lendo}>
          {lendo ? "Recalculando…" : "Ler e recalcular"}
        </Button>
      </div>

      {erro && <p className="mt-3 rounded-2xl border border-danger-border bg-danger-tint p-3 text-[13px] text-danger" role="alert">{erro}</p>}

      {leitura && sinal && (
        <div className="mt-4 rounded-2xl border border-border p-3.5 text-[13px]">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-semibold text-text">{leitura.codigoRef}</span>
            <span className="text-text-muted">{leitura.existenteId ? "Atualiza o orçamento salvo" : "Orçamento novo"}</span>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-text-muted">Cliente</dt><dd className="text-text">{leitura.cliente.nome || "—"}{leitura.cliente.telefone && ` · ${leitura.cliente.telefone}`}</dd>
            <dt className="text-text-muted">Data</dt><dd className="text-text">{leitura.data ? formatDateBR(leitura.data) : "a definir"}{leitura.horario && ` às ${leitura.horario}`}</dd>
            {leitura.local && (<><dt className="text-text-muted">Local</dt><dd className="text-text">{leitura.local}</dd></>)}
          </dl>
          <ul className="mt-3 space-y-0.5 border-t border-border pt-2">
            {leitura.itens.map((it) => (
              <li key={it.id} className="flex justify-between gap-2">
                <span className="min-w-0 text-text">{it.descricao}{it.quantidade > 1 ? ` × ${it.quantidade}` : ""}</span>
                <span className="shrink-0 text-text">{$(it.quantidade * it.valorUnitario)}</span>
              </li>
            ))}
          </ul>
          {leitura.desconto > 0 && <div className="flex justify-between text-warning"><span>Desconto</span><span>−{$(leitura.desconto)}</span></div>}
          {leitura.acrescimo > 0 && <div className="flex justify-between text-text-muted"><span>Acréscimo</span><span>+{$(leitura.acrescimo)}</span></div>}
          <div className="mt-2 flex justify-between border-t border-border pt-2 text-[15px] font-bold text-text"><span>Total recalculado</span><span>{$(leitura.total)}</span></div>
          <div className="flex justify-between text-text-muted"><span>Sinal ({String(leitura.sinalPercentual).replace(".", ",")}%)</span><span>{$(sinal.sinal)}</span></div>
          <div className="flex justify-between text-text-muted"><span>Restante</span><span>{$(sinal.restante)}</span></div>

          {(leitura.avisos.length > 0 || leitura.pendencias.length > 0) && (
            <ul className="mt-3 space-y-1 rounded-2xl border border-warning bg-warning-tint p-2.5 text-[12.5px] text-warning">
              {leitura.avisos.map((a) => <li key={a}>⚠ {a}</li>)}
              {leitura.pendencias.map((p) => <li key={p}>• Pendência (não impede): {p}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onFechar}>Cancelar</Button>
        <Button onClick={criar} disabled={!leitura}>Aprovar e criar agendamento</Button>
      </div>
    </>
  );
}
