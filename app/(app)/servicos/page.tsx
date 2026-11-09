"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea, Label } from "@/components/ui/input";
import { TableWrap, Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { formatMoney } from "@/lib/helpers";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { nomeUnidade, UNIDADES } from "@/lib/gerador";
import type { Servico, UnidadeServico } from "@/lib/tipos";


type ServicoForm = Omit<Servico, "id"> & { id?: string; _isEdit: boolean };

function servicoVazio(): Omit<Servico, "id"> {
  return { categoria: "", nome: "", descricao: "", valor: 0 };
}

function ServicoForm({
  servico,
  onSave,
  onCancel,
}: {
  servico: ServicoForm;
  onSave: (dados: ServicoForm) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState(servico);
  const set = (patch: Partial<ServicoForm>) => setF((p) => ({ ...p, ...patch }));

  const temVolume = f.precoVolume !== undefined || f.volumeMin !== undefined;

  const handleSave = () => {
    if (!f.nome.trim()) { toast.error("Informe o nome do serviço."); return; }
    if (temVolume) {
      if (!f.volumeMin || f.volumeMin < 2) { toast.error("A quantidade mínima do preço por volume precisa ser 2 ou mais."); return; }
      if (f.precoVolume === undefined || f.precoVolume >= f.valor) { toast.error("O preço por volume precisa ser menor que o valor padrão."); return; }
    }
    onSave(f);
  };

  return (
    <>
      <DialogTitle>{servico._isEdit ? "Editar" : "Novo"} serviço</DialogTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label>Categoria</Label>
          <Input value={f.categoria} onChange={(e) => set({ categoria: e.target.value })} placeholder="Ex: Ensaios" />
        </div>
        <div>
          <Label>Nome *</Label>
          <Input value={f.nome} onChange={(e) => set({ nome: e.target.value })} autoFocus />
        </div>
        <div className="sm:col-span-2">
          <Label>Descrição</Label>
          <Textarea rows={2} value={f.descricao} onChange={(e) => set({ descricao: e.target.value })} />
        </div>
        <div>
          <Label>Valor padrão (por unidade)</Label>
          <Input type="number" min="0" step="0.01" value={f.valor} onChange={(e) => set({ valor: Number(e.target.value) || 0 })} />
        </div>
        <div>
          <Label>Unidade</Label>
          <Select value={f.unidade ?? "un"} onValueChange={(v) => set({ unidade: v as UnidadeServico })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {UNIDADES.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Prazo de entrega (opcional)</Label>
          <Input value={f.prazo ?? ""} onChange={(e) => set({ prazo: e.target.value || undefined })} placeholder="Ex: Em até 7 dias" />
        </div>
        <div className="sm:col-span-2 rounded-lg border border-border p-3">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-text">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={temVolume}
              onChange={(e) => set(e.target.checked ? { volumeMin: 10, precoVolume: f.valor } : { volumeMin: undefined, precoVolume: undefined })}
            />
            Preço menor por volume
          </label>
          {temVolume && (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <Label>A partir de (quantidade)</Label>
                <Input type="number" min="2" step="1" value={f.volumeMin ?? ""} onChange={(e) => set({ volumeMin: Math.floor(Number(e.target.value) || 0) })} />
              </div>
              <div>
                <Label>Preço por unidade</Label>
                <Input type="number" min="0" step="0.01" value={f.precoVolume ?? ""} onChange={(e) => set({ precoVolume: Number(e.target.value) || 0 })} />
              </div>
              <p className="col-span-2 text-[11.5px] text-text-muted">Atingida a quantidade, TODAS as unidades saem pelo preço por volume.</p>
            </div>
          )}
        </div>
        <label className="sm:col-span-2 flex cursor-pointer items-center gap-2 text-[13px] text-text">
          <input type="checkbox" className="h-4 w-4 accent-primary" checked={f.ativo !== false} onChange={(e) => set({ ativo: e.target.checked ? undefined : false })} />
          Ativo (aparece no gerador de orçamento)
        </label>
      </div>
      {f.codigo && <p className="mt-3 text-[11.5px] text-text-muted">Código na mensagem do orçamento: <code>{f.codigo}</code></p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleSave}>Salvar</Button>
      </div>
    </>
  );
}

export default function ServicosPage() {
  const { empresaAtiva, addServico, updateServico, removeServico } = useStore();
  const [modalServico, setModalServico] = useState<ServicoForm | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const list = [...empresaAtiva.servicos].sort((a, b) => (a.categoria + a.nome).localeCompare(b.categoria + b.nome));

  const openNovo = () => { setModalServico({ ...servicoVazio(), _isEdit: false }); setModalOpen(true); };
  const openEditar = (s: Servico) => { setModalServico({ ...s, _isEdit: true }); setModalOpen(true); };

  const handleSave = (dados: ServicoForm) => {
    const { _isEdit, id, ...campos } = dados;
    if (_isEdit && id) updateServico(id, campos);
    else addServico(campos);
    setModalOpen(false);
    toast.success("Serviço salvo.");
  };

  const handleExcluir = (s: Servico) => {
    if (!confirm(`Confirma a exclusão de "${s.nome}"?`)) return;
    removeServico(s.id);
    toast.success("Serviço excluído.");
  };

  return (
    <div>
      <h1 className="mb-5 text-[21px] font-bold text-text">Catálogo de serviços</h1>
      <p className="mb-4 text-[13px] text-text-muted">
        Cadastre seus serviços com preço padrão. Eles alimentam o gerador de orçamento (com preço por volume e prazo) e o seletor do formulário livre. Mudar um preço avisa, ao colar uma mensagem antiga, que a tabela mudou.
      </p>
      <div className="mb-4 flex gap-2.5">
        <Button onClick={openNovo}>+ Novo serviço</Button>
      </div>
      <Card>
        {list.length === 0 ? (
          <EmptyState message="Nenhum serviço cadastrado ainda." />
        ) : (
          <TableWrap>
            <Table>
              <Thead><tr><Th>Categoria</Th><Th>Nome</Th><Th>Valor</Th><Th>Prazo</Th><Th></Th></tr></Thead>
              <tbody>
                {list.map((s) => (
                  <Tr key={s.id}>
                    <Td>{s.categoria || "-"}</Td>
                    <Td className="font-semibold">
                      {s.nome} {s.ativo === false && <Badge>Inativo</Badge>}
                    </Td>
                    <Td>
                      {formatMoney(s.valor, empresaAtiva.moeda)}
                      <span className="text-text-muted"> / {nomeUnidade(s.unidade)}</span>
                      {s.precoVolume !== undefined && s.volumeMin !== undefined && (
                        <div className="text-[11.5px] text-text-muted">
                          {formatMoney(s.precoVolume, empresaAtiva.moeda)} a partir de {s.volumeMin}
                        </div>
                      )}
                    </Td>
                    <Td>{s.prazo || "-"}</Td>
                    <Td className="whitespace-nowrap">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="secondary" size="sm" onClick={() => openEditar(s)}>Editar</Button>
                        <Button variant="danger" size="sm" onClick={() => handleExcluir(s)}>Excluir</Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          {modalServico && <ServicoForm servico={modalServico} onSave={handleSave} onCancel={() => setModalOpen(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
