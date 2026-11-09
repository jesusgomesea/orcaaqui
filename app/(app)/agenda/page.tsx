"use client";

import { useMemo, useState } from "react";
import { CalendarClock, ClipboardPaste, Hourglass, Search, Wallet } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatarNumeroOrcamento, formatDateBR, formatMoney, todayStr } from "@/lib/helpers";
import { compararPorData, itensDaAgenda, nomeEtapa, resumoAgenda, valorRestante, type ItemAgenda } from "@/lib/agenda";
import { ColarOrcamento } from "@/components/agenda/ColarOrcamento";
import { DetalheAgendamento } from "@/components/agenda/DetalheAgendamento";

type Aba = "agenda" | "entregues" | "cancelados";

const ABAS: { id: Aba; nome: string; situacao: ItemAgenda["situacao"] }[] = [
  { id: "agenda", nome: "Agenda", situacao: "ativo" },
  { id: "entregues", nome: "Entregues", situacao: "concluido" },
  { id: "cancelados", nome: "Cancelados", situacao: "cancelado" },
];

function Numero({ icone: Icone, rotulo, valor }: { icone: typeof Wallet; rotulo: string; valor: string }) {
  return (
    <Card className="flex items-center gap-3 p-3 sm:p-3.5">
      <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-tint text-primary sm:flex">
        <Icone className="h-4.5 w-4.5" strokeWidth={1.8} />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] leading-tight font-medium text-text-muted sm:text-[11.5px]">{rotulo}</div>
        <div className="truncate text-[15px] font-bold text-text sm:text-[17px]">{valor}</div>
      </div>
    </Card>
  );
}

export default function AgendaPage() {
  const { empresaAtiva } = useStore();
  const [aba, setAba] = useState<Aba>("agenda");
  const [busca, setBusca] = useState("");
  const [colando, setColando] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);
  const hoje = todayStr();
  const etapas = empresaAtiva.config.etapasAgenda;

  const itens = useMemo(() => itensDaAgenda(empresaAtiva), [empresaAtiva]);
  const resumo = useMemo(() => resumoAgenda(empresaAtiva, hoje), [empresaAtiva, hoje]);

  const lista = useMemo(() => {
    const situacao = ABAS.find((x) => x.id === aba)!.situacao;
    const termo = busca.trim().toLowerCase();
    const filtrados = itens.filter((i) => {
      if (i.situacao !== situacao) return false;
      if (!termo) return true;
      const codigo = i.orcamento ? `${formatarNumeroOrcamento(i.orcamento.numero)} ${i.orcamento.codigoRef ?? ""}` : "";
      return [i.clienteNome, i.clienteTelefone, i.local, codigo].some((t) => t.toLowerCase().includes(termo));
    });
    // Agenda: mais próximo primeiro. Entregues e cancelados: mais recentes primeiro.
    return aba === "agenda" ? filtrados.sort(compararPorData) : filtrados.sort((a, b) => compararPorData(b, a));
  }, [itens, aba, busca]);

  const contagem = (s: ItemAgenda["situacao"]) => itens.filter((i) => i.situacao === s).length;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[21px] font-bold text-text">Agenda</h1>
        <Button onClick={() => setColando(true)}>
          <ClipboardPaste className="h-4 w-4" strokeWidth={1.8} /> Colar orçamento
        </Button>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
        <Numero icone={Hourglass} rotulo="Aguardando confirmação" valor={String(resumo.aguardando)} />
        <Numero icone={CalendarClock} rotulo="Nos próximos 30 dias" valor={String(resumo.proximos30)} />
        <Numero icone={Wallet} rotulo="A receber" valor={formatMoney(resumo.aReceber, empresaAtiva.moeda)} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border p-0.5 text-[13px]">
          {ABAS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setAba(x.id)}
              className={cn("rounded-md px-3 py-1.5 font-medium cursor-pointer", aba === x.id ? "bg-primary-tint text-primary" : "text-text-muted hover:text-text")}
            >
              {x.nome} <span className="text-[11.5px] opacity-70">{contagem(x.situacao)}</span>
            </button>
          ))}
        </div>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input className="pl-8" placeholder="Buscar por cliente, telefone, local ou código" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      </div>

      <Card className="p-0">
        {lista.length === 0 ? (
          <EmptyState
            message={
              busca.trim()
                ? "Nada encontrado com essa busca."
                : aba === "agenda"
                  ? "Nenhum agendamento ativo. Cole um orçamento aprovado ou use \"Cliente aprovou → agendar\" em Orçamentos."
                  : aba === "entregues"
                    ? "Nada entregue ainda."
                    : "Nenhum cancelado."
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {lista.map((i) => {
              const a = i.agendamento;
              const restante = valorRestante(a, i.orcamento);
              const atrasado = aba === "agenda" && i.data && i.data < hoje;
              return (
                <li key={a.id}>
                  <button type="button" onClick={() => setAberto(a.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-bg cursor-pointer">
                    <div className="w-24 shrink-0 text-[13px]">
                      <div className={cn("font-semibold", atrasado ? "text-warning" : "text-text")}>{i.data ? formatDateBR(i.data) : "Sem data"}</div>
                      <div className="text-[11.5px] text-text-muted">{i.horario || " "}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-semibold text-text">{i.clienteNome}</div>
                      <div className="truncate text-[12px] text-text-muted">
                        {[i.orcamento?.servicoContrato?.servico, i.local, i.orcamento?.codigoRef].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Badge tone={a.etapa === etapas[0]?.id ? "amber" : i.situacao === "concluido" ? "green" : i.situacao === "cancelado" ? "red" : "gray"}>
                        {nomeEtapa(a.etapa, etapas)}
                      </Badge>
                      {i.situacao !== "cancelado" && (
                        <span className="w-24 text-right text-[12.5px] text-text-muted">
                          {restante > 0 ? <>falta <b className="text-text">{formatMoney(restante, a.moeda)}</b></> : "quitado"}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Dialog open={colando} onOpenChange={setColando}>
        <DialogContent className="max-w-[640px]">
          {colando && (
            <ColarOrcamento
              onFechar={() => setColando(false)}
              onCriado={(id) => {
                setColando(false);
                setAba("agenda");
                setAberto(id);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!aberto} onOpenChange={(v) => !v && setAberto(null)}>
        <DialogContent className="max-w-[720px]">
          {aberto && <DetalheAgendamento agendamentoId={aberto} onFechar={() => setAberto(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
