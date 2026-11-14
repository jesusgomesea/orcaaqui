// Entradas e saídas da empresa. Puro, coberto por lib/financeiro.test.ts.
//
// - Entradas são os pagamentos de `Orcamento.pagamentos` (os mesmos da Agenda e
//   dos recibos, nada é duplicado) mais as entradas avulsas de `Empresa.entradasAvulsas`
//   (venda de um equipamento usado, aluguel, reembolso — dinheiro que não veio de orçamento).
// - Saídas moram em `Empresa.saidas`, na moeda da empresa.
// - Totais só somam o que está na moeda da empresa (como o "a receber" da
//   Agenda): misturar R$ com US$ daria um número sem sentido. Contas em centavos.

import { paraCentavos } from "./documentos/formatos";
import type { CodigoMoeda, Empresa, EntradaAvulsa, Orcamento, Saida, TipoPagamento } from "./tipos";

/** Sugestões do campo categoria (o campo aceita qualquer texto). */
export const CATEGORIAS_SAIDA = [
  "Equipamento",
  "Deslocamento",
  "Software e assinaturas",
  "Marketing",
  "Impressão e produtos",
  "Manutenção",
  "Impostos e taxas",
  "Outros",
];

/** Sugestões de categoria para entrada avulsa. */
export const CATEGORIAS_ENTRADA = [
  "Venda de equipamento",
  "Aluguel de equipamento",
  "Reembolso",
  "Aporte",
  "Outros",
];

export const SEM_CATEGORIA = "Sem categoria";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

interface EntradaBase {
  /** Id do pagamento ou da entrada avulsa. */
  id: string;
  /** YYYY-MM-DD */
  data: string;
  valor: number;
  moeda: CodigoMoeda;
  forma: string;
  descricao?: string;
}

/** Pagamento de um orçamento, ou entrada avulsa (sempre na moeda da empresa). */
export type Entrada =
  | (EntradaBase & { origem: "pagamento"; tipo: TipoPagamento; orcamento: Orcamento })
  | (EntradaBase & { origem: "avulsa"; categoria: string; avulsa: EntradaAvulsa });

const somar = (valores: number[]) => valores.reduce((s, v) => s + paraCentavos(v), 0) / 100;
const doMes = (data: string, mes: string) => (data || "").slice(0, 7) === mes;

/** Pagamentos de todos os orçamentos e entradas avulsas, do mais recente ao mais antigo. */
export function entradas(empresa: Empresa): Entrada[] {
  const pagamentos: Entrada[] = empresa.orcamentos.flatMap((o) =>
    (o.pagamentos ?? []).map((p) => ({
      origem: "pagamento" as const,
      id: p.id,
      data: p.data,
      valor: Number(p.valor) || 0,
      moeda: o.moeda || empresa.moeda,
      tipo: p.tipo,
      forma: p.forma,
      descricao: p.descricao,
      orcamento: o,
    }))
  );
  const avulsas: Entrada[] = (empresa.entradasAvulsas ?? []).map((a) => ({
    origem: "avulsa" as const,
    id: a.id,
    data: a.data,
    valor: Number(a.valor) || 0,
    moeda: empresa.moeda,
    forma: a.forma ?? "",
    descricao: a.descricao,
    categoria: a.categoria,
    avulsa: a,
  }));
  return [...pagamentos, ...avulsas].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
}

/** Saídas do mais recente ao mais antigo. */
export function saidasOrdenadas(saidas: Saida[]): Saida[] {
  return [...saidas].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
}

export interface ResumoMes {
  /** Pagamentos e entradas avulsas do mês, na moeda da empresa. */
  recebido: number;
  /** Parte de `recebido` que veio de entradas avulsas. */
  recebidoAvulso: number;
  saidas: number;
  /** recebido − saídas (pode ser negativo). */
  saldo: number;
  /** Pagamentos do mês em outra moeda, que ficaram fora do total. */
  entradasOutraMoeda: number;
}

