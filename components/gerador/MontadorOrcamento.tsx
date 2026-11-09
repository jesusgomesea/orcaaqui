"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Minus, Plus, Send, Save } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { DialogTitle } from "@/components/ui/dialog";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatarNumeroOrcamento, formatMoney, todayStr, uuid } from "@/lib/helpers";
import { acharClientePorTelefone, servicoContratoVazio } from "@/lib/orcamento";
import {
  calcularGerador,
  gerarMensagemOrcamento,
  itensDoCalculo,
  linkWhatsApp,
  nomeUnidade,
  precoUnitario,
  refDaSelecao,
  selecaoDoOrcamento,
  selecaoVazia,
  type SelecaoGerador,
} from "@/lib/gerador";
import type { Orcamento } from "@/lib/tipos";
import { MontadorEj } from "./MontadorEj";

const NOVO_CLIENTE = "__novo__";

/**
 * "Montar orçamento": o prestador escolhe serviços do catálogo e vê total,
 * sinal e restante ao vivo. Enviar pelo WhatsApp salva como "enviado" e abre a
 * conversa com a mensagem + `[ref ORC-…]`, que volta colada na aprovação.
 * Com a tabela do EJ configurada, oferece também os pacotes do EJ.
 */
export function MontadorOrcamento({ existente, onFechar }: { existente?: Orcamento; onFechar: () => void }) {
  const { empresaAtiva, addCliente, addOrcamento, updateOrcamento } = useStore();
  const config = empresaAtiva.config;
  const moeda = existente?.moeda || empresaAtiva.moeda;
  const $ = (v: number) => formatMoney(v, moeda);
  const temEj = !!config.urlTabelaEj && moeda === "BRL";
  const [aba, setAba] = useState<"catalogo" | "ej">(existente?.codigoRef?.startsWith("EJ-") ? "ej" : "catalogo");

  const [clienteId, setClienteId] = useState(existente?.clienteId || "");
  const [novoNome, setNovoNome] = useState("");
  const [novoTelefone, setNovoTelefone] = useState("");
  const sc = { ...servicoContratoVazio(), ...existente?.servicoContrato };
  const [data, setData] = useState(sc.dataServico);
  const [horario, setHorario] = useState(sc.horarioInicio);
  const [local, setLocal] = useState(sc.local);
  const [observacoes, setObservacoes] = useState(existente?.observacoes ?? "");
  const [sel, setSel] = useState<SelecaoGerador>(() => (existente && selecaoDoOrcamento(existente)) || selecaoVazia());

  const pct = existente?.sinalPercentual ?? config.sinalPercentual;
  const ativos = empresaAtiva.servicos.filter((s) => s.ativo !== false || sel.itens.some((i) => i.servicoId === s.id));
  const categorias = useMemo(() => {
    const mapa = new Map<string, typeof ativos>();
    for (const s of [...ativos].sort((a, b) => a.nome.localeCompare(b.nome))) {
      const c = s.categoria || "Serviços";
      mapa.set(c, [...(mapa.get(c) ?? []), s]);
    }
    return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [ativos]);

  const calc = calcularGerador(sel, empresaAtiva.servicos, config, pct);
  const qtdDe = (id: string) => sel.itens.find((i) => i.servicoId === id)?.quantidade ?? 0;
  const setQtd = (id: string, qtd: number) => {
    const q = Math.max(0, Math.min(9999, Math.floor(qtd) || 0));
    setSel((s) => {
      const outros = s.itens.filter((i) => i.servicoId !== id);
      return { ...s, itens: q ? [...outros, { servicoId: id, quantidade: q }] : outros };
    });
  };

  const numero = existente?.numero ?? empresaAtiva.proximoNumero;
  const codigo = formatarNumeroOrcamento(numero);

  /** Cliente: o escolhido, ou cria só com nome e WhatsApp (reaproveita quem já tem o mesmo telefone). */
  const resolverCliente = () => {
    if (clienteId && clienteId !== NOVO_CLIENTE) return empresaAtiva.clientes.find((c) => c.id === clienteId) ?? null;
    if (!novoNome.trim()) {
      toast.error("Escolha um cliente ou informe ao menos o nome.");
      return null;
    }
    const mesmo = acharClientePorTelefone(empresaAtiva.clientes, novoTelefone);
    if (mesmo) {
      toast.info(`Usando o cliente já cadastrado com esse WhatsApp: ${mesmo.nome}.`);
      return mesmo;
    }
    return addCliente({ nome: novoNome.trim(), telefone: novoTelefone.trim() });
  };

  const salvar = (enviar: boolean) => {
    if (calc.pendencias.length) {
      toast.error(calc.pendencias[0]);
      return;
    }
    const cliente = resolverCliente();
    if (!cliente) return;

    const campos: Partial<Orcamento> = {
      clienteId: cliente.id,
      moeda,
      itens: itensDoCalculo(calc, uuid),
      desconto: calc.desconto,
      descontoTipo: "valor",
      acrescimo: calc.acrescimo,
      observacoes,
      servicoContrato: { ...sc, dataServico: data, horarioInicio: horario, local },
      origem: "gerador",
      codigoRef: codigo,
      sinalPercentual: pct,
    };
    const status = enviar && (!existente || existente.status === "rascunho") ? "enviado" : existente?.status ?? "rascunho";

    if (existente) {
      updateOrcamento(existente.id, { ...campos, status });
    } else {
      addOrcamento({
        ...campos,
        data: todayStr(),
        validadeDias: config.validadeDias,
        condicoes: empresaAtiva.condicoesPadrao || "",
        status,
      });
    }

    if (enviar) {
      const texto = gerarMensagemOrcamento(calc, {
        codigo,
        empresaNome: empresaAtiva.nome,
        moeda,
        cliente: { nome: cliente.nome, telefone: cliente.telefone },
        data,
        horario,
        local,
        observacoes,
        emitidoEm: existente?.data || todayStr(),
        validadeDias: existente?.validadeDias ?? config.validadeDias,
        ref: refDaSelecao(sel, { codigo, data, horario }, empresaAtiva),
      });
      window.open(linkWhatsApp(cliente.telefone, texto), "_blank", "noopener,noreferrer");
      toast.success(`Orçamento ${codigo} salvo como enviado.`);
    } else {
      toast.success(`Orçamento ${codigo} salvo.`);
    }
    onFechar();
  };

  const blocoCliente = (
    <fieldset className="rounded-lg border border-border p-3.5">
      <legend className="px-1.5 text-xs font-semibold text-text-muted">Cliente e serviço</legend>
      <Label>Cliente</Label>
      <Select value={clienteId || undefined} onValueChange={setClienteId}>
        <SelectTrigger><SelectValue placeholder="Escolha ou crie…" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NOVO_CLIENTE}>+ Novo (só nome e WhatsApp)</SelectItem>
          {[...empresaAtiva.clientes].sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {clienteId === NOVO_CLIENTE && (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input placeholder="Nome" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
          <Input placeholder="WhatsApp" inputMode="tel" value={novoTelefone} onChange={(e) => setNovoTelefone(e.target.value)} />
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div><Label>Data</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
        <div><Label>Horário</Label><Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} /></div>
      </div>
      <div className="mt-2"><Label>Local</Label><Input value={local} onChange={(e) => setLocal(e.target.value)} /></div>
      <div className="mt-2"><Label>Observações (vão na mensagem)</Label><Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} /></div>
    </fieldset>
  );

  return (
    <>
      <DialogTitle>{existente ? `Editar ${codigo}` : "Montar orçamento"}</DialogTitle>

      {temEj && (
        <div className="mb-3 inline-flex rounded-lg border border-border p-0.5 text-[13px]">
          {(["catalogo", "ej"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAba(a)}
              className={cn("rounded-md px-3 py-1.5 font-medium cursor-pointer", aba === a ? "bg-primary-tint text-primary" : "text-text-muted hover:text-text")}
            >
              {a === "catalogo" ? "Meu catálogo" : "Tabela do EJ"}
            </button>
          ))}
        </div>
      )}

      {aba === "ej" && temEj ? (
        <MontadorEj existente={existente} blocoCliente={blocoCliente} resolverCliente={resolverCliente} dados={{ data, horario, local, observacoes }} onFechar={onFechar} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            {blocoCliente}

            <fieldset className="rounded-lg border border-border p-3.5">
              <legend className="px-1.5 text-xs font-semibold text-text-muted">Serviços</legend>
              {categorias.length === 0 && (
                <p className="text-[12.5px] text-text-muted">Cadastre serviços em Serviços para montar orçamentos por aqui.</p>
              )}
              {categorias.map(([cat, lista]) => (
                <div key={cat} className="mb-3 last:mb-0">
                  <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-text-muted">{cat}</div>
                  <ul className="space-y-1.5">
                    {lista.map((s) => {
                      const q = qtdDe(s.id);
                      const { unitario, volume } = precoUnitario(s, Math.max(1, q));
                      return (
                        <li key={s.id} className={cn("flex items-center gap-2 rounded-lg border p-2", q ? "border-primary bg-primary-tint" : "border-border")}>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-semibold text-text">{s.nome}</div>
                            <div className="text-[11.5px] text-text-muted">
                              {$(unitario)} / {nomeUnidade(s.unidade)}
                              {volume && " (preço por volume)"}
                              {!volume && s.precoVolume !== undefined && s.volumeMin !== undefined && ` · ${$(s.precoVolume)} a partir de ${s.volumeMin}`}
                              {s.prazo && ` · ${s.prazo}`}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button type="button" variant="secondary" size="icon" className="h-8 w-8" aria-label={`Menos ${s.nome}`} onClick={() => setQtd(s.id, q - 1)} disabled={!q}>
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <Input
                              className="h-8 w-14 text-center"
                              inputMode="numeric"
                              value={q || ""}
                              placeholder="0"
                              aria-label={`Quantidade de ${s.nome}`}
                              onChange={(e) => setQtd(s.id, Number(e.target.value.replace(/\D/g, "")))}
                            />
                            <Button type="button" variant="secondary" size="icon" className="h-8 w-8" aria-label={`Mais ${s.nome}`} onClick={() => setQtd(s.id, q + 1)}>
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </fieldset>

            <fieldset className="rounded-lg border border-border p-3.5">
              <legend className="px-1.5 text-xs font-semibold text-text-muted">Ajustes</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {config.deslocamentos.length > 0 && (
                  <div>
                    <Label>Deslocamento</Label>
                    <Select value={sel.deslocamentoId || "nenhum"} onValueChange={(v) => setSel((s) => ({ ...s, deslocamentoId: v === "nenhum" ? "" : v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nenhum">Sem deslocamento</SelectItem>
                        {config.deslocamentos.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.nome || "(sem nome)"} — {d.valor ? $(d.valor) : "sem custo"}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Desconto</Label>
                  <Input type="number" min="0" step="0.01" value={sel.desconto || ""} placeholder="0" onChange={(e) => setSel((s) => ({ ...s, desconto: Math.max(0, Number(e.target.value) || 0) }))} />
                </div>
                <div>
                  <Label>Acréscimo</Label>
                  <Input type="number" min="0" step="0.01" value={sel.acrescimo || ""} placeholder="0" onChange={(e) => setSel((s) => ({ ...s, acrescimo: Math.max(0, Number(e.target.value) || 0) }))} />
                </div>
              </div>
            </fieldset>
          </div>

          <aside className="md:sticky md:top-0 md:self-start">
            <div className="rounded-lg border border-border bg-bg p-3.5 text-[13px]">
              <div className="mb-2 font-semibold text-text">Resumo · {codigo}</div>
              {calc.linhas.length === 0 ? (
                <p className="text-text-muted">Nenhum item ainda.</p>
              ) : (
                <ul className="space-y-1">
                  {calc.linhas.map((l) => (
                    <li key={(l.servicoId ?? l.deslocamentoId) + l.descricao} className="flex justify-between gap-2">
                      <span className="min-w-0 text-text">{l.descricao}{l.quantidade > 1 ? ` × ${l.quantidade}` : ""}</span>
                      <span className="shrink-0 text-text">{$(l.valor)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {calc.desconto > 0 && <div className="mt-1 flex justify-between text-warning"><span>Desconto</span><span>−{$(calc.desconto)}</span></div>}
              {calc.acrescimo > 0 && <div className="mt-1 flex justify-between text-text-muted"><span>Acréscimo</span><span>+{$(calc.acrescimo)}</span></div>}
              <div className="mt-2 flex justify-between border-t border-border pt-2 text-[16px] font-bold text-text">
                <span>Total</span><span>{$(calc.total)}</span>
              </div>
              <div className="mt-1 flex justify-between text-text-muted"><span>Sinal ({String(pct).replace(".", ",")}%)</span><span>{$(calc.sinal)}</span></div>
              <div className="flex justify-between text-text-muted"><span>Restante</span><span>{$(calc.restante)}</span></div>
              {calc.prazos.length > 0 && <div className="mt-2 text-[12px] text-text-muted">Prazo: {calc.prazos.join(" · ")}</div>}
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <Button onClick={() => salvar(true)} disabled={calc.pendencias.length > 0}>
                <Send className="h-4 w-4" strokeWidth={1.8} /> Enviar pelo WhatsApp
              </Button>
              <Button variant="secondary" onClick={() => salvar(false)} disabled={calc.pendencias.length > 0}>
                <Save className="h-4 w-4" strokeWidth={1.8} /> Salvar sem enviar
              </Button>
              <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
