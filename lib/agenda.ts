// Regras da agenda: etapas, valores (total, pago, restante, sinal) e ordem.
// Porte do modelo do painel do EJ Fotografia, com duas diferenças:
// - pagamentos ficam em `Orcamento.pagamentos` (os mesmos dos recibos);
// - data, horário e local vêm de `Orcamento.servicoContrato`.
// Puro e sem React, coberto por lib/agenda.test.ts.

import { calcOrcamentoTotais, uuid } from "./helpers";
import { calcularSinal, paraCentavos } from "./documentos/formatos";
import { SINAL_PADRAO } from "./estado";
import { ETAPA_CANCELADO, type Agendamento, type Empresa, type EtapaAgenda, type Orcamento } from "./tipos";

/** % do sinal que vale para o orçamento: o dele, senão o da empresa, senão 40. */
export function percentualSinal(orcamento: Pick<Orcamento, "sinalPercentual">, empresa?: Pick<Empresa, "config">): number {
  return orcamento.sinalPercentual ?? empresa?.config?.sinalPercentual ?? SINAL_PADRAO;
}

export function totalDoOrcamento(o: Pick<Orcamento, "itens" | "desconto" | "descontoTipo" | "acrescimo">): number {
  return calcOrcamentoTotais(o.itens, o.desconto, o.descontoTipo, o.acrescimo).total;
}

export function novoAgendamento(
  orcamento: Orcamento,
  empresa: Pick<Empresa, "config" | "moeda">,
  agora: Date = new Date()
): Agendamento {
  const em = agora.toISOString();
  const etapa = empresa.config.etapasAgenda[0]?.id ?? "recebido";
  return {
    id: uuid(),
    criadoEm: em,
    atualizadoEm: em,
    orcamentoId: orcamento.id,
    clienteId: orcamento.clienteId,
    moeda: orcamento.moeda || empresa.moeda || "BRL",
    etapa,
    historico: [{ etapa, em }],
    extras: [],
    notas: "",
    valorCombinado: null,
    // Gravado agora: se a configuração mudar depois, o combinado com este cliente não muda.
    sinalPercentual: percentualSinal(orcamento, empresa),
  };
}

/** Base combinada: o valor fechado na conversa, ou o total do orçamento. */
export function valorBase(a: Pick<Agendamento, "valorCombinado">, orcamento: Orcamento | undefined): number {
  return a.valorCombinado ?? (orcamento ? totalDoOrcamento(orcamento) : 0);
}

/** Total a receber: base + extras de pós-venda. */
export function valorTotal(a: Pick<Agendamento, "valorCombinado" | "extras">, orcamento: Orcamento | undefined): number {
  const centavos = paraCentavos(valorBase(a, orcamento)) + a.extras.reduce((s, x) => s + paraCentavos(x.valor), 0);
  return centavos / 100;
}

export function valorPago(orcamento: Orcamento | undefined): number {
  return (orcamento?.pagamentos ?? []).reduce((s, p) => s + paraCentavos(p.valor), 0) / 100;
}

export function valorRestante(a: Pick<Agendamento, "valorCombinado" | "extras">, orcamento: Orcamento | undefined): number {
  return Math.max(0, paraCentavos(valorTotal(a, orcamento)) - paraCentavos(valorPago(orcamento))) / 100;
}

/** Sinal sobre a base combinada (extras de pós-venda não entram no sinal). */
export function valorDoSinal(
  a: Pick<Agendamento, "valorCombinado" | "sinalPercentual">,
  orcamento: Orcamento | undefined
): number {
  return calcularSinal(valorBase(a, orcamento), a.sinalPercentual).sinal;
}

export type Situacao = "ativo" | "concluido" | "cancelado";

/** Cancelado é fixo; a última etapa configurada é a de "concluído" (aba Entregues). */
export function situacao(a: Pick<Agendamento, "etapa">, etapas: EtapaAgenda[]): Situacao {
  if (a.etapa === ETAPA_CANCELADO) return "cancelado";
  return etapas.length && a.etapa === etapas[etapas.length - 1].id ? "concluido" : "ativo";
}

export function nomeEtapa(etapa: string, etapas: EtapaAgenda[]): string {
  if (etapa === ETAPA_CANCELADO) return "Cancelado";
  // Etapa removida da configuração depois: mostra o id em vez de sumir.
  return etapas.find((e) => e.id === etapa)?.nome ?? etapa;
}

export function indiceEtapa(etapa: string, etapas: EtapaAgenda[]): number {
  return etapas.findIndex((e) => e.id === etapa);
}

export function mudarEtapa(a: Agendamento, etapa: string, agora: Date = new Date()): Agendamento {
  if (a.etapa === etapa) return a;
  const em = agora.toISOString();
  return { ...a, etapa, atualizadoEm: em, historico: [...a.historico, { etapa, em }] };
}

/** Data e horário do serviço (de `servicoContrato`), para ordenar e filtrar. */
export function quando(orcamento: Orcamento | undefined): { data: string; horario: string } {
  return {
    data: orcamento?.servicoContrato?.dataServico ?? "",
    horario: orcamento?.servicoContrato?.horarioInicio ?? "",
  };
}

/** Com data primeiro (mais próxima antes, depois por horário); sem data por último, mais novo antes. */
export function compararPorData(
  a: { data: string; horario: string; criadoEm: string },
  b: { data: string; horario: string; criadoEm: string }
): number {
  if (a.data && b.data) return (a.data + a.horario).localeCompare(b.data + b.horario);
  if (a.data) return -1;
  if (b.data) return 1;
  return b.criadoEm.localeCompare(a.criadoEm);
}
