"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, UserRound } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { ClienteForm, type ClienteFormDados } from "@/components/clientes/ClienteForm";
import { cpfValido, emailValido } from "@/lib/documentos/formatos";
import { clientesParecidos } from "@/lib/orcamento";
import type { Cliente, Orcamento } from "@/lib/tipos";

/** O que o contrato exige do cliente (o resto é opcional — ver lib/documentos/campos.ts). */
function pendenciasDoCliente(c: Cliente): string[] {
  const p: string[] = [];
  if (!c.documento.trim()) p.push("sem CPF");
  else if (!cpfValido(c.documento)) p.push("CPF inválido");
  if (!c.email.trim()) p.push("sem e-mail");
  else if (!emailValido(c.email)) p.push("e-mail inválido");
  return p;
}

function Situacao({ cliente }: { cliente: Cliente }) {
  const p = pendenciasDoCliente(cliente);
  return p.length ? <Badge tone="amber">{p.join(" · ")}</Badge> : <Badge tone="green">pronto para o contrato</Badge>;
}

/**
 * Mostra o cliente ligado a este orçamento — é o cadastro que o contrato usa —
 * e deixa completar os dados ou trocar de cadastro sem sair daqui. Sem isso,
 * quem completava o CPF num cadastro repetido (mesmo nome, outro registro)
 * continuava barrado e acabava refazendo o orçamento.
 */
export function ClienteDoContrato({ orcamento }: { orcamento: Orcamento }) {
  const { empresaAtiva, updateCliente, updateOrcamento, updateAgendamento } = useStore();
  const [editando, setEditando] = useState<ClienteFormDados | null>(null);

  const cliente = empresaAtiva.clientes.find((c) => c.id === orcamento.clienteId);
  const parecidos = cliente ? clientesParecidos(empresaAtiva.clientes, cliente) : [];
  const ordenados = [...empresaAtiva.clientes].sort((a, b) => a.nome.localeCompare(b.nome));

  const trocar = (clienteId: string) => {
    if (clienteId === orcamento.clienteId) return;
    updateOrcamento(orcamento.id, { clienteId });
    // O agendamento guarda o cliente também: acompanha a troca.
    for (const a of empresaAtiva.agendamentos.filter((x) => x.orcamentoId === orcamento.id)) {
      updateAgendamento(a.id, (ag) => ({ ...ag, clienteId }));
    }
    const novo = empresaAtiva.clientes.find((c) => c.id === clienteId);
    toast.success(`Orçamento ligado a ${novo?.nome || "outro cliente"}.`);
  };

  const salvarEdicao = (dados: ClienteFormDados) => {
    const { _isEdit: _e, id, ...campos } = dados;
    if (id) updateCliente(id, campos);
    setEditando(null);
    toast.success("Cliente atualizado. Já pode gerar o contrato.");
  };

  return (
    <section className="rounded-2xl border border-border p-3.5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[14px] font-semibold text-text">
          <UserRound className="h-4 w-4" strokeWidth={1.8} /> Cliente do contrato
        </h3>
        {cliente && (
          <Button size="sm" variant="secondary" onClick={() => setEditando({ ...cliente, _isEdit: true })}>
            <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} /> Editar dados
          </Button>
        )}
      </div>

      {cliente ? (
        <div className="text-[13px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-text">{cliente.nome || "Sem nome"}</span>
            <Situacao cliente={cliente} />
          </div>
          <div className="mt-0.5 text-[12px] text-text-muted">
            CPF {cliente.documento || "—"} · {cliente.email || "sem e-mail"}
            {cliente.telefone ? ` · ${cliente.telefone}` : ""}
          </div>
        </div>
      ) : (
        <p className="text-[12.5px] text-danger">O cliente deste orçamento foi removido. Escolha outro abaixo.</p>
      )}

      {parecidos.length > 0 && (
        <div className="mt-3 rounded-xl border border-warning bg-warning-tint p-2.5 text-[12.5px]">
          <p className="mb-1.5 text-warning">
            {parecidos.length === 1 ? "Há outro cadastro" : `Há ${parecidos.length} outros cadastros`} com o mesmo nome ou WhatsApp.
            Se você completou os dados em outro, use-o neste orçamento:
          </p>
          <ul className="space-y-1.5">
            {parecidos.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex flex-wrap items-center gap-1.5 text-text">
                  {c.nome} <span className="text-text-muted">· CPF {c.documento || "—"} · {c.email || "sem e-mail"}</span>
                  <Situacao cliente={c} />
                </span>
                <Button size="sm" variant="secondary" onClick={() => trocar(c.id)}>Usar este cadastro</Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3">
        <Label>Trocar o cliente deste orçamento</Label>
        <Select value={cliente ? orcamento.clienteId : undefined} onValueChange={trocar}>
          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
          <SelectContent>
            {ordenados.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome || "Sem nome"}{c.documento ? ` · ${c.documento}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Dialog open={!!editando} onOpenChange={(aberto) => !aberto && setEditando(null)}>
        <DialogContent>
          {editando && <ClienteForm cliente={editando} onSave={salvarEdicao} onCancel={() => setEditando(null)} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}
