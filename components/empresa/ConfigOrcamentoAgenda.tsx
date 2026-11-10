"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { codigoServicoLivre, ETAPAS_PADRAO } from "@/lib/estado";
import { formatMoney, uuid } from "@/lib/helpers";
import { buscarCatalogoEj, URL_SUGERIDA_EJ } from "@/lib/ej";
import type { EtapaAgenda, FaixaDeslocamento } from "@/lib/tipos";

const legenda = "mb-3 px-1 text-xs font-semibold uppercase tracking-wide text-text-muted";
const botaoIcone =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-2 hover:text-text cursor-pointer disabled:opacity-40 disabled:pointer-events-none";

/** Id novo e curto (vai na [ref] como ds=), que não repete os existentes. */
function idNovo(existentes: string[]): string {
  return codigoServicoLivre(uuid(), new Set(existentes)).toLowerCase();
}

/**
 * Sinal, validade, faixas de deslocamento, etapas da agenda e a ligação com a
 * tabela do EJ. Tudo em `empresa.config`.
 */
export function ConfigOrcamentoAgenda() {
  const { state, empresaAtiva, updateConfig, aplicarSinalATodas } = useStore();
  const c = empresaAtiva.config;
  const moeda = empresaAtiva.moeda;
  const [testando, setTestando] = useState(false);

  const setDesl = (lista: FaixaDeslocamento[]) => updateConfig({ deslocamentos: lista });
  const setEtapas = (lista: EtapaAgenda[]) => updateConfig({ etapasAgenda: lista });

  const etapaEmUso = (id: string) => empresaAtiva.agendamentos.some((a) => a.etapa === id);

  const moverEtapa = (i: number, delta: number) => {
    const lista = [...c.etapasAgenda];
    const j = i + delta;
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    setEtapas(lista);
  };

  const removerEtapa = (e: EtapaAgenda) => {
    if (c.etapasAgenda.length <= 2) {
      toast.error("A agenda precisa de pelo menos duas etapas.");
      return;
    }
    if (etapaEmUso(e.id) && !confirm(`Há agendamentos na etapa "${e.nome}". Eles continuam com esse nome, mas a etapa some da lista. Remover?`)) return;
    setEtapas(c.etapasAgenda.filter((x) => x.id !== e.id));
  };

  const testarEj = async () => {
    const url = (c.urlTabelaEj || "").trim();
    if (!url) { toast.error("Informe o endereço do site."); return; }
    setTestando(true);
    try {
      const cat = await buscarCatalogoEj(url);
      toast.success(`Conectado: tabela v${cat.versao}, ${cat.pacotes.filter((p) => !p.legado && p.ativo !== false).length} pacotes.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível acessar a tabela.");
    } finally {
      setTestando(false);
    }
  };

  return (
    <Card className="mb-5">
      <fieldset>
        <legend className={legenda}>Orçamento e agenda</legend>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Sinal (%)</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                max="100"
                step="1"
                value={c.sinalPercentual}
                onChange={(e) => updateConfig({ sinalPercentual: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
              />
              {state.empresas.length > 1 && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (!confirm(`Usar sinal de ${c.sinalPercentual}% em todas as ${state.empresas.length} empresas?`)) return;
                    aplicarSinalATodas(c.sinalPercentual);
                    toast.success("Sinal aplicado a todas as empresas.");
                  }}
                >
                  Aplicar a todas
                </Button>
              )}
            </div>
            <p className="mt-1 text-[11.5px] text-text-muted">
              Arredondado para cima em valor inteiro. Orçamentos já criados mantêm o percentual deles.
              {c.sinalPercentual !== 40 && empresaAtiva.prestador?.habilitado && " O contrato só é gerado com sinal de 40% (o percentual está escrito no modelo)."}
            </p>
          </div>
          <div>
            <Label>Validade padrão (dias)</Label>
            <Input
              type="number"
              min="1"
              value={c.validadeDias}
              onChange={(e) => updateConfig({ validadeDias: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
            />
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-1.5 text-[13px] font-semibold text-text">Faixas de deslocamento</div>
          {c.deslocamentos.length === 0 && <p className="mb-2 text-[12.5px] text-text-muted">Nenhuma faixa. O gerador não oferece deslocamento.</p>}
          <div className="space-y-2">
            {c.deslocamentos.map((d, i) => (
              <div key={d.id} className="flex items-center gap-2">
                <Input
                  value={d.nome}
                  placeholder="Ex: 10 a 20 km de Teresina"
                  onChange={(e) => setDesl(c.deslocamentos.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))}
                />
                <Input
                  className="w-24 shrink-0 sm:w-32"
                  type="number"
                  min="0"
                  step="0.01"
                  value={d.valor}
                  title={`Valor (${formatMoney(d.valor, moeda)})`}
                  onChange={(e) => setDesl(c.deslocamentos.map((x, j) => (j === i ? { ...x, valor: Math.max(0, Number(e.target.value) || 0) } : x)))}
                />
                <button type="button" className={botaoIcone} title="Remover faixa" onClick={() => setDesl(c.deslocamentos.filter((_, j) => j !== i))}>
                  <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => setDesl([...c.deslocamentos, { id: idNovo(c.deslocamentos.map((d) => d.id)), nome: "", valor: 0 }])}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Adicionar faixa
          </Button>
        </div>

        <div className="mt-5">
          <div className="mb-1.5 text-[13px] font-semibold text-text">Etapas da agenda</div>
          <p className="mb-2 text-[12px] text-text-muted">Em ordem. A última conta como concluído (aba Entregues). &quot;Cancelado&quot; existe sempre.</p>
          <div className="space-y-2">
            {c.etapasAgenda.map((e, i) => (
              <div key={e.id} className="flex items-center gap-1.5">
                <span className="w-5 shrink-0 text-right text-[12px] text-text-muted">{i + 1}.</span>
                <Input
                  value={e.nome}
                  onChange={(ev) => setEtapas(c.etapasAgenda.map((x, j) => (j === i ? { ...x, nome: ev.target.value } : x)))}
                />
                <button type="button" className={botaoIcone} title="Subir" disabled={i === 0} onClick={() => moverEtapa(i, -1)}>
                  <ArrowUp className="h-4 w-4" strokeWidth={1.8} />
                </button>
                <button type="button" className={botaoIcone} title="Descer" disabled={i === c.etapasAgenda.length - 1} onClick={() => moverEtapa(i, 1)}>
                  <ArrowDown className="h-4 w-4" strokeWidth={1.8} />
                </button>
                <button type="button" className={botaoIcone} title="Remover etapa" onClick={() => removerEtapa(e)}>
                  <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEtapas([...c.etapasAgenda, { id: idNovo(c.etapasAgenda.map((e) => e.id)), nome: "Nova etapa" }])}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Adicionar etapa
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!confirm("Voltar às etapas padrão (Recebido → Confirmado → Sinal pago → Realizado → Entregue)?")) return;
                setEtapas(ETAPAS_PADRAO.map((e) => ({ ...e })));
              }}
            >
              Restaurar padrão
            </Button>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-1.5 text-[13px] font-semibold text-text">Tabela do EJ Fotografia</div>
          <p className="mb-2 text-[12px] text-text-muted">
            Com o endereço preenchido, o gerador oferece os pacotes do EJ e os orçamentos <code>[ref EJ-…]</code> colados são
            recalculados pela tabela de lá. Só a linha <code>[ref]</code> é enviada — nunca nome, telefone ou local do cliente.
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              className="min-w-0 flex-1"
              value={c.urlTabelaEj ?? ""}
              placeholder={URL_SUGERIDA_EJ}
              onChange={(e) => updateConfig({ urlTabelaEj: e.target.value.trim() || undefined })}
            />
            {!c.urlTabelaEj && (
              <Button type="button" variant="secondary" onClick={() => updateConfig({ urlTabelaEj: URL_SUGERIDA_EJ })}>
                Usar {URL_SUGERIDA_EJ.replace("https://", "")}
              </Button>
            )}
            <Button type="button" variant="secondary" disabled={testando || !c.urlTabelaEj} onClick={testarEj}>
              {testando ? "Testando…" : "Testar"}
            </Button>
          </div>
        </div>
      </fieldset>
    </Card>
  );
}