/** `mes` = "AAAA-MM". */
export function resumoMes(empresa: Empresa, mes: string): ResumoMes {
  const doPeriodo = entradas(empresa).filter((e) => doMes(e.data, mes));
  const naMoeda = doPeriodo.filter((e) => e.moeda === empresa.moeda);
  const recebido = somar(naMoeda.map((e) => e.valor));
  const recebidoAvulso = somar(naMoeda.filter((e) => e.origem === "avulsa").map((e) => e.valor));
  const saidas = somar(empresa.saidas.filter((s) => doMes(s.data, mes)).map((s) => s.valor));
  return {
    recebido,
    recebidoAvulso,
    saidas,
    saldo: (paraCentavos(recebido) - paraCentavos(saidas)) / 100,
    entradasOutraMoeda: doPeriodo.length - naMoeda.length,
  };
}

/** "AAAA-MM" de `meses` meses até o de `hoje` (inclusive), do mais antigo ao atual. */
export function ultimosMeses(hoje: string, meses = 6): string[] {
  const ano = Number(hoje.slice(0, 4));
  const mes = Number(hoje.slice(5, 7)) - 1;
  const lista: string[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const total = ano * 12 + mes - i;
    lista.push(`${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`);
  }
  return lista;
}

/** "2026-11" → "nov/26" */
export function rotuloMes(mes: string): string {
  return `${MESES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`;
}

export interface PontoMensal {
  mes: string;
  label: string;
  entradas: number;
  saidas: number;
  saldo: number;
}

/** Entradas x saídas dos últimos meses, para o gráfico do Painel. */
export function serieMensal(empresa: Empresa, hoje: string, meses = 6): PontoMensal[] {
  return ultimosMeses(hoje, meses).map((mes) => {
    const r = resumoMes(empresa, mes);
    return { mes, label: rotuloMes(mes), entradas: r.recebido, saidas: r.saidas, saldo: r.saldo };
  });
}

/** Saídas do mês somadas por categoria, da maior para a menor. */
export function saidasPorCategoria(saidas: Saida[], mes: string): { categoria: string; valor: number }[] {
  const mapa = new Map<string, number>();
  for (const s of saidas) {
    if (!doMes(s.data, mes)) continue;
    const c = s.categoria.trim() || SEM_CATEGORIA;
    mapa.set(c, (mapa.get(c) ?? 0) + paraCentavos(s.valor));
  }
  return [...mapa.entries()]
    .map(([categoria, centavos]) => ({ categoria, valor: centavos / 100 }))
    .sort((a, b) => b.valor - a.valor || a.categoria.localeCompare(b.categoria));
}

export interface ResultadoTrabalho {
  /** Pagamentos recebidos neste orçamento. */
  recebido: number;
  /** Saídas ligadas a este orçamento. */
  custos: number;
  /** recebido − custos. */
  resultado: number;
  quantidadeSaidas: number;
  /** Orçamento em moeda diferente da empresa: recebido e custos não são comparáveis. */
  moedaDiferente: boolean;
}

/** Quanto entrou e quanto saiu num trabalho (saídas ligadas pelo `orcamentoId`). */
export function resultadoDoOrcamento(empresa: Empresa, orcamento: Orcamento): ResultadoTrabalho {
  const ligadas = empresa.saidas.filter((s) => s.orcamentoId === orcamento.id);
  const recebido = somar((orcamento.pagamentos ?? []).map((p) => Number(p.valor) || 0));
  const custos = somar(ligadas.map((s) => s.valor));
  return {
    recebido,
    custos,
    resultado: (paraCentavos(recebido) - paraCentavos(custos)) / 100,
    quantidadeSaidas: ligadas.length,
    moedaDiferente: (orcamento.moeda || empresa.moeda) !== empresa.moeda,
  };
}

/** Categorias já usadas na empresa, para sugerir junto das padrão (sem repetir). */
export function categoriasSugeridas(lancamentos: { categoria: string }[], padrao: string[] = CATEGORIAS_SAIDA): string[] {
  const usadas = lancamentos.map((s) => s.categoria.trim()).filter(Boolean);
  const todas = [...padrao, ...usadas];
  const vistos = new Set<string>();
  return todas.filter((c) => {
    const chave = c.toLowerCase();
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}
