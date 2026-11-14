import { describe, expect, test } from "vitest";
import { defaultEmpresa, mergeEmpresa, normalizarEntradasAvulsas, normalizarSaidas } from "./estado";
import {
  categoriasSugeridas,
  entradas,
  resultadoDoOrcamento,
  resumoMes,
  rotuloMes,
  saidasPorCategoria,
  serieMensal,
  ultimosMeses,
} from "./financeiro";
import type { Empresa, Orcamento, Pagamento, Saida } from "./tipos";

const pag = (id: string, data: string, valor: number, tipo: Pagamento["tipo"] = "sinal"): Pagamento => ({ id, tipo, valor, data, forma: "Pix" });

function orc(id: string, pagamentos: Pagamento[], moeda: Orcamento["moeda"] = "BRL"): Orcamento {
  return {
    id, numero: 1, criadoEm: "2026-10-01", clienteId: "c1", data: "2026-10-01", validadeDias: 7, moeda,
    itens: [], desconto: 0, descontoTipo: "valor", acrescimo: 0, condicoes: "", observacoes: "", status: "aprovado", pagamentos,
  };
}

const saida = (id: string, data: string, valor: number, categoria = "Equipamento", orcamentoId?: string): Saida => ({
  id, data, descricao: id, categoria, valor, ...(orcamentoId ? { orcamentoId } : {}),
});

function empresa(): Empresa {
  return {
    ...defaultEmpresa("e1"),
    orcamentos: [
      orc("o1", [pag("p1", "2026-11-02", 400.1), pag("p2", "2026-11-20", 599.9, "restante")]),
      orc("o2", [pag("p3", "2026-10-15", 1000, "integral")]),
      orc("o3", [pag("p4", "2026-11-05", 300)], "USD"),
    ],
    saidas: [
      saida("tripe", "2026-11-03", 1500),
      saida("uber", "2026-11-04", 80.2, "Deslocamento", "o1"),
      saida("adobe", "2026-10-10", 120, "Software e assinaturas"),
      saida("cartao", "2026-11-09", 49.8, "  "),
    ],
  };
}

