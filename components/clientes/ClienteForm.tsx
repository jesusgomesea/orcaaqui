"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea, Label } from "@/components/ui/input";
import { cpfValido, formatarCpf } from "@/lib/documentos/formatos";
import type { Cliente } from "@/lib/tipos";

export type ClienteFormDados = Omit<Cliente, "id"> & { id?: string; _isEdit: boolean };

/** Formulário de cliente (dentro de um Dialog): usado em Clientes e no contrato do orçamento. */
export function ClienteForm({
  cliente,
  onSave,
  onCancel,
}: {
  cliente: ClienteFormDados;
  onSave: (dados: ClienteFormDados) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState(cliente);
  const set = (patch: Partial<ClienteFormDados>) => setF((p) => ({ ...p, ...patch }));

  const handleSave = () => {
    if (!f.nome.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    onSave(f);
  };

  return (
    <>
      <DialogTitle>{cliente._isEdit ? "Editar" : "Novo"} cliente</DialogTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Nome *</Label>
          <Input value={f.nome} onChange={(e) => set({ nome: e.target.value })} autoFocus />
        </div>
        <div>
          <Label>CPF/CNPJ</Label>
          <Input
            value={f.documento}
            onChange={(e) => set({ documento: e.target.value })}
            // CPF válido sai formatado e com os zeros à esquerda que a planilha tira; CNPJ fica como está.
            onBlur={() => cpfValido(f.documento) && set({ documento: formatarCpf(f.documento) })}
          />
        </div>
        <div>
          <Label>Telefone/WhatsApp</Label>
          <Input value={f.telefone} onChange={(e) => set({ telefone: e.target.value })} />
        </div>
        <div>
          <Label>E-mail</Label>
          <Input type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} />
        </div>
        <div>
          <Label>Endereço</Label>
          <Input value={f.endereco} onChange={(e) => set({ endereco: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Label>Observações</Label>
          <Textarea rows={2} value={f.observacoes} onChange={(e) => set({ observacoes: e.target.value })} />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleSave}>Salvar</Button>
      </div>
    </>
  );
}
