"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileSignature, Receipt, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { ListaDocumentos } from "./ListaDocumentos";
import { ErroDocumento, gerarContrato, gerarRecibo, useDocumentos } from "@/lib/documentosCliente";
import { PAGAMENTO_LABEL, valorSugerido } from "@/lib/documentos/campos";
import { calcularSinal, formatarData, formatarReais, paraCentavos } from "@/lib/documentos/formatos";
import { calcOrcamentoTotais, todayStr, uuid } from "@/lib/helpers";
import type { Orcamento, Pagamento, TipoPagamento } from "@/lib/tipos";

function ListaFaltando({ titulo, itens }: { titulo: string; itens: string[] }) {
  if (!itens.length) return null;
  return (
    <div className="mt-3 rounded-lg border border-danger-border bg-danger-tint p-3 text-[12.5px] text-danger" role="alert">
      <div className="mb-1 font-semibold">{titulo}</div>
      <ul className="list-disc space-y-0.5 pl-5">
        {itens.map((f) => <li key={f}>{f}</li>)}
      </ul>
    </div>
  );
}

const TIPOS: TipoPagamento[] = ["sinal", "restante", "integral"];

/** Contrato (com histórico de versões) e pagamentos/recibos de um orçamento. */
export function DocumentosOrcamento({ orcamento }: { orcamento: Orcamento }) {
  const { empresaAtiva, updateOrcamento, garantirSalvo } = useStore();
  const { documentos, pdfDisponivel, carregando, erro, recarregar } = useDocumentos(empresaAtiva.id);

  const [gerando, setGerando] = useState<string | null>(null);
  const [faltando, setFaltando] = useState<{ alvo: string; itens: string[] }>({ alvo: "", itens: [] });

  const pagamentos = orcamento.pagamentos || [];
  const { total } = calcOrcamentoTotais(orcamento.itens, orcamento.desconto, orcamento.descontoTipo, orcamento.acrescimo);
  const { sinal, restante } = calcularSinal(total);
  const pagoCentavos = pagamentos.reduce((s, p) => s + paraCentavos(p.valor), 0);

  const contratos = documentos.filter((d) => d.tipo === "contrato" && d.orcamentoId === orcamento.id);
  const recibosDe = (pagamentoId: string) => documentos.filter((d) => d.tipo === "recibo" && d.pagamentoId === pagamentoId);

  const [novoTipo, setNovoTipo] = useState<TipoPagamento>(pagamentos.length ? "restante" : "sinal");
  const [novoValor, setNovoValor] = useState(() => valorSugerido(orcamento, pagamentos.length ? "restante" : "sinal"));
  const [novaData, setNovaData] = useState(todayStr());
  const [novaForma, setNovaForma] = useState("Pix");

  const executar = async (alvo: string, acao: () => Promise<unknown>, sucesso: string) => {
    setGerando(alvo);
    setFaltando({ alvo: "", itens: [] });
    try {
      // O servidor lê os dados gravados: sobe o que ainda está no debounce.
      if (!(await garantirSalvo())) throw new ErroDocumento("Não foi possível salvar as últimas alterações. Verifique a conexão.");
      await acao();
      toast.success(sucesso);
      await recarregar();
    } catch (e) {
      if (e instanceof ErroDocumento && e.faltando.length) setFaltando({ alvo, itens: e.faltando });
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o documento.");
    } finally {
      setGerando(null);
    }
  };

  const handleGerarContrato = () =>
    executar("contrato", () => gerarContrato(empresaAtiva.id, orcamento.id),
      contratos.length ? "Nova versão do contrato gerada." : "Contrato gerado.");

  const handleGerarRecibo = (p: Pagamento) =>
    executar(p.id, () => gerarRecibo(empresaAtiva.id, orcamento.id, p.id), "Recibo gerado.");

  const handleAdicionarPagamento = () => {
    if (paraCentavos(novoValor) <= 0) { toast.error("Informe um valor maior que zero."); return; }
    if (!novaData) { toast.error("Informe a data do pagamento."); return; }
    if (!novaForma.trim()) { toast.error("Informe a forma de pagamento."); return; }
    const novo: Pagamento = { id: uuid(), tipo: novoTipo, valor: novoValor, data: novaData, forma: novaForma.trim() };
    const lista = [...pagamentos, novo];
    updateOrcamento(orcamento.id, { pagamentos: lista });
    const proximo: TipoPagamento = "restante";
    setNovoTipo(proximo);
    setNovoValor(valorSugerido({ ...orcamento, pagamentos: lista }, proximo));
    toast.success("Pagamento registrado. Agora é só gerar o recibo.");
  };

  const handleRemoverPagamento = (p: Pagamento) => {
    const temRecibo = recibosDe(p.id).length > 0;
    const msg = temRecibo
      ? "Este pagamento já tem recibo gerado. Remover o pagamento não apaga o recibo do histórico. Continuar?"
      : "Remover este pagamento?";
    if (!confirm(msg)) return;
    updateOrcamento(orcamento.id, { pagamentos: pagamentos.filter((x) => x.id !== p.id) });
  };

  const aprovado = orcamento.status === "aprovado";

  return (
    <div className="space-y-4">
      {!pdfDisponivel && (
        <p className="rounded-lg border border-warning bg-warning-tint p-2.5 text-[12px] text-warning">
          A conversão para PDF não está configurada no servidor (GOTENBERG_URL). Os documentos estão saindo em .docx.
        </p>
      )}

      <section className="rounded-lg border border-border p-3.5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-text">
            <FileSignature className="h-4 w-4" strokeWidth={1.8} /> Contrato
          </h3>
          <Button size="sm" onClick={handleGerarContrato} disabled={!aprovado || !!gerando}>
            {gerando === "contrato" ? "Gerando…" : contratos.length ? "Gerar nova versão" : "Gerar contrato"}
          </Button>
        </div>
        {!aprovado && (
          <p className="text-[12.5px] text-text-muted">Disponível quando o orçamento estiver com status Aprovado.</p>
        )}
        <ListaFaltando titulo="Complete estes dados para gerar o contrato:" itens={faltando.alvo === "contrato" ? faltando.itens : []} />
        <div className="mt-2">
          {carregando ? (
            <p className="text-[12.5px] text-text-muted">Carregando histórico…</p>
          ) : erro ? (
            <p className="text-[12.5px] text-danger">{erro}</p>
          ) : (
            <ListaDocumentos documentos={contratos} vazio="Nenhum contrato gerado ainda." />
          )}
        </div>
        <p className="mt-2 text-[11.5px] text-text-muted">
          Gerar de novo cria uma nova versão com novo número; as anteriores continuam no histórico. A assinatura é feita
          fora daqui (Assinador gov.br ou Autentique).
        </p>
      </section>

      <section className="rounded-lg border border-border p-3.5">
        <h3 className="mb-1 flex items-center gap-1.5 text-[14px] font-semibold text-text">
          <Receipt className="h-4 w-4" strokeWidth={1.8} /> Pagamentos e recibos
        </h3>
        <p className="mb-3 text-[12px] text-text-muted">
          Total {formatarReais(total)} · sinal {formatarReais(sinal)} · restante {formatarReais(restante)} · pago{" "}
          {formatarReais(pagoCentavos / 100)} · saldo {formatarReais(Math.max(0, paraCentavos(total) - pagoCentavos) / 100)}
        </p>

        {pagamentos.length === 0 ? (
          <p className="mb-3 text-[12.5px] text-text-muted">Nenhum pagamento registrado.</p>
        ) : (
          <ul className="mb-3 space-y-2.5">
            {pagamentos.map((p) => (
              <li key={p.id} className="rounded-lg border border-border p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[13px]">
                    <span className="font-semibold text-text">{PAGAMENTO_LABEL[p.tipo]}</span>{" "}
                    <span className="text-text">{formatarReais(p.valor)}</span>{" "}
                    <span className="text-text-muted">· {formatarData(p.data)} · {p.forma}</span>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="secondary" disabled={!!gerando} onClick={() => handleGerarRecibo(p)}>
                      {gerando === p.id ? "Gerando…" : recibosDe(p.id).length ? "Gerar de novo" : "Gerar recibo"}
                    </Button>
                    <Button size="sm" variant="danger" disabled={!!gerando} onClick={() => handleRemoverPagamento(p)} title="Remover pagamento">
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                    </Button>
                  </div>
                </div>
                <ListaFaltando titulo="Complete estes dados para gerar o recibo:" itens={faltando.alvo === p.id ? faltando.itens : []} />
                {recibosDe(p.id).length > 0 && (
                  <div className="mt-1.5 border-t border-border pt-1">
                    <ListaDocumentos documentos={recibosDe(p.id)} vazio="" />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <fieldset className="rounded-lg border border-dashed border-border-strong p-3">
          <legend className="px-1.5 text-xs font-semibold text-text-muted">Registrar pagamento</legend>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div>
              <Label>Tipo</Label>
              <Select
                value={novoTipo}
                onValueChange={(v) => {
                  const tipo = v as TipoPagamento;
                  setNovoTipo(tipo);
                  setNovoValor(valorSugerido(orcamento, tipo));
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t} value={t}>{PAGAMENTO_LABEL[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" min="0" step="0.01" value={novoValor} onChange={(e) => setNovoValor(Number(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} />
            </div>
            <div>
              <Label>Forma</Label>
              <Input value={novaForma} onChange={(e) => setNovaForma(e.target.value)} />
            </div>
          </div>
          <div className="mt-2.5 flex justify-end">
            <Button size="sm" variant="secondary" onClick={handleAdicionarPagamento}>Registrar pagamento</Button>
          </div>
        </fieldset>
      </section>
    </div>
  );
}
