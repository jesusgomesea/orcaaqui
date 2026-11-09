import { describe, expect, test } from "vitest";
import { calcOrcamentoTotais } from "./helpers";
import { gerarOrcamentoHtml, gerarTextoWhatsapp } from "./orcamento";
import { configPadrao } from "./estado";
import type { Cliente, Empresa, Orcamento } from "./tipos";

const empresa = {
  id: "e1",
  nome: "Studio Teste",
  documento: "",
  telefone: "(86) 99999-0000",
  email: "",
  site: "",
  endereco: "",
  logoDataUrl: "",
  corPrimaria: "#2563eb",
  moeda: "BRL",
  dadosBancarios: "Pix: chave@example.com",
  condicoesPadrao: "",
  clientes: [],
  orcamentos: [],
  servicos: [],
  config: configPadrao("e1"),
  agendamentos: [],
  proximoNumero: 2,
} satisfies Empresa;

const cliente: Cliente = {
  id: "c1",
  nome: "Ana Souza",
  documento: "",
  telefone: "86988887777",
  email: "",
  endereco: "",
  observacoes: "",
};

function orcamento(patch: Partial<Orcamento> = {}): Orcamento {
  return {
    id: "o1",
    numero: 1,
    criadoEm: "2026-11-01",
    clienteId: "c1",
    data: "2026-11-01",
    validadeDias: 15,
    moeda: "BRL",
    itens: [
      { id: "i1", descricao: "Ensaio", quantidade: 1, valorUnitario: 150 },
      { id: "i2", descricao: "Foto extra", quantidade: 5, valorUnitario: 10 },
    ],
    desconto: 0,
    descontoTipo: "valor",
    acrescimo: 0,
    condicoes: "Sinal de 40% na confirmação.",
    observacoes: "",
    status: "rascunho",
    ...patch,
  };
}

describe("calcOrcamentoTotais", () => {
  test("soma itens", () => {
    expect(calcOrcamentoTotais(orcamento().itens, 0, "valor", 0)).toEqual({
      subtotal: 200,
      descontoValor: 0,
      acrescimoValor: 0,
      total: 200,
    });
  });

  test("desconto em valor e acréscimo", () => {
    expect(calcOrcamentoTotais(orcamento().itens, 30, "valor", 10).total).toBe(180);
  });

  test("desconto percentual", () => {
    const r = calcOrcamentoTotais(orcamento().itens, 10, "percentual", 0);
    expect(r.descontoValor).toBe(20);
    expect(r.total).toBe(180);
  });

  test("total nunca fica negativo", () => {
    expect(calcOrcamentoTotais(orcamento().itens, 500, "valor", 0).total).toBe(0);
  });

  test("itens ausentes ou com texto no lugar de número", () => {
    expect(calcOrcamentoTotais(undefined, 0, "valor", 0).total).toBe(0);
    const itens = [{ id: "x", descricao: "a", quantidade: "2" as unknown as number, valorUnitario: 7.5 }];
    expect(calcOrcamentoTotais(itens, 0, "valor", 0).total).toBe(15);
  });
});

describe("gerarTextoWhatsapp", () => {
  test("traz número, cliente, itens, total, validade e condições", () => {
    const texto = gerarTextoWhatsapp(orcamento(), cliente, "ORC-0001", empresa);
    expect(texto).toContain("*Orçamento ORC-0001* — Studio Teste");
    expect(texto).toContain("Cliente: Ana Souza");
    expect(texto).toMatch(/• Ensaio \(1x R\$\s150,00\)/);
    expect(texto).toMatch(/• Foto extra \(5x R\$\s10,00\)/);
    expect(texto).toMatch(/\*Total: R\$\s200,00\*/);
    expect(texto).toContain("Válido até 16/11/2026");
    expect(texto).toContain("Sinal de 40% na confirmação.");
  });

  test("usa a moeda do orçamento", () => {
    const texto = gerarTextoWhatsapp(orcamento({ moeda: "USD" }), cliente, "ORC-0001", empresa);
    expect(texto).toMatch(/US\$\s200,00/);
  });

  test("ignora itens sem descrição", () => {
    const o = orcamento({ itens: [...orcamento().itens, { id: "i3", descricao: "  ", quantidade: 1, valorUnitario: 99 }] });
    expect(gerarTextoWhatsapp(o, cliente, "ORC-0001", empresa)).not.toMatch(/1x R\$\s99,00/);
  });
});

describe("gerarOrcamentoHtml", () => {
  test("escapa HTML vindo dos dados", () => {
    const html = gerarOrcamentoHtml(
      orcamento({ itens: [{ id: "i1", descricao: "Instalação <2m", quantidade: 1, valorUnitario: 10 }] }),
      { ...cliente, nome: '<img src=x onerror="alert(1)">' },
      "ORC-0001",
      empresa
    );
    expect(html).toContain("Instalação &lt;2m");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x");
  });

  test("só aceita logo que seja imagem em data: URL", () => {
    const comLogoRuim = gerarOrcamentoHtml(orcamento(), cliente, "ORC-0001", { ...empresa, logoDataUrl: "javascript:alert(1)" });
    expect(comLogoRuim).not.toContain("javascript:");
    const comLogo = gerarOrcamentoHtml(orcamento(), cliente, "ORC-0001", { ...empresa, logoDataUrl: "data:image/png;base64,AAAA" });
    expect(comLogo).toContain('src="data:image/png;base64,AAAA"');
  });

  test("mostra desconto, total e validade", () => {
    const html = gerarOrcamentoHtml(orcamento({ desconto: 20 }), cliente, "ORC-0001", empresa);
    expect(html).toMatch(/-R\$\s20,00/);
    expect(html).toMatch(/R\$\s180,00/);
    expect(html).toContain("Válido até 16/11/2026");
  });
});
