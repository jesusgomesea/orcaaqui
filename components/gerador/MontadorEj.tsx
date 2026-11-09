"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Send, Save } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatMoney, todayStr, uuid } from "@/lib/helpers";
import { servicoContratoVazio } from "@/lib/orcamento";
import { linkWhatsApp } from "@/lib/gerador";
import {
  buscarCatalogoEj,
  codificarRefEj,
  gerarMensagemEj,
  itensDoRecalculoEj,
  novoCodigoEj,
  recalcularEj,
  selecaoEjVazia,
  type CatalogoEj,
  type CategoriaEjId,
  type RecalculoEj,
  type SelecaoEj,
} from "@/lib/ej";
import type { Cliente, Orcamento } from "@/lib/tipos";

const $ = (v: number) => formatMoney(v, "BRL");

/**
 * Montador com a tabela do EJ. Os pacotes vêm de GET /api/catalogo do site do
 * EJ e o cálculo de GET /api/recalcular — aqui não há preço nem regra do EJ,
 * só a escolha e a linha `[ref EJ-…]` (o que vai para o EJ é só essa linha).
 */
export function MontadorEj({
  existente,
  blocoCliente,
  resolverCliente,
  dados,
  onFechar,
}: {
  existente?: Orcamento;
  blocoCliente: ReactNode;
  resolverCliente: () => Cliente | null;
  dados: { data: string; horario: string; local: string; observacoes: string };
  onFechar: () => void;
}) {
  const { empresaAtiva, addOrcamento, updateOrcamento } = useStore();
  const url = empresaAtiva.config.urlTabelaEj ?? "";

  const [catalogo, setCatalogo] = useState<CatalogoEj | null>(null);
  const [erroCatalogo, setErroCatalogo] = useState("");
  const [sel, setSel] = useState<SelecaoEj>(() => selecaoEjVazia("ensaio"));
  // Reaproveita o código EJ de um orçamento que já veio daqui; senão, gera um.
  const [codigo] = useState(() => (existente?.codigoRef?.startsWith("EJ-") ? existente.codigoRef : novoCodigoEj()));
  const [emitidoEm] = useState(() => existente?.data || todayStr());
  const [recalculo, setRecalculo] = useState<RecalculoEj | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [erroCalculo, setErroCalculo] = useState("");

  useEffect(() => {
    let vivo = true;
    buscarCatalogoEj(url)
      .then((c) => vivo && setCatalogo(c))
      .catch((e) => vivo && setErroCatalogo(e instanceof Error ? e.message : "Não foi possível carregar a tabela do EJ."));
    return () => {
      vivo = false;
    };
  }, [url]);

  const categoria = catalogo?.categorias.find((c) => c.id === sel.categoria);
  const pacotes = useMemo(
    () => (catalogo?.pacotes ?? []).filter((p) => p.categoria === sel.categoria && !p.legado && p.ativo !== false),
    [catalogo, sel.categoria]
  );
  const pacote = pacotes.find((p) => p.id === sel.pacoteId);
  const entregas = (catalogo?.entregas ?? []).filter((e) => sel.pacoteId && e.pacotes?.includes(sel.pacoteId));
  const deslocamentos = (catalogo?.deslocamentos ?? []).filter((d) => !d.legado);
  const modosAux = catalogo?.auxiliar?.modos ?? [];
  const pers = categoria?.personalizado;

  const linhaRef = catalogo
    ? codificarRefEj({ codigo, versao: catalogo.versao, emitidoEm, selecao: sel, data: dados.data, horario: dados.horario })
    : "";
  const podeCalcular = !!catalogo && (sel.categoria === "auxiliar" ? sel.diariasAuxiliar > 0 : !!sel.pacoteId);

  // Recalcula pela API do EJ a cada mudança (com folga, para não chamar a cada tecla).
  useEffect(() => {
    if (!podeCalcular) return;
    let vivo = true;
    const id = setTimeout(() => {
      setCalculando(true);
      recalcularEj(url, linhaRef)
        .then((r) => {
          if (!vivo) return;
          setRecalculo(r);
          setErroCalculo("");
        })
        .catch((e) => vivo && setErroCalculo(e instanceof Error ? e.message : "Não foi possível calcular."))
        .finally(() => vivo && setCalculando(false));
    }, 350);
    return () => {
      vivo = false;
      clearTimeout(id);
    };
  }, [url, linhaRef, podeCalcular]);

  const set = (patch: Partial<SelecaoEj>) => setSel((s) => ({ ...s, ...patch }));
  const trocarCategoria = (c: CategoriaEjId) => {
    setSel(selecaoEjVazia(c));
    setRecalculo(null);
  };
  const escolherPacote = (id: string) => {
    const p = pacotes.find((x) => x.id === id);
    const pc = catalogo?.categorias.find((c) => c.id === p?.categoria)?.personalizado;
    set({
      pacoteId: id,
      entregaId: "padrao",
      horasExtras: 0,
      fotosExtras: 0,
      minutosPersonalizado: p?.personalizado && pc ? pc.minutosMin : 0,
      fotosPersonalizado: p?.personalizado && pc ? pc.fotosMin : 0,
    });
  };

  const atual = podeCalcular && recalculo && recalculo.codigo === codigo ? recalculo : null;

  const salvar = (enviar: boolean) => {
    if (!atual) {
      toast.error("Aguarde o cálculo pela tabela do EJ.");
      return;
    }
    const cliente = resolverCliente();
    if (!cliente) return;

    const horas = sel.minutosPersonalizado / 60;
    const campos: Partial<Orcamento> = {
      clienteId: cliente.id,
      moeda: "BRL",
      itens: itensDoRecalculoEj(atual, uuid),
      desconto: 0,
      descontoTipo: "valor",
      acrescimo: 0,
      observacoes: dados.observacoes,
      servicoContrato: {
        ...servicoContratoVazio(),
        ...existente?.servicoContrato,
        servico: categoria?.nome ?? atual.servico,
        pacote: pacote?.nome ?? "",
        dataServico: dados.data,
        horarioInicio: dados.horario,
        local: dados.local,
        tempoCampo: pacote?.personalizado ? "" : pacote?.duracao ?? "",
        fotosEditadas: pacote?.personalizado ? "" : pacote?.entrega ?? "",
        personalizado: !!pacote?.personalizado,
        personalizadoHoras: pacote?.personalizado ? Math.round(horas * 100) / 100 : 0,
        personalizadoFotos: pacote?.personalizado ? sel.fotosPersonalizado : 0,
        prazoEntrega: atual.prazo ? `${atual.prazo.detalhe.charAt(0).toUpperCase()}${atual.prazo.detalhe.slice(1)}` : "",
      },
      origem: "gerador",
      codigoRef: codigo,
      sinalPercentual: atual.sinalPercentual,
    };
    const status = enviar && (!existente || existente.status === "rascunho") ? "enviado" : existente?.status ?? "rascunho";
    if (existente) updateOrcamento(existente.id, { ...campos, status });
    else addOrcamento({ ...campos, data: emitidoEm, validadeDias: catalogo?.validadeDias ?? empresaAtiva.config.validadeDias, condicoes: empresaAtiva.condicoesPadrao || "", status });

    if (enviar) {
      const texto = gerarMensagemEj(atual, {
        empresaNome: empresaAtiva.nome,
        cliente: { nome: cliente.nome, telefone: cliente.telefone },
        local: dados.local,
        observacoes: dados.observacoes,
        validadeDias: catalogo?.validadeDias ?? empresaAtiva.config.validadeDias,
        linhaRef,
      });
      window.open(linkWhatsApp(cliente.telefone, texto), "_blank", "noopener,noreferrer");
      toast.success(`Orçamento ${codigo} salvo como enviado.`);
    } else {
      toast.success(`Orçamento ${codigo} salvo.`);
    }
    onFechar();
  };

  if (erroCatalogo) {
    return <p className="rounded-lg border border-danger-border bg-danger-tint p-3 text-[13px] text-danger">{erroCatalogo}</p>;
  }
  if (!catalogo) return <p className="text-[13px] text-text-muted">Carregando a tabela do EJ…</p>;

  const numero = (v: number, set: (n: number) => void, opts: { min?: number; max?: number; step?: number } = {}) => (
    <Input
      type="number"
      min={opts.min ?? 0}
      max={opts.max}
      step={opts.step ?? 1}
      value={v || ""}
      placeholder="0"
      onChange={(e) => set(Math.max(opts.min ?? 0, Math.floor(Number(e.target.value) || 0)))}
    />
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_280px]">
      <div className="space-y-4">
        {blocoCliente}

        <fieldset className="rounded-lg border border-border p-3.5">
          <legend className="px-1.5 text-xs font-semibold text-text-muted">Tabela do EJ · v{catalogo.versao}</legend>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {catalogo.categorias.filter((c) => !c.legado).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => trocarCategoria(c.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[12.5px] font-medium cursor-pointer",
                  sel.categoria === c.id ? "border-primary bg-primary-tint text-primary" : "border-border text-text-muted hover:text-text"
                )}
              >
                {c.nome}
              </button>
            ))}
          </div>

          {sel.categoria !== "auxiliar" && (
            <ul className="space-y-1.5">
              {pacotes.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => escolherPacote(p.id)}
                    className={cn(
                      "w-full rounded-lg border p-2.5 text-left cursor-pointer",
                      sel.pacoteId === p.id ? "border-primary bg-primary-tint" : "border-border hover:bg-bg"
                    )}
                  >
                    <div className="flex justify-between gap-2 text-[13px] font-semibold text-text">
                      <span>{p.nome}</span>
                      <span>{p.personalizado ? "monte" : $(p.preco)}</span>
                    </div>
                    <div className="text-[11.5px] text-text-muted">{[p.duracao, p.entrega, p.prazo].filter(Boolean).join(" · ")}</div>
                    {p.aviso && <div className="text-[11.5px] text-warning">{p.aviso}</div>}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {pacote?.personalizado && pers && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <Label>Cobertura (min, blocos de {pers.blocoMinutos})</Label>
                {numero(sel.minutosPersonalizado, (n) => set({ minutosPersonalizado: n }), { min: pers.minutosMin, max: pers.minutosMax, step: pers.blocoMinutos })}
              </div>
              <div>
                <Label>Fotos editadas (mín. {pers.fotosMin})</Label>
                {numero(sel.fotosPersonalizado, (n) => set({ fotosPersonalizado: n }), { min: 0 })}
              </div>
            </div>
          )}

          {pacote && !pacote.personalizado && categoria?.temSessao && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {categoria.horaExtra !== undefined && (
                <div><Label>Horas extras ({$(categoria.horaExtra)}/h)</Label>{numero(sel.horasExtras, (n) => set({ horasExtras: n }))}</div>
              )}
              {categoria.foto && (
                <div><Label>Fotos extras ({$(categoria.foto.preco)} cada)</Label>{numero(sel.fotosExtras, (n) => set({ fotosExtras: n }))}</div>
              )}
            </div>
          )}

          {sel.categoria === "auxiliar" && (
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Diárias</Label>{numero(sel.diariasAuxiliar, (n) => set({ diariasAuxiliar: n }), { min: 1 })}</div>
              {modosAux.length > 0 && (
                <div>
                  <Label>Modo</Label>
                  <Select value={sel.modoAuxiliar} onValueChange={(v) => set({ modoAuxiliar: v as "com" | "sem" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{modosAux.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {(pacote || sel.categoria === "auxiliar") && (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {pacote && entregas.length > 0 && (
                <div>
                  <Label>Entrega</Label>
                  <Select value={sel.entregaId} onValueChange={(v) => set({ entregaId: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="padrao">Padrão do pacote{pacote.prazo ? ` (${pacote.prazo})` : ""}</SelectItem>
                      {entregas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome} — {$(e.preco)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {deslocamentos.length > 0 && (
                <div>
                  <Label>Deslocamento</Label>
                  <Select value={sel.deslocamentoId} onValueChange={(v) => set({ deslocamentoId: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {deslocamentos.map((d) => <SelectItem key={d.id} value={d.id}>{d.nome} — {d.aCombinar ? "a combinar" : d.preco ? $(d.preco) : "sem custo"}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </fieldset>
      </div>

      <aside className="md:sticky md:top-0 md:self-start">
        <div className="rounded-lg border border-border bg-bg p-3.5 text-[13px]">
          <div className="mb-2 font-semibold text-text">Resumo · {codigo}</div>
          {!podeCalcular && <p className="text-text-muted">Escolha um pacote.</p>}
          {podeCalcular && calculando && !atual && <p className="text-text-muted">Calculando pela tabela do EJ…</p>}
          {erroCalculo && <p className="text-danger">{erroCalculo}</p>}
          {atual && (
            <>
              <ul className="space-y-1">
                {atual.linhas.map((l, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="min-w-0 text-text">{l.descricao}{l.quantidade > 1 ? ` × ${l.quantidade}` : ""}</span>
                    <span className="shrink-0 text-text">{l.tipo === "aCombinar" ? "a combinar" : $(l.valor)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex justify-between border-t border-border pt-2 text-[16px] font-bold text-text">
                <span>Total</span><span>{$(atual.total)}</span>
              </div>
              <div className="mt-1 flex justify-between text-text-muted"><span>Sinal ({atual.sinalPercentual}%)</span><span>{$(atual.sinal)}</span></div>
              <div className="flex justify-between text-text-muted"><span>Restante</span><span>{$(atual.restante)}</span></div>
              {atual.prazo && <div className="mt-2 text-[12px] text-text-muted">Entrega: {atual.prazo.nome} ({atual.prazo.detalhe})</div>}
              {[...atual.pendencias, ...atual.avisos].map((p) => <p key={p} className="mt-1.5 text-[12px] text-warning">{p}</p>)}
              {calculando && <p className="mt-1 text-[11.5px] text-text-muted">Atualizando…</p>}
            </>
          )}
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <Button onClick={() => salvar(true)} disabled={!atual || calculando}>
            <Send className="h-4 w-4" strokeWidth={1.8} /> Enviar pelo WhatsApp
          </Button>
          <Button variant="secondary" onClick={() => salvar(false)} disabled={!atual || calculando}>
            <Save className="h-4 w-4" strokeWidth={1.8} /> Salvar sem enviar
          </Button>
          <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
        </div>
        <p className="mt-2 text-[11px] text-text-muted">Preços e regras vêm do site do EJ. Só a linha [ref] é enviada para lá.</p>
      </aside>
    </div>
  );
}
