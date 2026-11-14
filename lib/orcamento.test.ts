import { describe, expect, test } from "vitest";
import { calcOrcamentoTotais, formatDateBR } from "./helpers";
import { camposDaCopia, gerarOrcamentoHtml, gerarTextoWhatsapp } from "./orcamento";
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
  saidas: [],
  entradasAvulsas: [],
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

  test("blocos separados por uma linha em branco", () => {
    const texto = gerarTextoWhatsapp(orcamento(), cliente, "ORC-0001", empresa);
    expect(texto.split("\n\n")).toHaveLength(4);
    expect(texto).toMatch(/Cliente: Ana Souza\n\n• Ensaio/);
    expect(texto).not.toMatch(/\n\n\n/);
    // Sem condições nem cliente: nada de linha em branco sobrando.
    const curto = gerarTextoWhatsapp(orcamento({ condicoes: "" }), undefined, "ORC-0001", empresa);
    expect(curto.split("\n\n")).toHaveLength(3);
    expect(curto.endsWith("Válido até 16/11/2026")).toBe(true);
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

describe("cliente por telefone", async () => {
  const { acharClientePorTelefone, telefoneComparavel } = await import("./orcamento");
  test("mesmo número escrito de jeitos diferentes", () => {
    expect(telefoneComparavel("+55 (86) 98888-7777")).toBe("86988887777");
    expect(acharClientePorTelefone([cliente], "(86) 98888-7777")?.id).toBe("c1");
    expect(acharClientePorTelefone([cliente], "5586988887777")?.id).toBe("c1");
    expect(acharClientePorTelefone([cliente], "86 97777-0000")).toBeUndefined();
    expect(acharClientePorTelefone([{ ...cliente, telefone: "" }], "")).toBeUndefined();
  });
});

describe("clientes parecidos (cadastro repetido)", async () => {
  const { clientesParecidos, nomeComparavel } = await import("./orcamento");
  const base: Cliente = { id: "c1", nome: "Ana Souza", documento: "", telefone: "(86) 98888-7777", email: "", endereco: "", observacoes: "" };

  test("mesmo nome (sem acento/caixa) ou mesmo WhatsApp; nunca o próprio", () => {
    const clientes: Cliente[] = [
      base,
      { ...base, id: "c2", nome: "  ana   souza ", telefone: "" },
      { ...base, id: "c3", nome: "Ana Paula", telefone: "5586988887777" },
      { ...base, id: "c4", nome: "Ânia Souza", telefone: "(86) 91111-2222" },
      { ...base, id: "c5", nome: "Bruno", telefone: "" },
    ];
    expect(clientesParecidos(clientes, base).map((c) => c.id)).toEqual(["c2", "c3"]);
    expect(nomeComparavel("Ânia  Souza")).toBe("ania souza");
  });

  test("telefone curto demais não conta como igual", () => {
    const clientes: Cliente[] = [{ ...base, telefone: "123" }, { ...base, id: "c2", nome: "Outro", telefone: "123" }];
    expect(clientesParecidos(clientes, clientes[0])).toEqual([]);
  });
});

describe("data no documento impresso", () => {
  test("formatDateBR só aceita AAAA-MM-DD", () => {
    expect(formatDateBR("2026-11-01")).toBe("01/11/2026");
    expect(formatDateBR("")).toBe("-");
    expect(formatDateBR(undefined)).toBe("-");
    expect(formatDateBR('<img src=x onerror="alert(1)">')).toBe("-");
  });

  test("data adulterada num backup não vira HTML no PDF", () => {
    const html = gerarOrcamentoHtml(orcamento({ data: "<img src=x onerror=alert(1)>" }), cliente, "Nº 0001", empresa);
    expect(html).not.toContain("<img src=x");
  });
});

describe("camposDaCopia (duplicar)", () => {
  let n = 0;
  const novoId = () => `novo-${++n}`;

  test("não leva o que identifica o original", () => {
    const original = orcamento({
      status: "aprovado",
      codigoRef: "EJ-ABCDE",
      refEj: "[ref EJ-ABCDE v3]",
      pagamentos: [{ id: "p1", tipo: "sinal", valor: 80, data: "2026-11-02", forma: "Pix" }],
    });
    const copia = camposDaCopia(original, novoId, "2026-11-12");
    expect(copia).not.toHaveProperty("id");
    expect(copia).not.toHaveProperty("numero");
    expect(copia).not.toHaveProperty("criadoEm");
    expect(copia).not.toHaveProperty("pagamentos");
    expect(copia).not.toHaveProperty("codigoRef");
    expect(copia).not.toHaveProperty("refEj");
    expect(copia.status).toBe("rascunho");
    expect(copia.data).toBe("2026-11-12");
    expect(copia.itens?.map((i) => i.descricao)).toEqual(["Ensaio", "Foto extra"]);
    expect(copia.itens?.some((i) => i.id === "i1" || i.id === "i2")).toBe(false);
  });

  test("parceria vem sem o que o parceiro já cumpriu", () => {
    const original = orcamento({
      parceria: {
        contrapartidas: [
          { id: "c1", tipo: "divulgacao", descricao: "Post", quantidade: 2, prazo: "", valorEstimado: 0, registros: [{ id: "r1", data: "2026-11-05", detalhe: "link" }] },
        ],
      },
    });
    const copia = camposDaCopia(original, novoId, "2026-11-12");
    expect(copia.parceria?.contrapartidas[0].descricao).toBe("Post");
    expect(copia.parceria?.contrapartidas[0].registros).toEqual([]);
    expect(original.parceria?.contrapartidas[0].registros).toHaveLength(1);
  });
});