describe("financeiro", () => {
  test("entradas vêm dos pagamentos dos orçamentos, mais recentes primeiro", () => {
    expect(entradas(empresa()).map((e) => e.id)).toEqual(["p2", "p4", "p1", "p3"]);
  });

  test("resumo do mês: só a moeda da empresa entra no total, em centavos", () => {
    expect(resumoMes(empresa(), "2026-11")).toEqual({ recebido: 1000, recebidoAvulso: 0, saidas: 1630, saldo: -630, entradasOutraMoeda: 1 });
    expect(resumoMes(empresa(), "2026-10")).toEqual({ recebido: 1000, recebidoAvulso: 0, saidas: 120, saldo: 880, entradasOutraMoeda: 0 });
    expect(resumoMes(empresa(), "2026-09").saldo).toBe(0);
  });

  test("últimos meses atravessam a virada do ano", () => {
    expect(ultimosMeses("2026-02-10", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(rotuloMes("2025-12")).toBe("dez/25");
  });

  test("série mensal para o gráfico", () => {
    const serie = serieMensal(empresa(), "2026-11-10", 2);
    expect(serie).toEqual([
      { mes: "2026-10", label: "out/26", entradas: 1000, saidas: 120, saldo: 880 },
      { mes: "2026-11", label: "nov/26", entradas: 1000, saidas: 1630, saldo: -630 },
    ]);
  });

  test("saídas por categoria, maior primeiro; categoria vazia vira 'Sem categoria'", () => {
    expect(saidasPorCategoria(empresa().saidas, "2026-11")).toEqual([
      { categoria: "Equipamento", valor: 1500 },
      { categoria: "Deslocamento", valor: 80.2 },
      { categoria: "Sem categoria", valor: 49.8 },
    ]);
  });

  test("resultado de um trabalho: recebido − saídas ligadas", () => {
    const e = empresa();
    expect(resultadoDoOrcamento(e, e.orcamentos[0])).toEqual({
      recebido: 1000, custos: 80.2, resultado: 919.8, quantidadeSaidas: 1, moedaDiferente: false,
    });
    expect(resultadoDoOrcamento(e, e.orcamentos[2]).moedaDiferente).toBe(true);
  });

  test("categorias sugeridas: padrão + usadas, sem repetir (ignora caixa)", () => {
    const c = categoriasSugeridas([saida("a", "2026-11-01", 1, "equipamento"), saida("b", "2026-11-01", 1, "Aluguel de estúdio")]);
    expect(c.filter((x) => x.toLowerCase() === "equipamento")).toHaveLength(1);
    expect(c.at(-1)).toBe("Aluguel de estúdio");
  });
});

describe("normalizarSaidas (backup e servidor)", () => {
  test("descarta data inválida e id repetido; valor negativo vira 0; opcionais vazios somem", () => {
    const r = normalizarSaidas([
      { id: "a", data: "2026-11-03", descricao: "Tripé", categoria: "Equipamento", valor: 1500, forma: "Pix", orcamentoId: "" },
      { id: "a", data: "2026-11-04", descricao: "repetida", categoria: "", valor: 1 },
      { id: "b", data: "03/11/2026", descricao: "data errada", categoria: "", valor: 1 },
      { id: "c", data: "2026-11-05", descricao: "negativa", categoria: "", valor: -10 },
      null,
      "lixo",
    ]);
    expect(r).toEqual([
      { id: "a", data: "2026-11-03", descricao: "Tripé", categoria: "Equipamento", valor: 1500, forma: "Pix" },
      { id: "c", data: "2026-11-05", descricao: "negativa", categoria: "", valor: 0 },
    ]);
    expect(normalizarSaidas(undefined)).toEqual([]);
  });
});

describe("entradas avulsas", () => {
  const comAvulsas = (): Empresa => ({
    ...empresa(),
    entradasAvulsas: [
      { id: "notebook", data: "2026-11-15", descricao: "Venda do notebook", categoria: "Venda de equipamento", valor: 2500.5, forma: "Pix" },
      { id: "reembolso", data: "2026-10-20", descricao: "Reembolso", categoria: "", valor: 30 },
    ],
  });

  test("entram na lista junto com os pagamentos, na moeda da empresa", () => {
    const lista = entradas(comAvulsas());
    expect(lista.map((e) => e.id)).toEqual(["p2", "notebook", "p4", "p1", "reembolso", "p3"]);
    const nb = lista.find((e) => e.id === "notebook");
    expect(nb?.origem).toBe("avulsa");
    expect(nb?.moeda).toBe("BRL");
  });

  test("somam no recebido e no saldo do mês, com a parte avulsa separada", () => {
    expect(resumoMes(comAvulsas(), "2026-11")).toEqual({
      recebido: 3500.5, recebidoAvulso: 2500.5, saidas: 1630, saldo: 1870.5, entradasOutraMoeda: 1,
    });
    expect(serieMensal(comAvulsas(), "2026-11-10", 2).map((p) => p.entradas)).toEqual([1030, 3500.5]);
  });

  test("não mexem no resultado de um trabalho", () => {
    const e = comAvulsas();
    expect(resultadoDoOrcamento(e, e.orcamentos[0]).recebido).toBe(1000);
  });

  test("normalização: mesmas regras das saídas, sem vínculo com orçamento", () => {
    expect(
      normalizarEntradasAvulsas([
        { id: "a", data: "2026-11-15", descricao: "Notebook", categoria: "Venda", valor: 100, orcamentoId: "o1" },
        { id: "b", data: "ontem", descricao: "x", categoria: "", valor: 1 },
        { id: "c", data: "2026-11-16", descricao: "neg", categoria: "", valor: -5 },
      ])
    ).toEqual([
      { id: "a", data: "2026-11-15", descricao: "Notebook", categoria: "Venda", valor: 100 },
      { id: "c", data: "2026-11-16", descricao: "neg", categoria: "", valor: 0 },
    ]);
    // Conta antiga, gravada antes do campo existir, abre com a lista vazia.
    expect(mergeEmpresa({ id: "antiga" }).entradasAvulsas).toEqual([]);
  });
});
