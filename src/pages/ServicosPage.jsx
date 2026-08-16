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

function servicoVazio() {
  return { categoria: "", nome: "", descricao: "", valor: 0 };
}

function ServicoForm({ servico, onSave, onCancel }) {
  const [f, setF] = useState(servico);
  const set = (patch) => setF((p) => ({ ...p, ...patch }));

  const handleSave = () => {
    if (!f.nome.trim()) { toast.error("Informe o nome do serviço."); return; }
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
          <Label>Valor padrão</Label>
          <Input type="number" min="0" step="0.01" value={f.valor} onChange={(e) => set({ valor: Number(e.target.value) || 0 })} />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleSave}>Salvar</Button>
      </div>
    </>
  );
}

function ServicosPage() {
  const { empresaAtiva, addServico, updateServico, removeServico } = useStore();
  const [modalServico, setModalServico] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const list = [...empresaAtiva.servicos].sort((a, b) => (a.categoria + a.nome).localeCompare(b.categoria + b.nome));

  const openNovo = () => { setModalServico({ ...servicoVazio(), _isEdit: false }); setModalOpen(true); };
  const openEditar = (s) => { setModalServico({ ...s, _isEdit: true }); setModalOpen(true); };

  const handleSave = (dados) => {
    const { _isEdit, id, ...campos } = dados;
    if (_isEdit) updateServico(id, campos);
    else addServico(campos);
    setModalOpen(false);
    toast.success("Serviço salvo.");
  };

  const handleExcluir = (s) => {
    if (!confirm(`Confirma a exclusão de "${s.nome}"?`)) return;
    removeServico(s.id);
    toast.success("Serviço excluído.");
  };

  return (
    <div>
      <h1 className="mb-5 text-[21px] font-bold text-text">Catálogo de serviços</h1>
      <p className="mb-4 text-[13px] text-text-muted">
        Cadastre seus serviços com preço padrão. Ao montar um orçamento, você pode selecionar um serviço daqui pra preencher o item automaticamente.
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
              <Thead><tr><Th>Categoria</Th><Th>Nome</Th><Th>Valor</Th><Th></Th></tr></Thead>
              <tbody>
                {list.map((s) => (
                  <Tr key={s.id}>
                    <Td>{s.categoria || "-"}</Td>
                    <Td className="font-semibold">{s.nome}</Td>
                    <Td>{formatMoney(s.valor, empresaAtiva.moeda)}</Td>
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

export default ServicosPage;
