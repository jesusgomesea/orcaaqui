import { useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea, Label } from "@/components/ui/input";
import { TableWrap, Table, Thead, Th, Tr, Td } from "@/components/ui/table";

function clienteVazio() {
  return { nome: "", documento: "", telefone: "", email: "", endereco: "", observacoes: "" };
}

function ClienteForm({ cliente, onSave, onCancel }) {
  const [f, setF] = useState(cliente);
  const set = (patch) => setF((p) => ({ ...p, ...patch }));

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
          <Input value={f.documento} onChange={(e) => set({ documento: e.target.value })} />
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

function ClientesPage() {
  const { state, addCliente, updateCliente, removeCliente } = useStore();
  const [modalCliente, setModalCliente] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const list = [...state.clientes].sort((a, b) => a.nome.localeCompare(b.nome));

  const openNovo = () => { setModalCliente({ ...clienteVazio(), _isEdit: false }); setModalOpen(true); };
  const openEditar = (c) => { setModalCliente({ ...c, _isEdit: true }); setModalOpen(true); };

  const handleSave = (dados) => {
    const { _isEdit, id, ...campos } = dados;
    if (_isEdit) updateCliente(id, campos);
    else addCliente(campos);
    setModalOpen(false);
    toast.success("Cliente salvo.");
  };

  const handleExcluir = (c) => {
    const usado = state.orcamentos.some((o) => o.clienteId === c.id);
    if (usado && !confirm(`${c.nome} tem orçamentos vinculados. Excluir mesmo assim?`)) return;
    if (!usado && !confirm(`Confirma a exclusão de ${c.nome}?`)) return;
    removeCliente(c.id);
    toast.success("Cliente excluído.");
  };

  return (
    <div>
      <h1 className="mb-5 text-[21px] font-bold text-text">Clientes</h1>
      <div className="mb-4 flex gap-2.5">
        <Button onClick={openNovo}>+ Novo cliente</Button>
      </div>
      <Card>
        {list.length === 0 ? (
          <EmptyState message="Nenhum cliente cadastrado ainda." />
        ) : (
          <TableWrap>
            <Table>
              <Thead>
                <tr>
                  <Th>Nome</Th>
                  <Th>Telefone</Th>
                  <Th>E-mail</Th>
                  <Th></Th>
                </tr>
              </Thead>
              <tbody>
                {list.map((c) => (
                  <Tr key={c.id}>
                    <Td className="font-semibold">{c.nome}</Td>
                    <Td>{c.telefone || "-"}</Td>
                    <Td>{c.email || "-"}</Td>
                    <Td className="whitespace-nowrap">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="secondary" size="sm" onClick={() => openEditar(c)}>Editar</Button>
                        <Button variant="danger" size="sm" onClick={() => handleExcluir(c)}>Excluir</Button>
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
          {modalCliente && <ClienteForm cliente={modalCliente} onSave={handleSave} onCancel={() => setModalOpen(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ClientesPage;
