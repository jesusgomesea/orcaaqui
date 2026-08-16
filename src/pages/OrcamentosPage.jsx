import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, MessageCircle, Printer, Copy } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { TableWrap, Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import {
  uuid, todayStr, addDaysStr, formatDateBR, formatMoney, MOEDAS,
  numeroOrcamento, calcOrcamentoTotais, STATUS_LABEL, STATUS_TONE, statusEfetivo,
} from "@/lib/helpers";

function novoOrcamentoPadrao(empresaAtiva) {
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

function OrcamentoForm({ orcamento, onSave, onCancel, onNovoCliente, clientes, servicos }) {
  const [f, setF] = useState(orcamento);
  const [pickerNonce, setPickerNonce] = useState({});
  const set = (patch) => setF((p) => ({ ...p, ...patch }));

  const setItem = (id, patch) => set({ itens: f.itens.map((it) => (it.id === id ? { ...it, ...patch } : it)) });
  const addItem = () => set({ itens: [...f.itens, { id: uuid(), descricao: "", quantidade: 1, valorUnitario: 0 }] });
  const removeItem = (id) => set({ itens: f.itens.length > 1 ? f.itens.filter((it) => it.id !== id) : f.itens });

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
            <Select value={f.moeda} onValueChange={(v) => set({ moeda: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MOEDAS.map((m) => <SelectItem key={m.codigo} value={m.codigo}>{m.codigo}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={f.status} onValueChange={(v) => set({ status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABEL).filter(([v]) => v !== "expirado").map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
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
            <Select value={f.descontoTipo} onValueChange={(v) => set({ descontoTipo: v })}>
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

function gerarOrcamentoHtml(o, cliente, numero, empresa) {
  const { subtotal, descontoValor, acrescimoValor, total } = calcOrcamentoTotais(o.itens, o.desconto, o.descontoTipo, o.acrescimo);
  const validoAte = addDaysStr(o.data, o.validadeDias);
  const cor = empresa.corPrimaria || "#2563eb";
  const moeda = o.moeda || empresa.moeda || "BRL";
  const linhas = o.itens.filter((it) => it.descricao.trim()).map((it) => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eee;">${it.descricao}</td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:center;">${it.quantidade}</td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;">${formatMoney(it.valorUnitario, moeda)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${formatMoney((Number(it.quantidade) || 0) * (Number(it.valorUnitario) || 0), moeda)}</td>
    </tr>`).join("");

  return `
    <div style="max-width:680px;margin:0 auto;font-family:-apple-system,'Segoe UI',Arial,sans-serif;color:#1a2233;padding:0 24px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:28px 0 20px;border-bottom:3px solid ${cor};">
        <div style="display:flex;align-items:center;gap:12px;">
          ${empresa.logoDataUrl ? `<img src="${empresa.logoDataUrl}" style="height:48px;max-width:140px;object-fit:contain;" />` : ""}
          <div>
            <div style="font-size:20px;font-weight:800;letter-spacing:-.3px;">${empresa.nome || "Sua Empresa"}</div>
            <div style="font-size:12px;color:#667085;margin-top:2px;">${[empresa.documento, empresa.telefone, empresa.email].filter(Boolean).join(" · ")}</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:12px;color:#667085;letter-spacing:.04em;text-transform:uppercase;font-weight:700;">Orçamento</div>
          <div style="font-size:20px;font-weight:800;color:${cor};">${numero}</div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;margin:22px 0;font-size:13px;">
        <div>
          <div style="color:#667085;font-size:11px;text-transform:uppercase;letter-spacing:.04em;font-weight:700;margin-bottom:4px;">Cliente</div>
          <div style="font-weight:600;">${cliente ? cliente.nome : "-"}</div>
          <div style="color:#667085;">${cliente?.telefone || cliente?.email || ""}</div>
        </div>
        <div style="text-align:right;">
          <div style="color:#667085;font-size:11px;text-transform:uppercase;letter-spacing:.04em;font-weight:700;margin-bottom:4px;">Emitido em</div>
          <div style="font-weight:600;">${formatDateBR(o.data)}</div>
          <div style="color:#b54708;font-weight:600;margin-top:6px;">Válido até ${formatDateBR(validoAte)}</div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:13.5px;margin-top:10px;">
        <thead>
          <tr style="background:#f6f5f1;">
            <th style="text-align:left;padding:9px 0 9px 10px;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#667085;">Descrição</th>
            <th style="text-align:center;padding:9px 0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#667085;">Qtd</th>
            <th style="text-align:right;padding:9px 0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#667085;">Valor unit.</th>
            <th style="text-align:right;padding:9px 10px 9px 0;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#667085;">Subtotal</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>

      <div style="display:flex;justify-content:flex-end;margin-top:14px;">
        <div style="width:260px;">
          <div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;color:#667085;">
            <span>Subtotal</span><span>${formatMoney(subtotal, moeda)}</span>
          </div>
          ${descontoValor > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;color:#b54708;"><span>Desconto</span><span>-${formatMoney(descontoValor, moeda)}</span></div>` : ""}
          ${acrescimoValor > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;color:#667085;"><span>Acréscimo</span><span>+${formatMoney(acrescimoValor, moeda)}</span></div>` : ""}
          <div style="display:flex;justify-content:space-between;font-size:19px;font-weight:800;padding:10px 0 0;border-top:2px solid #1a2233;margin-top:6px;">
            <span>Total</span><span>${formatMoney(total, moeda)}</span>
          </div>
        </div>
      </div>

      <div style="margin-top:28px;padding:16px 18px;background:#f6f5f1;border-radius:10px;font-size:12.5px;line-height:1.6;">
        <div style="font-weight:700;margin-bottom:4px;">Condições de pagamento</div>
        <div style="color:#333;white-space:pre-wrap;">${o.condicoes || "-"}</div>
        ${empresa.dadosBancarios ? `<div style="font-weight:700;margin:10px 0 4px;">Pagamento</div><div style="color:#333;white-space:pre-wrap;">${empresa.dadosBancarios}</div>` : ""}
        ${o.observacoes ? `<div style="font-weight:700;margin:10px 0 4px;">Observações</div><div style="color:#333;white-space:pre-wrap;">${o.observacoes}</div>` : ""}
      </div>

      <div style="text-align:center;color:#98a2b3;font-size:11.5px;margin-top:26px;padding-bottom:24px;">
        Orçamento gerado em ${formatDateBR(todayStr())}${empresa.nome ? " — " + empresa.nome : ""}
      </div>
    </div>
  `;
}

function gerarTextoWhatsapp(o, cliente, numero, empresa) {
  const moeda = o.moeda || empresa.moeda || "BRL";
  const { total } = calcOrcamentoTotais(o.itens, o.desconto, o.descontoTipo, o.acrescimo);
  const validoAte = addDaysStr(o.data, o.validadeDias);
  const itens = o.itens.filter((it) => it.descricao.trim())
    .map((it) => `• ${it.descricao} (${it.quantidade}x ${formatMoney(it.valorUnitario, moeda)})`).join("\n");
  return [
    `*Orçamento ${numero}*${empresa.nome ? " — " + empresa.nome : ""}`,
    cliente ? `Cliente: ${cliente.nome}` : "",
    "",
    itens,
    "",
    `*Total: ${formatMoney(total, moeda)}*`,
    `Válido até ${formatDateBR(validoAte)}`,
    o.condicoes ? `\n${o.condicoes}` : "",
  ].filter(Boolean).join("\n");
}

function OrcamentosPage() {
  const { empresaAtiva, addOrcamento, updateOrcamento, removeOrcamento, addCliente } = useStore();
  const [modalOrcamento, setModalOrcamento] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCliente, setModalCliente] = useState(null);

  const clienteNome = (id) => empresaAtiva.clientes.find((c) => c.id === id)?.nome || "(cliente removido)";

  const list = [...empresaAtiva.orcamentos].sort((a, b) => (a.data < b.data ? 1 : -1));

  const openNovo = () => { setModalOrcamento({ ...novoOrcamentoPadrao(empresaAtiva), _isEdit: false }); setModalOpen(true); };
  const openEditar = (o) => { setModalOrcamento({ ...o, _isEdit: true }); setModalOpen(true); };

  const handleSave = (dados) => {
    const { _isEdit, id, ...campos } = dados;
    if (_isEdit) updateOrcamento(id, campos);
    else addOrcamento(campos);
    setModalOpen(false);
    toast.success("Orçamento salvo.");
  };

  const handleDuplicar = (o) => {
    const { id: _id, criadoEm: _criadoEm, ...campos } = o;
    addOrcamento({ ...campos, data: todayStr(), status: "rascunho", itens: campos.itens.map((it) => ({ ...it, id: uuid() })) });
    toast.success("Orçamento duplicado.");
  };

  const handleExcluir = (o) => {
    if (!confirm("Confirma a exclusão deste orçamento?")) return;
    removeOrcamento(o.id);
    toast.success("Orçamento excluído.");
  };

  const handlePdf = (o, index) => {
    const cliente = empresaAtiva.clientes.find((c) => c.id === o.clienteId);
    document.getElementById("orcamento-print").innerHTML = gerarOrcamentoHtml(o, cliente, numeroOrcamento(empresaAtiva.orcamentos, index), empresaAtiva);
    window.print();
  };

  const handleWhatsapp = (o, index) => {
    const cliente = empresaAtiva.clientes.find((c) => c.id === o.clienteId);
    const texto = gerarTextoWhatsapp(o, cliente, numeroOrcamento(empresaAtiva.orcamentos, index), empresaAtiva);
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
                  const index = empresaAtiva.orcamentos.findIndex((x) => x.id === o.id);
                  const { total } = calcOrcamentoTotais(o.itens, o.desconto, o.descontoTipo, o.acrescimo);
                  const validoAte = addDaysStr(o.data, o.validadeDias);
                  const status = statusEfetivo(o);
                  return (
                    <Tr key={o.id}>
                      <Td className="font-semibold">{numeroOrcamento(empresaAtiva.orcamentos, index)}</Td>
                      <Td>{clienteNome(o.clienteId)}</Td>
                      <Td>{formatDateBR(o.data)}</Td>
                      <Td>{formatDateBR(validoAte)}</Td>
                      <Td>{formatMoney(total, o.moeda || empresaAtiva.moeda)}</Td>
                      <Td><Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge></Td>
                      <Td className="whitespace-nowrap">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button variant="secondary" size="sm" onClick={() => openEditar(o)}>Editar</Button>
                          <Button variant="secondary" size="sm" onClick={() => handlePdf(o, index)} title="Gerar PDF/imprimir">
                            <Printer className="h-3.5 w-3.5" strokeWidth={1.8} />
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => handleWhatsapp(o, index)} title="Enviar por WhatsApp">
                            <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.8} />
                          </Button>
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
              onSave={handleSave}
              onCancel={() => setModalOpen(false)}
              onNovoCliente={(onSaved) => setModalCliente({ onSaved })}
            />
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

function MiniClienteForm({ onSave, onCancel }) {
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

export default OrcamentosPage;
