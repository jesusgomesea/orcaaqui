"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, MessageCircle, Printer, Copy, FileSignature } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { TableWrap, Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { DocumentosOrcamento } from "@/components/documentos/DocumentosOrcamento";
import { gerarOrcamentoHtml, gerarTextoWhatsapp } from "@/lib/orcamento";
import {
  uuid, todayStr, addDaysStr, formatDateBR, formatMoney, MOEDAS, escapeHtml, logoSegura,
  formatarNumeroOrcamento, calcOrcamentoTotais, STATUS_LABEL, STATUS_TONE, STATUS_EDITAVEIS, statusEfetivo,
} from "@/lib/helpers";
import type {
  Cliente, CodigoMoeda, DescontoTipo, Empresa, ItemOrcamento, Orcamento, Servico, ServicoContrato, StatusOrcamento,
} from "@/lib/tipos";

function servicoContratoVazio(): ServicoContrato {
  return {
    servico: "", pacote: "", dataServico: "", horarioInicio: "", horarioFim: "", local: "",
    tempoCampo: "", fotosEditadas: "", personalizado: false, personalizadoHoras: 0, personalizadoFotos: 0, prazoEntrega: "",
  };
}

/** Campos do serviço usados no contrato. Só aparece com contratos habilitados na empresa. */
function DadosServicoFieldset({ valor, onChange }: { valor: ServicoContrato; onChange: (v: ServicoContrato) => void }) {
  const set = (patch: Partial<ServicoContrato>) => onChange({ ...valor, ...patch });
  return (
    <fieldset className="mb-3.5 rounded-lg border border-border p-3.5">
      <legend className="px-1.5 text-xs font-semibold text-text-muted">Dados do serviço (contrato)</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><Label>Serviço</Label><Input value={valor.servico} onChange={(e) => set({ servico: e.target.value })} placeholder="Ensaio ao ar livre" /></div>
        <div><Label>Pacote</Label><Input value={valor.pacote} onChange={(e) => set({ pacote: e.target.value })} placeholder="Padrão" /></div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><Label>Data do serviço</Label><Input type="date" value={valor.dataServico} onChange={(e) => set({ dataServico: e.target.value })} /></div>
        <div><Label>Início</Label><Input type="time" value={valor.horarioInicio} onChange={(e) => set({ horarioInicio: e.target.value })} /></div>
        <div><Label>Término (opcional)</Label><Input type="time" value={valor.horarioFim} onChange={(e) => set({ horarioFim: e.target.value })} /></div>
        <div><Label>Prazo de entrega</Label><Input value={valor.prazoEntrega} onChange={(e) => set({ prazoEntrega: e.target.value })} placeholder="Em até 24h" /></div>
      </div>
      <div className="mt-3"><Label>Local(is)</Label><Input value={valor.local} onChange={(e) => set({ local: e.target.value })} placeholder="Parque Potycabana" /></div>
      <label className="mt-3 flex cursor-pointer items-center gap-2 text-[13px] text-text">
        <input type="checkbox" className="h-4 w-4 accent-primary" checked={valor.personalizado} onChange={(e) => set({ personalizado: e.target.checked })} />
        Pacote Personalizado (horas e quantidade exata de fotos)
      </label>
      {valor.personalizado ? (
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div><Label>Horas</Label><Input type="number" min="0" step="0.5" value={valor.personalizadoHoras || ""} onChange={(e) => set({ personalizadoHoras: Number(e.target.value) || 0 })} /></div>
          <div><Label>Fotos editadas</Label><Input type="number" min="0" step="1" value={valor.personalizadoFotos || ""} onChange={(e) => set({ personalizadoFotos: Number(e.target.value) || 0 })} /></div>
        </div>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div><Label>Tempo em campo</Label><Input value={valor.tempoCampo} onChange={(e) => set({ tempoCampo: e.target.value })} placeholder="1h" /></div>
          <div><Label>Fotos editadas (faixa)</Label><Input value={valor.fotosEditadas} onChange={(e) => set({ fotosEditadas: e.target.value })} placeholder="30–40" /></div>
        </div>
      )}
      <p className="mt-2 text-[11.5px] text-text-muted">
        Marque como &quot;Adicional&quot; os itens que entram na lista de adicionais do contrato. O valor total do contrato é o total do orçamento.
      </p>
    </fieldset>
  );
}


