"use client";

import { useEffect, useState } from "react";
import { EVENTO_MONTAR } from "@/components/layout/Sidebar";
import { toast } from "sonner";
import { Plus, Trash2, MessageCircle, Printer, Copy, FileSignature, CalendarCheck, CalendarDays } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { TableWrap, Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { DocumentosOrcamento } from "@/components/documentos/DocumentosOrcamento";
import { EditorParceria } from "@/components/parceria/EditorParceria";
import { textoParceria } from "@/lib/parceria";
import { limparImpressaoDocx } from "@/lib/documentosImpressao";
import { MontadorOrcamento } from "@/components/gerador/MontadorOrcamento";
import {
  aplicarServicoDosItens, calculoDoOrcamento, gerarMensagemOrcamento, linkWhatsApp, refDaSelecao, selecaoDoOrcamento,
  servicoContratoDosItens,
} from "@/lib/gerador";
import { percentualSinal } from "@/lib/agenda";
import { gerarOrcamentoHtml, gerarTextoWhatsapp, servicoContratoVazio } from "@/lib/orcamento";
import {
  uuid, todayStr, addDaysStr, formatDateBR, formatMoney, MOEDAS,
  formatarNumeroOrcamento, calcOrcamentoTotais, STATUS_LABEL, STATUS_TONE, STATUS_EDITAVEIS, statusEfetivo,
} from "@/lib/helpers";
import type {
  Cliente, CodigoMoeda, DescontoTipo, Empresa, ItemOrcamento, Orcamento, Servico, ServicoContrato, StatusOrcamento,
} from "@/lib/tipos";

/** Campos do serviço usados no contrato. Só aparece com contratos habilitados na empresa. */
function DadosServicoFieldset({ valor, onChange }: { valor: ServicoContrato; onChange: (v: ServicoContrato) => void }) {
  const set = (patch: Partial<ServicoContrato>) => onChange({ ...valor, ...patch });
  return (
    <fieldset className="mb-3.5 rounded-2xl border border-border p-3.5">
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
    validadeDias: empresaAtiva.config.validadeDias,
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

      <fieldset className="mb-3.5 rounded-2xl border border-border p-3.5">
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

      <fieldset className="mb-3.5 rounded-2xl border border-border p-3.5">
        <legend className="px-1.5 text-xs font-semibold text-text-muted">Itens do orçamento</legend>
        <div className="space-y-3">
          {f.itens.map((it) => (
            <div key={it.id} className="rounded-2xl border border-border p-2.5">
              <div className="flex flex-wrap items-end gap-2 sm:flex-nowrap sm:items-start">
                {servicos.length > 0 && (
                  <div className="w-full sm:w-40 sm:shrink-0">
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
                        {servicos.map((s) => <SelectItem key={s.id} value={s.id}>{s.categoria ? `${s.categoria} — ${s.nome}` : s.nome}{s.tipo === "produto" ? " · produto" : ""} ({formatMoney(s.valor, f.moeda)})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="w-16">
                  <span className="mb-0.5 block text-[11px] text-text-muted sm:hidden">Qtd</span>
                  <Input type="number" min="0" step="1" title="Quantidade" aria-label="Quantidade" value={it.quantidade} onChange={(e) => setItem(it.id, { quantidade: Number(e.target.value) || 0 })} />
                </div>
                <div className="w-28">
                  <span className="mb-0.5 block text-[11px] text-text-muted sm:hidden">Valor unit.</span>
                  <Input type="number" min="0" step="0.01" title="Valor unitário" aria-label="Valor unitário" value={it.valorUnitario} onChange={(e) => setItem(it.id, { valorUnitario: Number(e.target.value) || 0 })} />
                </div>
                {contratos && (
                  <label className="flex h-9 shrink-0 cursor-pointer items-center gap-1 text-[12px] text-text-muted" title="Aparece na lista de adicionais do contrato">
                    <input type="checkbox" className="h-3.5 w-3.5 accent-primary" checked={it.tipo === "adicional"} onChange={(e) => setItem(it.id, { tipo: e.target.checked ? "adicional" : undefined })} />
                    Adicional
                  </label>
                )}
                <div className="flex h-9 min-w-[5.5rem] flex-1 items-center justify-end text-[13px] font-semibold text-text">{formatMoney((Number(it.quantidade) || 0) * (Number(it.valorUnitario) || 0), f.moeda)}</div>
                <button type="button" onClick={() => removeItem(it.id)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-danger-tint hover:text-danger cursor-pointer">
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
        <button type="button" onClick={addItem} className="mt-2.5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold text-primary-texto hover:bg-primary-tint cursor-pointer">
          <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Adicionar item
        </button>

        <div className="mt-3 flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t border-border pt-3">
          <div className="flex items-center gap-2">
            <Label className="mb-0">Desconto</Label>
            <Select value={f.descontoTipo} onValueChange={(v) => set({ descontoTipo: v as DescontoTipo })}>
              <SelectTrigger className="w-20 sm:w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="valor">Valor</SelectItem>
                <SelectItem value="percentual">%</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" min="0" step="0.01" className="w-20 sm:w-24" value={f.desconto} onChange={(e) => set({ desconto: Number(e.target.value) || 0 })} />
          </div>
          <div className="flex items-center gap-2">
            <Label className="mb-0">Acréscimo</Label>
            <Input type="number" min="0" step="0.01" className="w-20 sm:w-24" value={f.acrescimo} onChange={(e) => set({ acrescimo: Number(e.target.value) || 0 })} />
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

      <EditorParceria orcamento={f} moeda={f.moeda} onChange={(parceria) => set({ parceria })} />

      <fieldset className="mb-3.5 rounded-2xl border border-border p-3.5">
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
  const { empresaAtiva, addOrcamento, updateOrcamento, removeOrcamento, addCliente, agendarOrcamento } = useStore();
  const [modalOrcamento, setModalOrcamento] = useState<OrcamentoForm | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalCliente, setModalCliente] = useState<{ onSaved: (novo: Cliente) => void } | null>(null);
  const [documentosId, setDocumentosId] = useState<string | null>(null);
  /** Montador aberto: `null` fechado, `"novo"` ou o orçamento sendo reeditado. */
  const [montador, setMontador] = useState<Orcamento | "novo" | null>(null);
  // Botão "+" da navegação (/orcamentos?montar=1): abre o montador e limpa a URL,
  // para voltar/recarregar não abrir de novo.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("montar")) return;
    url.searchParams.delete("montar");
    window.history.replaceState(null, "", url.pathname + url.search);
    // oxlint-disable-next-line react/set-state-in-effect -- sincroniza com a URL, que é externa ao React
    setMontador("novo");
  }, []);
  // Já nesta página, o "+" não navega: avisa por evento (ver Sidebar).
  useEffect(() => {
    const abrir = () => setMontador("novo");
    window.addEventListener(EVENTO_MONTAR, abrir);
    return () => window.removeEventListener(EVENTO_MONTAR, abrir);
  }, []);
  const contratosHabilitados = !!empresaAtiva.prestador?.habilitado;
  // Lido do store a cada render: pagamentos registrados no diálogo aparecem na hora.
  const orcamentoDocumentos = documentosId ? empresaAtiva.orcamentos.find((o) => o.id === documentosId) : undefined;

  const clienteNome = (id: string) => empresaAtiva.clientes.find((c) => c.id === id)?.nome || "(cliente removido)";

  const list = [...empresaAtiva.orcamentos].sort((a, b) => (a.data < b.data ? 1 : -1));

  const openNovo = () => { setModalOrcamento({ ...novoOrcamentoPadrao(empresaAtiva), _isEdit: false }); setModalOpen(true); };
  // Orçamento do gerador reabre no montador (se ainda for só de itens do catálogo); o resto, no formulário livre.
  const abreNoMontador = (o: Orcamento) =>
    o.origem === "gerador" && (o.codigoRef?.startsWith("EJ-") ? !!empresaAtiva.config.urlTabelaEj : !!selecaoDoOrcamento(o));
  const openEditar = (o: Orcamento) => {
    if (abreNoMontador(o)) { setMontador(o); return; }
    setModalOrcamento({ ...o, _isEdit: true });
    setModalOpen(true);
  };

  const handleSave = (dados: OrcamentoForm) => {
    const { _isEdit, id, ...campos } = dados;
    if (contratosHabilitados) {
      // Itens do catálogo completam serviço/pacote/tempo/fotos/prazo do contrato,
      // sem passar por cima do que foi digitado no "Dados do serviço".
      const antes = _isEdit && id ? empresaAtiva.orcamentos.find((o) => o.id === id) : undefined;
      campos.servicoContrato = aplicarServicoDosItens(
        { ...servicoContratoVazio(), ...campos.servicoContrato },
        servicoContratoDosItens(antes?.itens ?? [], empresaAtiva.servicos),
        servicoContratoDosItens(campos.itens, empresaAtiva.servicos)
      );
    }
    if (_isEdit && id) updateOrcamento(id, campos);
    else addOrcamento(campos);
    setModalOpen(false);
    toast.success("Orçamento salvo.");
  };

  const router = useRouter();
  const agendado = (o: Orcamento) => empresaAtiva.agendamentos.some((a) => a.orcamentoId === o.id);

  const handleAgendar = (o: Orcamento) => {
    const numero = formatarNumeroOrcamento(o.numero);
    if (!confirm(`O cliente aprovou o ${numero}? Ele fica como aprovado e entra na Agenda.`)) return;
    const r = agendarOrcamento(o.id);
    if (!r) return;
    toast.success(`${numero} aprovado e agendado.`, {
      action: { label: "Abrir agenda", onClick: () => router.push("/agenda") },
    });
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
    // Tira a regra @page de um contrato/recibo impresso antes, se houver.
    limparImpressaoDocx();
    container.innerHTML = gerarOrcamentoHtml(o, cliente, formatarNumeroOrcamento(o.numero), empresaAtiva);
    window.print();
  };

  const handleWhatsapp = (o: Orcamento) => {
    const cliente = empresaAtiva.clientes.find((c) => c.id === o.clienteId);
    const numero = formatarNumeroOrcamento(o.numero);
    const sel = o.origem === "gerador" && !o.codigoRef?.startsWith("EJ-") ? selecaoDoOrcamento(o) : null;
    let texto: string;
    if (sel) {
      // Orçamento do gerador: mesma mensagem, com a [ref ORC-…], e os preços gravados nele.
      const sc = o.servicoContrato;
      const calc = calculoDoOrcamento(o, empresaAtiva.servicos, percentualSinal(o, empresaAtiva));
      texto = gerarMensagemOrcamento(calc, {
        codigo: numero,
        empresaNome: empresaAtiva.nome,
        moeda: o.moeda || empresaAtiva.moeda,
        cliente: { nome: cliente?.nome ?? "", telefone: cliente?.telefone ?? "" },
        data: sc?.dataServico ?? "",
        horario: sc?.horarioInicio ?? "",
        local: sc?.local ?? "",
        observacoes: o.observacoes,
        emitidoEm: o.data,
        validadeDias: o.validadeDias,
        ref: refDaSelecao(sel, { codigo: numero, data: sc?.dataServico ?? "", horario: sc?.horarioInicio ?? "" }, empresaAtiva),
        parceria: textoParceria(o, o.moeda || empresaAtiva.moeda) || undefined,
      });
    } else {
      texto = gerarTextoWhatsapp(o, cliente, numero, empresaAtiva);
    }
    window.open(linkWhatsApp(cliente?.telefone ?? "", texto), "_blank", "noopener,noreferrer");
    // Enviar ao cliente tira do rascunho.
    if (o.status === "rascunho") {
      updateOrcamento(o.id, { status: "enviado" });
      toast.success(`${numero} marcado como enviado.`);
    }
  };

  /** Ações de um orçamento — as mesmas no cartão (celular) e na linha da tabela (desktop). */
  const acoes = (o: Orcamento, status: ReturnType<typeof statusEfetivo>, tabela = false) => {
    const icone = "w-[34px] px-0";
    return (
    <div className={cn("flex", tabela ? "flex-nowrap justify-end gap-1.5" : "flex-wrap gap-1 sm:gap-1.5")}>
      <Button variant="secondary" size="sm" onClick={() => openEditar(o)}>Editar</Button>
      <Button variant="secondary" size="sm" className={icone} onClick={() => handlePdf(o)} title="Gerar PDF/imprimir" aria-label="Gerar PDF ou imprimir">
        <Printer className="h-3.5 w-3.5" strokeWidth={1.8} />
      </Button>
      <Button variant="secondary" size="sm" className={icone} onClick={() => handleWhatsapp(o)} title="Enviar por WhatsApp" aria-label="Enviar por WhatsApp">
        <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.8} />
      </Button>
      {agendado(o) ? (
        <Link href="/agenda" title="Ver na agenda" aria-label="Ver na agenda" className={cn("inline-flex h-9 items-center justify-center rounded-full bg-surface-2 text-text hover:bg-border-strong/60", icone)}>
          <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.8} />
        </Link>
      ) : (
        status !== "recusado" && (
          <Button variant="secondary" size="sm" className={icone} onClick={() => handleAgendar(o)} title="Cliente aprovou → agendar" aria-label="Cliente aprovou, agendar">
            <CalendarCheck className="h-3.5 w-3.5" strokeWidth={1.8} />
          </Button>
        )
      )}
      {contratosHabilitados && (
        <Button variant="secondary" size="sm" className={icone} onClick={() => setDocumentosId(o.id)} title="Contrato e recibos" aria-label="Contrato e recibos">
          <FileSignature className="h-3.5 w-3.5" strokeWidth={1.8} />
        </Button>
      )}
      <Button variant="secondary" size="sm" className={icone} onClick={() => handleDuplicar(o)} title="Duplicar" aria-label="Duplicar">
        <Copy className="h-3.5 w-3.5" strokeWidth={1.8} />
      </Button>
      <Button variant="danger" size="sm" className={tabela ? undefined : icone} onClick={() => handleExcluir(o)} aria-label="Excluir" title="Excluir">
        {tabela ? "Excluir" : <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />}
      </Button>
    </div>
  );
  };

  return (
    <div>
      <h1 className="mb-5 text-[21px] font-bold text-text">Orçamentos</h1>
      <div className="mb-4 flex flex-wrap gap-2.5">
        <Button onClick={() => setMontador("novo")}>Montar orçamento</Button>
        <Button variant="secondary" onClick={openNovo}>+ Orçamento livre</Button>
      </div>
      <Card className="p-0 xl:p-5">
        {list.length === 0 ? (
          <EmptyState message="Nenhum orçamento cadastrado ainda." />
        ) : (
          <>
            {/* Até 1280px: cartões (a tabela com 7 colunas e 8 ações não cabe e empilhava os botões). */}
            <ul className="divide-y divide-border xl:hidden">
              {list.map((o) => {
                const { total } = calcOrcamentoTotais(o.itens, o.desconto, o.descontoTipo, o.acrescimo);
                const status = statusEfetivo(o);
                return (
                  <li key={o.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[13.5px] font-semibold text-text">
                          {formatarNumeroOrcamento(o.numero)}
                          {o.codigoRef?.startsWith("EJ-") && <span className="ml-1.5 text-[11.5px] font-normal text-text-muted">{o.codigoRef}</span>}
                          {o.parceria && <Badge tone="green" className="ml-1.5 align-middle">Parceria</Badge>}
                        </div>
                        <div className="truncate text-[13px] text-text">{clienteNome(o.clienteId)}</div>
                      </div>
                      <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
                    </div>
                    <div className="mt-1 flex items-end justify-between gap-2">
                      <div className="text-[12px] text-text-muted">
                        {formatDateBR(o.data)} · válido até {formatDateBR(addDaysStr(o.data, o.validadeDias))}
                      </div>
                      <div className="shrink-0 text-[15px] font-bold text-text">{formatMoney(total, o.moeda || empresaAtiva.moeda)}</div>
                    </div>
                    <div className="mt-3">{acoes(o, status)}</div>
                  </li>
                );
              })}
            </ul>

            <TableWrap className="hidden xl:block">
              <Table>
                <Thead><tr><Th>Número</Th><Th>Cliente</Th><Th>Emissão</Th><Th>Válido até</Th><Th>Total</Th><Th>Status</Th><Th></Th></tr></Thead>
                <tbody>
                  {list.map((o) => {
                    const { total } = calcOrcamentoTotais(o.itens, o.desconto, o.descontoTipo, o.acrescimo);
                    const validoAte = addDaysStr(o.data, o.validadeDias);
                    const status = statusEfetivo(o);
                    return (
                      <Tr key={o.id}>
                        <Td className="font-semibold whitespace-nowrap">
                          {formatarNumeroOrcamento(o.numero)}
                          {o.codigoRef?.startsWith("EJ-") && <div className="text-[11px] font-normal text-text-muted">{o.codigoRef}</div>}
                          {o.parceria && <div><Badge tone="green">Parceria</Badge></div>}
                        </Td>
                        <Td>{clienteNome(o.clienteId)}</Td>
                        <Td className="whitespace-nowrap">{formatDateBR(o.data)}</Td>
                        <Td className="whitespace-nowrap">{formatDateBR(validoAte)}</Td>
                        <Td className="whitespace-nowrap">{formatMoney(total, o.moeda || empresaAtiva.moeda)}</Td>
                        <Td><Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge></Td>
                        <Td>{acoes(o, status, true)}</Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableWrap>
          </>
        )}
      </Card>

      <Dialog open={!!montador} onOpenChange={(aberto) => !aberto && setMontador(null)}>
        <DialogContent className="max-w-[980px]">
          {montador && (
            <MontadorOrcamento
              key={montador === "novo" ? "novo" : montador.id}
              existente={montador === "novo" ? undefined : montador}
              onFechar={() => setMontador(null)}
            />
          )}
        </DialogContent>
      </Dialog>

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
