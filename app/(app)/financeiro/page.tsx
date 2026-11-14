"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowDownCircle, ArrowUpCircle, ChevronLeft, ChevronRight, Pencil, Scale, Trash2, type LucideIcon } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FormSaida, saidaVazia, type SaidaForm } from "@/components/financeiro/FormSaida";
import { FormEntradaAvulsa, entradaAvulsaVazia, type EntradaAvulsaForm } from "@/components/financeiro/FormEntradaAvulsa";
import { entradas, resumoMes, rotuloMes, saidasOrdenadas, saidasPorCategoria } from "@/lib/financeiro";
import { PAGAMENTO_LABEL } from "@/lib/documentos/campos";
import { formatDateBR, formatMoney, formatarNumeroOrcamento, todayStr } from "@/lib/helpers";
import { cn } from "@/lib/utils";

/** "2026-11" deslocado em `delta` meses. */
function mudarMes(mes: string, delta: number): string {
  const total = Number(mes.slice(0, 4)) * 12 + Number(mes.slice(5, 7)) - 1 + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

function Kpi({ icon: Icon, label, value, tom }: { icon: LucideIcon; label: string; value: string; tom?: "verde" | "vermelho" }) {
  return (
    <Card className="flex items-center gap-3.5 p-3.5 sm:p-5">
      <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-tint text-primary-texto sm:flex">
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </div>
      <div className="min-w-0">
        <div className="text-[11.5px] leading-tight font-medium text-text-muted sm:text-[12px]">{label}</div>
        <div className={cn("truncate text-[16px] font-bold sm:text-[19px]", tom === "vermelho" ? "text-danger" : tom === "verde" ? "text-success" : "text-text")}>
          {value}
        </div>
      </div>
    </Card>
  );
}

export default function FinanceiroPage() {
  const { empresaAtiva, removeSaida, removeEntradaAvulsa } = useStore();
  const moeda = empresaAtiva.moeda;
  const $ = (v: number) => formatMoney(v, moeda);
  const mesAtual = todayStr().slice(0, 7);
  const [mes, setMes] = useState(mesAtual);
  const [editando, setEditando] = useState<SaidaForm | null>(null);
  const [editandoEntrada, setEditandoEntrada] = useState<EntradaAvulsaForm | null>(null);
  const [aba, setAba] = useState("saidas");

  const resumo = resumoMes(empresaAtiva, mes);
  const saidasDoMes = saidasOrdenadas(empresaAtiva.saidas).filter((s) => s.data.slice(0, 7) === mes);
  const entradasDoMes = entradas(empresaAtiva).filter((e) => e.data.slice(0, 7) === mes);
  const categorias = saidasPorCategoria(empresaAtiva.saidas, mes);
  const maiorCategoria = categorias[0]?.valor || 0;

  const nomeCliente = (id: string) => empresaAtiva.clientes.find((c) => c.id === id)?.nome || "Sem cliente";
  const rotuloOrcamento = (id?: string) => {
    const o = id ? empresaAtiva.orcamentos.find((x) => x.id === id) : undefined;
    return o ? `${formatarNumeroOrcamento(o.numero)} · ${nomeCliente(o.clienteId)}` : "";
  };

  const excluir = (id: string, descricao: string) => {
    if (!confirm(`Excluir a saída "${descricao}"?`)) return;
    removeSaida(id);
    toast.success("Saída excluída.");
  };
  const excluirEntrada = (id: string, descricao: string) => {
    if (!confirm(`Excluir a entrada "${descricao}"?`)) return;
    removeEntradaAvulsa(id);
    toast.success("Entrada excluída.");
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[21px] font-bold text-text">Financeiro</h1>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setAba("entradas");
              setEditandoEntrada(entradaAvulsaVazia());
            }}
          >
            + Nova entrada
          </Button>
          <Button onClick={() => setEditando(saidaVazia())}>+ Nova saída</Button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => setMes(mudarMes(mes, -1))} aria-label="Mês anterior">
          <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
        </Button>
        <div className="min-w-[88px] text-center text-[14px] font-semibold text-text">{rotuloMes(mes)}</div>
        <Button variant="secondary" size="sm" onClick={() => setMes(mudarMes(mes, 1))} disabled={mes >= mesAtual} aria-label="Próximo mês">
          <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
        </Button>
        {mes !== mesAtual && (
          <Button variant="ghost" size="sm" onClick={() => setMes(mesAtual)}>Mês atual</Button>
        )}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:gap-3.5 lg:grid-cols-3">
        <Kpi icon={ArrowDownCircle} label="Recebido no mês" value={$(resumo.recebido)} />
        <Kpi icon={ArrowUpCircle} label="Saídas no mês" value={$(resumo.saidas)} />
        <Kpi icon={Scale} label="Saldo do mês" value={$(resumo.saldo)} tom={resumo.saldo < 0 ? "vermelho" : resumo.saldo > 0 ? "verde" : undefined} />
      </div>
      {resumo.recebidoAvulso > 0 && (
        <p className="-mt-3 mb-4 text-[12px] text-text-muted">
          Do recebido, {$(resumo.recebidoAvulso)} veio de entradas avulsas.
        </p>
      )}
      {resumo.entradasOutraMoeda > 0 && (
        <p className="-mt-3 mb-4 text-[12px] text-text-muted">
          {resumo.entradasOutraMoeda === 1 ? "1 pagamento" : `${resumo.entradasOutraMoeda} pagamentos`} em outra moeda ficaram fora do total.
        </p>
      )}

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList>
          <TabsTrigger value="saidas">Saídas</TabsTrigger>
          <TabsTrigger value="entradas">Entradas</TabsTrigger>
          <TabsTrigger value="categorias">Por categoria</TabsTrigger>
        </TabsList>

        <TabsContent value="saidas">
          <Card className="p-0 md:p-2">
            {saidasDoMes.length === 0 ? (
              <EmptyState message={`Nenhuma saída em ${rotuloMes(mes)}. Registre compras de equipamento, deslocamentos, assinaturas…`} />
            ) : (
              <ul className="divide-y divide-border">
                {saidasDoMes.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 p-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-semibold text-text">
                        <span className="truncate">{s.descricao}</span>
                        {s.categoria && <Badge>{s.categoria}</Badge>}
                      </div>
                      <div className="truncate text-[12px] text-text-muted">
                        {formatDateBR(s.data)}{s.forma ? ` · ${s.forma}` : ""}
                        {s.orcamentoId && ` · ${rotuloOrcamento(s.orcamentoId) || "orçamento removido"}`}
                      </div>
                    </div>
                    <div className="shrink-0 text-[13.5px] font-bold text-danger">−{$(s.valor)}</div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="secondary" size="sm" onClick={() => setEditando({ ...s })} aria-label={`Editar ${s.descricao}`}>
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => excluir(s.id, s.descricao)} aria-label={`Excluir ${s.descricao}`}>
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="entradas">
          <Card className="p-0 md:p-2">
            {entradasDoMes.length === 0 ? (
              <EmptyState message={`Nada recebido em ${rotuloMes(mes)}.`} />
            ) : (
              <ul className="divide-y divide-border">
                {entradasDoMes.map((e) =>
                  e.origem === "pagamento" ? (
                    <li key={e.id} className="flex items-center gap-3 p-3.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-semibold text-text">
                          {formatarNumeroOrcamento(e.orcamento.numero)} · {nomeCliente(e.orcamento.clienteId)}
                        </div>
                        <div className="truncate text-[12px] text-text-muted">
                          {formatDateBR(e.data)} · {e.tipo === "outro" && e.descricao ? e.descricao : PAGAMENTO_LABEL[e.tipo]}
                          {e.forma ? ` · ${e.forma}` : ""}
                        </div>
                      </div>
                      <div className="shrink-0 text-[13.5px] font-bold text-success">+{formatMoney(e.valor, e.moeda)}</div>
                    </li>
                  ) : (
                    <li key={e.id} className="flex items-center gap-3 p-3.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-semibold text-text">
                          <span className="truncate">{e.descricao}</span>
                          <Badge>{e.categoria || "Avulsa"}</Badge>
                        </div>
                        <div className="truncate text-[12px] text-text-muted">
                          {formatDateBR(e.data)} · entrada avulsa{e.forma ? ` · ${e.forma}` : ""}
                        </div>
                      </div>
                      <div className="shrink-0 text-[13.5px] font-bold text-success">+{formatMoney(e.valor, e.moeda)}</div>
                      <div className="flex shrink-0 gap-1">
                        <Button variant="secondary" size="sm" onClick={() => setEditandoEntrada({ ...e.avulsa })} aria-label={`Editar ${e.descricao}`}>
                          <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => excluirEntrada(e.id, e.descricao ?? "")} aria-label={`Excluir ${e.descricao}`}>
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                        </Button>
                      </div>
                    </li>
                  )
                )}
              </ul>
            )}
          </Card>
          <p className="mt-2 text-[12px] text-text-muted">
            As entradas são os pagamentos registrados na Agenda ou em &quot;Contrato e recibos&quot; de cada orçamento, mais as
            entradas avulsas (venda de um equipamento, aluguel, reembolso) lançadas em &quot;+ Nova entrada&quot;.
          </p>
        </TabsContent>

        <TabsContent value="categorias">
          <Card>
            {categorias.length === 0 ? (
              <EmptyState message={`Nenhuma saída em ${rotuloMes(mes)}.`} />
            ) : (
              <ul className="space-y-3">
                {categorias.map((c) => (
                  <li key={c.categoria}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-[13px]">
                      <span className="font-semibold text-text">{c.categoria}</span>
                      <span className="text-text-muted">
                        {$(c.valor)} · {resumo.saidas > 0 ? Math.round((c.valor / resumo.saidas) * 100) : 0}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${maiorCategoria ? (c.valor / maiorCategoria) * 100 : 0}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editando} onOpenChange={(aberto) => !aberto && setEditando(null)}>
        <DialogContent>
          {editando && <FormSaida key={editando.id ?? "nova"} saida={editando} onFechar={() => setEditando(null)} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!editandoEntrada} onOpenChange={(aberto) => !aberto && setEditandoEntrada(null)}>
        <DialogContent>
          {editandoEntrada && (
            <FormEntradaAvulsa key={editandoEntrada.id ?? "nova"} entrada={editandoEntrada} onFechar={() => setEditandoEntrada(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
