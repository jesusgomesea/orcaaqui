import { describe, expect, test } from "vitest";
import { atrasada, linhasContrapartidas, normalizarParceria, progresso, resumoParceria, textoParceria } from "./parceria";
import type { Contrapartida, Orcamento } from "./tipos";

const c = (patch: Partial<Contrapartida>): Contrapartida => ({
  id: "c",
  tipo: "divulgacao",
  descricao: "Post no feed marcando @eluan.jesus",
  quantidade: 2,
  prazo: "",
  valorEstimado: 0,
  registros: [],
  ...patch,
});

const orc = (patch: Partial<Orcamento> = {}) =>
  ({
    itens: [{ id: "i", descricao: "Cobertura do evento (100 fotos)", quantidade: 1, valorUnitario: 600 }],
    desconto: 400,
    descontoTipo: "valor",
    acrescimo: 0,
    parceria: {
      contrapartidas: [
        c({ id: "a", registros: [{ id: "r", data: "2026-11-10", detalhe: "https://instagram.com/p/1" }] }),
        c({ id: "b", tipo: "permuta", descricao: "Uso do salão para ensaio", quantidade: 1, valorEstimado: 300 }),
        c({ id: "d", tipo: "indicacao", descricao: "Indicar clientes", quantidade: 3, prazo: "2026-12-31" }),
      ],
    },
    ...patch,
  }) as Orcamento;

describe("parceria", () => {
  test("progresso e cumprida", () => {
    expect(progresso(c({}))).toEqual({ feitas: 0, total: 2, cumprida: false });
    const duas = c({ registros: [{ id: "1", data: "", detalhe: "" }, { id: "2", data: "", detalhe: "" }] });
    expect(progresso(duas)).toEqual({ feitas: 2, total: 2, cumprida: true });
    expect(progresso(c({ quantidade: 0 })).total).toBe(1);
  });

  test("atrasada só se pendente e com prazo vencido", () => {
    expect(atrasada(c({ prazo: "2026-11-01" }), "2026-11-09")).toBe(true);
    expect(atrasada(c({ prazo: "2026-11-30" }), "2026-11-09")).toBe(false);
    expect(atrasada(c({ prazo: "" }), "2026-11-09")).toBe(false);
  });

  test("resumo: valor cheio, desconto, dinheiro, permuta e pendências", () => {
    expect(resumoParceria(orc())).toEqual({
      valorCheio: 600,
      desconto: 400,
      emDinheiro: 200,
      emPermuta: 300,
      contrapartidas: 3,
      cumpridas: 0,
      pendentes: 3,
    });
    expect(resumoParceria(orc({ desconto: 600 })).emDinheiro).toBe(0);
  });

  test("texto para o WhatsApp", () => {
    const t = textoParceria(orc(), "BRL");
    expect(t).toContain("*Parceria*");
    expect(t).toContain("• 2× Post no feed marcando @eluan.jesus");
    expect(t).toMatch(/• Uso do salão para ensaio \(valor estimado R\$\s300,00\)/);
    expect(t).toContain("• 3× Indicar clientes — até 31/12/2026");
    expect(t).toMatch(/desconto de parceria R\$\s400,00/);
    expect(t).toMatch(/Em dinheiro: R\$\s200,00/);
    expect(textoParceria(orc({ desconto: 600 }), "BRL")).toContain("Sem pagamento em dinheiro.");
    expect(textoParceria(orc({ parceria: undefined }), "BRL")).toBe("");
  });

  test("PDF e WhatsApp do orçamento livre levam a parceria (escapada)", async () => {
    const { gerarOrcamentoHtml, gerarTextoWhatsapp } = await import("./orcamento");
    const { configPadrao } = await import("./estado");
    const empresa = { id: "e", nome: "Studio", documento: "", telefone: "", email: "", site: "", endereco: "", logoDataUrl: "", corPrimaria: "#2563eb", moeda: "BRL" as const, dadosBancarios: "", condicoesPadrao: "", clientes: [], orcamentos: [], servicos: [], config: configPadrao("e"), agendamentos: [], proximoNumero: 1 };
    const o = { ...orc(), id: "o", numero: 1, criadoEm: "2026-11-01", clienteId: "", data: "2026-11-01", validadeDias: 15, moeda: "BRL" as const, condicoes: "", observacoes: "", status: "enviado" as const };
    o.parceria!.contrapartidas[0].descricao = "Post <b>no feed</b> [x]";
    const html = gerarOrcamentoHtml(o, undefined, "ORC-0001", empresa);
    expect(html).toContain("Proposta de parceria");
    expect(html).toContain("Post &lt;b&gt;no feed&lt;/b&gt; x");
    expect(html).toMatch(/Em dinheiro: R\$\s200,00/);
    const zap = gerarTextoWhatsapp(o, undefined, "ORC-0001", empresa);
    expect(zap).toContain("*Proposta de parceria ORC-0001*");
    expect(zap).toContain("*Parceria*");
  });

  test("linhas ignoram contrapartida sem descrição", () => {
    expect(linhasContrapartidas({ contrapartidas: [c({ descricao: "  " })] }, "BRL")).toEqual([]);
  });

  test("normalizar: lixo some, campos ganham padrão", () => {
    expect(normalizarParceria(undefined)).toBeUndefined();
    expect(normalizarParceria({ contrapartidas: "x" })).toBeUndefined();
    const n = normalizarParceria({ contrapartidas: [{ tipo: "estranho", descricao: "X", quantidade: -2, registros: [{ detalhe: "a" }, 5] }, 3] })!;
    expect(n.contrapartidas).toHaveLength(1);
    expect(n.contrapartidas[0]).toMatchObject({ tipo: "outra", descricao: "X", quantidade: 1, prazo: "", valorEstimado: 0 });
    expect(n.contrapartidas[0].registros).toHaveLength(1);
  });
});