// `numero` fica de fora: quem cria ainda não tem um, e quem edita carrega o
// que já foi gravado — o store é a única fonte que atribui número novo.
type OrcamentoForm = Omit<Orcamento, "id" | "criadoEm" | "numero"> & {
  id?: string;
  criadoEm?: string;
  numero?: number;
  _isEdit: boolean;
};

function novoOrcamentoPadrao(empresaAtiva: Empresa): Omit<Orcamento, "id" | "criadoEm" | "numero"> {
  return {
    clienteId: "",
    data: todayStr(),
    validadeDias: 15,
    moeda: empresaAtiva.moeda || "BRL",
    itens: [{ id: uuid(), descricao: "", quantidade: 1, valorUnitario: 0 }],
    desconto: 0,
    descontoTipo: "valor",
    acrescimo: 0,
    condicoes: empresaAtiva.condicoesPadrao || "",
    observacoes: "",
    status: "rascunho",
  };
}

function OrcamentoForm({
  orcamento,
  onSave,
  onCancel,
  onNovoCliente,
  clientes,
  servicos,
  contratos,
}: {
  orcamento: OrcamentoForm;
  onSave: (dados: OrcamentoForm) => void;
  onCancel: () => void;
  onNovoCliente: (aoSalvar: (novo: Cliente) => void) => void;
  clientes: Cliente[];
  servicos: Servico[];
  contratos: boolean;
}) {
  const [f, setF] = useState(orcamento);
  // Força a remontagem do seletor de serviço: ele é um "gatilho", não um campo
  // com valor — sem isso o item escolhido fica preso no trigger.
  const [pickerNonce, setPickerNonce] = useState<Record<string, number>>({});
  const set = (patch: Partial<OrcamentoForm>) => setF((p) => ({ ...p, ...patch }));

  const setItem = (id: string, patch: Partial<ItemOrcamento>) =>
    set({ itens: f.itens.map((it) => (it.id === id ? { ...it, ...patch } : it)) });
  const addItem = () => set({ itens: [...f.itens, { id: uuid(), descricao: "", quantidade: 1, valorUnitario: 0 }] });
  const removeItem = (id: string) => set({ itens: f.itens.length > 1 ? f.itens.filter((it) => it.id !== id) : f.itens });

  const { subtotal, total } = calcOrcamentoTotais(f.itens, f.desconto, f.descontoTipo, f.acrescimo);

  const handleSave = () => {
    if (!f.clienteId) { toast.error("Selecione um cliente."); return; }
    if (f.itens.every((it) => !it.descricao.trim())) { toast.error("Adicione ao menos um item com descrição."); return; }
    onSave(f);
  };

  return (
    <>
      <DialogTitle>{orcamento._isEdit ? "Editar" : "Novo"} orçamento</DialogTitle>

      <fieldset className="mb-3.5 rounded-lg border border-border p-3.5">
        <legend className="px-1.5 text-xs font-semibold text-text-muted">Cliente e validade</legend>
        <div className="mb-3 flex items-end gap-2">
          <div className="flex-1">
            <Label>Cliente *</Label>
            <Select value={f.clienteId || undefined} onValueChange={(v) => set({ clienteId: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="secondary" onClick={() => onNovoCliente((novo) => set({ clienteId: novo.id }))}>+ Novo</Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div><Label>Data de emissão</Label><Input type="date" value={f.data} onChange={(e) => set({ data: e.target.value })} /></div>
          <div><Label>Validade (dias)</Label><Input type="number" min="1" value={f.validadeDias} onChange={(e) => set({ validadeDias: Number(e.target.value) || 1 })} /></div>
          <div>
            <Label>Moeda</Label>
            <Select value={f.moeda} onValueChange={(v) => set({ moeda: v as CodigoMoeda })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MOEDAS.map((m) => <SelectItem key={m.codigo} value={m.codigo}>{m.codigo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={f.status} onValueChange={(v) => set({ status: v as StatusOrcamento })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_EDITAVEIS.map((v) => <SelectItem key={v} value={v}>{STATUS_LABEL[v]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="mt-2 text-[11.5px] text-text-muted">Válido até {formatDateBR(addDaysStr(f.data || todayStr(), f.validadeDias || 0))}.</p>
      </fieldset>

      <fieldset className="mb-3.5 rounded-lg border border-border p-3.5">
        <legend className="px-1.5 text-xs font-semibold text-text-muted">Itens do orçamento</legend>
        <div className="space-y-3">
          {f.itens.map((it) => (
            <div key={it.id} className="rounded-lg border border-border p-2.5">
              <div className="flex items-start gap-2">
                {servicos.length > 0 && (
                  <div className="w-40 shrink-0">
                    <Select
                      key={pickerNonce[it.id] || 0}
                      value={undefined}
                      onValueChange={(v) => {
                        const sv = servicos.find((s) => s.id === v);
                        if (sv) {
                          const descricao = sv.descricao ? `${sv.nome} — ${sv.descricao}` : sv.nome;
                          setItem(it.id, { descricao, valorUnitario: sv.valor });
                          setPickerNonce((p) => ({ ...p, [it.id]: (p[it.id] || 0) + 1 }));
                        }
                      }}
                    >
                      <SelectTrigger className="truncate"><SelectValue placeholder="Serviço..." /></SelectTrigger>
                      <SelectContent>
                        {servicos.map((s) => <SelectItem key={s.id} value={s.id}>{s.categoria ? `${s.categoria} — ${s.nome}` : s.nome} ({formatMoney(s.valor, f.moeda)})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="w-16"><Input type="number" min="0" step="1" title="Quantidade" value={it.quantidade} onChange={(e) => setItem(it.id, { quantidade: Number(e.target.value) || 0 })} /></div>
                <div className="w-28"><Input type="number" min="0" step="0.01" title="Valor unitário" value={it.valorUnitario} onChange={(e) => setItem(it.id, { valorUnitario: Number(e.target.value) || 0 })} /></div>
                {contratos && (
                  <label className="flex h-9 shrink-0 cursor-pointer items-center gap-1 text-[12px] text-text-muted" title="Aparece na lista de adicionais do contrato">
                    <input type="checkbox" className="h-3.5 w-3.5 accent-primary" checked={it.tipo === "adicional"} onChange={(e) => setItem(it.id, { tipo: e.target.checked ? "adicional" : undefined })} />
                    Adicional
                  </label>
                )}
                <div className="flex h-9 flex-1 items-center justify-end text-[13px] font-semibold text-text">{formatMoney((Number(it.quantidade) || 0) * (Number(it.valorUnitario) || 0), f.moeda)}</div>
                <button type="button" onClick={() => removeItem(it.id)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-danger-tint hover:text-danger cursor-pointer">
                  <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>
              <Textarea
                className="mt-2"
                rows={2}
                placeholder="Descrição do item/serviço"
                value={it.descricao}
                onChange={(e) => setItem(it.id, { descricao: e.target.value })}
              />
            </div>
          ))}
        </div>
        <button type="button" onClick={addItem} className="mt-2.5 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12.5px] font-semibold text-primary hover:bg-primary-tint cursor-pointer">
          <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Adicionar item
        </button>

        <div className="mt-3 flex flex-wrap items-center justify-end gap-4 border-t border-border pt-3">
          <div className="flex items-center gap-2">
            <Label className="mb-0">Desconto</Label>
            <Select value={f.descontoTipo} onValueChange={(v) => set({ descontoTipo: v as DescontoTipo })}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="valor">Valor</SelectItem>
                <SelectItem value="percentual">%</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" min="0" step="0.01" className="w-24" value={f.desconto} onChange={(e) => set({ desconto: Number(e.target.value) || 0 })} />
          </div>
          <div className="flex items-center gap-2">
            <Label className="mb-0">Acréscimo</Label>
            <Input type="number" min="0" step="0.01" className="w-24" value={f.acrescimo} onChange={(e) => set({ acrescimo: Number(e.target.value) || 0 })} />
          </div>
        </div>
        <div className="mt-2 flex justify-end text-[13px] text-text-muted">Subtotal: {formatMoney(subtotal, f.moeda)}</div>
        <div className="mt-1 flex justify-end text-[17px] font-bold text-text">Total: {formatMoney(total, f.moeda)}</div>
      </fieldset>

      {contratos && (
        <DadosServicoFieldset
          valor={{ ...servicoContratoVazio(), ...f.servicoContrato }}
          onChange={(servicoContrato) => set({ servicoContrato })}
        />
      )}

      <fieldset className="mb-3.5 rounded-lg border border-border p-3.5">
        <legend className="px-1.5 text-xs font-semibold text-text-muted">Condições e observações</legend>
        <div className="mb-3"><Label>Condições de pagamento</Label><Textarea rows={2} value={f.condicoes} onChange={(e) => set({ condicoes: e.target.value })} /></div>
        <div><Label>Observações (opcional)</Label><Textarea rows={2} value={f.observacoes} onChange={(e) => set({ observacoes: e.target.value })} /></div>
      </fieldset>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleSave}>Salvar</Button>
      </div>
    </>
  );
}


function MiniClienteForm({ onSave, onCancel }: { onSave: (dados: Omit<Cliente, "id">) => void; onCancel: () => void }) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  return (
    <>
      <div className="mb-3"><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus /></div>
      <div className="mb-1"><Label>Telefone/WhatsApp</Label><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button onClick={() => { if (!nome.trim()) { toast.error("Informe o nome."); return; } onSave({ nome: nome.trim(), telefone: telefone.trim(), documento: "", email: "", endereco: "", observacoes: "" }); }}>Salvar</Button>
      </div>
    </>
  );
}

export default function OrcamentosPage() {
  const { empresaAtiva, addOrcamento, updateOrcamento, removeOrcamento, addCliente } = useStore();
  const [modalOrcamento, setModalOrcamento] = useState<OrcamentoForm | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCliente, setModalCliente] = useState<{ onSaved: (novo: Cliente) => void } | null>(null);
  const [documentosId, setDocumentosId] = useState<string | null>(null);
  const contratosHabilitados = !!empresaAtiva.prestador?.habilitado;
  // Lido do store a cada render: pagamentos registrados no diálogo aparecem na hora.
  const orcamentoDocumentos = documentosId ? empresaAtiva.orcamentos.find((o) => o.id === documentosId) : undefined;

  const clienteNome = (id: string) => empresaAtiva.clientes.find((c) => c.id === id)?.nome || "(cliente removido)";

  const list = [...empresaAtiva.orcamentos].sort((a, b) => (a.data < b.data ? 1 : -1));

  const openNovo = () => { setModalOrcamento({ ...novoOrcamentoPadrao(empresaAtiva), _isEdit: false }); setModalOpen(true); };
  const openEditar = (o: Orcamento) => { setModalOrcamento({ ...o, _isEdit: true }); setModalOpen(true); };

  const handleSave = (dados: OrcamentoForm) => {
    const { _isEdit, id, ...campos } = dados;
    if (_isEdit && id) updateOrcamento(id, campos);
    else addOrcamento(campos);
    setModalOpen(false);
    toast.success("Orçamento salvo.");
  };

  const handleDuplicar = (o: Orcamento) => {
    // Pagamentos são do orçamento original: a cópia começa sem nenhum.
    const { id: _id, criadoEm: _criadoEm, numero: _numero, pagamentos: _pagamentos, ...campos } = o;
    addOrcamento({ ...campos, data: todayStr(), status: "rascunho", itens: campos.itens.map((it) => ({ ...it, id: uuid() })) });
    toast.success("Orçamento duplicado.");
  };

  const handleExcluir = (o: Orcamento) => {
    if (!confirm("Confirma a exclusão deste orçamento?")) return;
    removeOrcamento(o.id);
    toast.success("Orçamento excluído.");
  };

  const handlePdf = (o: Orcamento) => {
    const cliente = empresaAtiva.clientes.find((c) => c.id === o.clienteId);
    const container = document.getElementById("orcamento-print");
    if (!container) return;
    container.innerHTML = gerarOrcamentoHtml(o, cliente, formatarNumeroOrcamento(o.numero), empresaAtiva);
    window.print();
  };

  const handleWhatsapp = (o: Orcamento) => {
    const cliente = empresaAtiva.clientes.find((c) => c.id === o.clienteId);
    const texto = gerarTextoWhatsapp(o, cliente, formatarNumeroOrcamento(o.numero), empresaAtiva);
    const numero = (cliente?.telefone || "").replace(/\D/g, "");
    const url = `https://wa.me/${numero ? (numero.length <= 11 ? "55" + numero : numero) : ""}?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div>
      <h1 className="mb-5 text-[21px] font-bold text-text">Orçamentos</h1>
      <div className="mb-4 flex gap-2.5">
        <Button onClick={openNovo}>+ Novo orçamento</Button>
      </div>
      <Card>
        {list.length === 0 ? (
          <EmptyState message="Nenhum orçamento cadastrado ainda." />
        ) : (
          <TableWrap>
            <Table>
              <Thead><tr><Th>Número</Th><Th>Cliente</Th><Th>Emissão</Th><Th>Válido até</Th><Th>Total</Th><Th>Status</Th><Th></Th></tr></Thead>
              <tbody>
                {list.map((o) => {
                  const { total } = calcOrcamentoTotais(o.itens, o.desconto, o.descontoTipo, o.acrescimo);
                  const validoAte = addDaysStr(o.data, o.validadeDias);
                  const status = statusEfetivo(o);
                  return (
                    <Tr key={o.id}>
                      <Td className="font-semibold">{formatarNumeroOrcamento(o.numero)}</Td>
                      <Td>{clienteNome(o.clienteId)}</Td>
                      <Td>{formatDateBR(o.data)}</Td>
                      <Td>{formatDateBR(validoAte)}</Td>
                      <Td>{formatMoney(total, o.moeda || empresaAtiva.moeda)}</Td>
                      <Td><Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge></Td>
                      <Td className="whitespace-nowrap">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button variant="secondary" size="sm" onClick={() => openEditar(o)}>Editar</Button>
                          <Button variant="secondary" size="sm" onClick={() => handlePdf(o)} title="Gerar PDF/imprimir">
                            <Printer className="h-3.5 w-3.5" strokeWidth={1.8} />
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => handleWhatsapp(o)} title="Enviar por WhatsApp">
                            <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.8} />
                          </Button>
                          {contratosHabilitados && (
                            <Button variant="secondary" size="sm" onClick={() => setDocumentosId(o.id)} title="Contrato e recibos">
                              <FileSignature className="h-3.5 w-3.5" strokeWidth={1.8} />
                            </Button>
                          )}
                          <Button variant="secondary" size="sm" onClick={() => handleDuplicar(o)} title="Duplicar">
                            <Copy className="h-3.5 w-3.5" strokeWidth={1.8} />
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handleExcluir(o)}>Excluir</Button>
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-[720px]">
          {modalOrcamento && (
            <OrcamentoForm
              orcamento={modalOrcamento}
              clientes={empresaAtiva.clientes}
              servicos={empresaAtiva.servicos}
              contratos={contratosHabilitados}
              onSave={handleSave}
              onCancel={() => setModalOpen(false)}
              onNovoCliente={(onSaved) => setModalCliente({ onSaved })}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!orcamentoDocumentos} onOpenChange={(aberto) => !aberto && setDocumentosId(null)}>
        <DialogContent className="max-w-[720px]">
          {orcamentoDocumentos && (
            <>
              <DialogTitle>
                Contrato e recibos — {formatarNumeroOrcamento(orcamentoDocumentos.numero)} · {clienteNome(orcamentoDocumentos.clienteId)}
              </DialogTitle>
              <DocumentosOrcamento orcamento={orcamentoDocumentos} />
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!modalCliente} onOpenChange={(o) => !o && setModalCliente(null)}>
        <DialogContent>
          <DialogTitle>Novo cliente</DialogTitle>
          <MiniClienteForm
            onCancel={() => setModalCliente(null)}
            onSave={(dados) => {
              const novo = addCliente(dados);
              modalCliente?.onSaved(novo);
              setModalCliente(null);
              toast.success("Cliente salvo.");
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
