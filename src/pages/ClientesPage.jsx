import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, UploadCloud } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea, Label } from "@/components/ui/input";
import { TableWrap, Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { todayStr, downloadFile, clientesParaCsv, csvParaClientes } from "@/lib/helpers";

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
  const { empresaAtiva, addCliente, addClientes, updateCliente, removeCliente } = useStore();
  const [modalCliente, setModalCliente] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const csvInputRef = useRef(null);

  const list = [...empresaAtiva.clientes].sort((a, b) => a.nome.localeCompare(b.nome));

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
    const usado = empresaAtiva.orcamentos.some((o) => o.clienteId === c.id);
    if (usado && !confirm(`${c.nome} tem orçamentos vinculados. Excluir mesmo assim?`)) return;
    if (!usado && !confirm(`Confirma a exclusão de ${c.nome}?`)) return;
    removeCliente(c.id);
    toast.success("Cliente excluído.");
  };

  const handleExportCsv = () => {
    if (empresaAtiva.clientes.length === 0) { toast.error("Nenhum cliente pra exportar."); return; }
    downloadFile(`clientes-${empresaAtiva.nome || "orcaaqui"}-${todayStr()}.csv`, clientesParaCsv(empresaAtiva.clientes), "text/csv");
    toast.success("Clientes exportados.");
  };

  const handleImportClick = () => csvInputRef.current?.click();

  const handleImportCsv = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const texto = await file.text();
      const clientes = csvParaClientes(texto);
      if (clientes.length === 0) { toast.error("Nenhum cliente válido encontrado no arquivo (verifique a coluna 'nome')."); return; }
      addClientes(clientes);
      toast.success(`${clientes.length} cliente(s) importado(s).`);
    } catch {
      toast.error("Não foi possível ler o arquivo CSV.");
    } finally {
      e.target.value = "";
    }
  };

  return (
    <div>
      <h1 className="mb-5 text-[21px] font-bold text-text">Clientes</h1>
      <div className="mb-4 flex flex-wrap gap-2.5">
        <Button onClick={openNovo}>+ Novo cliente</Button>
        <Button type="button" variant="secondary" onClick={handleImportClick}>
          <UploadCloud className="h-4 w-4" strokeWidth={1.8} /> Importar CSV
        </Button>
        <Button type="button" variant="secondary" onClick={handleExportCsv}>
          <Download className="h-4 w-4" strokeWidth={1.8} /> Exportar CSV
        </Button>
        <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportCsv} />
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
      <p className="mt-2.5 text-[11.5px] text-text-muted">
        O CSV importado/exportado usa as colunas: nome, documento, telefone, email, endereco, observacoes.
      </p>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          {modalCliente && <ClienteForm cliente={modalCliente} onSave={handleSave} onCancel={() => setModalOpen(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ClientesPage;
