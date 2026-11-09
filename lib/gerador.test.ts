import { describe, expect, test } from "vitest";
import { configPadrao } from "./estado";
import {
  calcularGerador,
  codificarRefOrc,
  decodificarRefOrc,
  gerarMensagemOrcamento,
  itensDoCalculo,
  linkWhatsApp,
  precoUnitario,
  recalcularRefOrc,
  refDaSelecao,
  selecaoDoOrcamento,
  type SelecaoGerador,
} from "./gerador";
import { calcOrcamentoTotais } from "./helpers";
import type { Orcamento, Servico } from "./tipos";

const servicos: Servico[] = [
  { id: "s-ensaio", codigo: "ENS", categoria: "Foto", nome: "Ensaio externo", descricao: "", valor: 150, prazo: "Em até 7 dias" },
  { id: "s-foto", codigo: "FTX", categoria: "Foto", nome: "Foto extra", descricao: "", valor: 12, precoVolume: 9, volumeMin: 10, unidade: "foto" },
  { id: "s-hora", codigo: "HRS", categoria: "Foto", nome: "Hora de cobertura", descricao: "", valor: 120, prazo: "Em até 15 dias", unidade: "hora" },
];

const config = {
  ...configPadrao("emp"),
  codigo: "EMPR5",
  versaoCatalogo: 3,
  deslocamentos: [
    { id: "ate10", nome: "Até 10 km", valor: 0 },
    { id: "10a20", nome: "10 a 20 km", valor: 25 },
  ],
};
const empresa = { servicos, config };

const sel = (patch: Partial<SelecaoGerador> = {}): SelecaoGerador => ({
  itens: [
    { servicoId: "s-ensaio", quantidade: 1 },
    { servicoId: "s-foto", quantidade: 12 },
  ],
  desconto: 0,
  acrescimo: 0,
  deslocamentoId: "10a20",
  ...patch,
});

describe("preço e totais", () => {
  test("preço por volume vale para todas as unidades a partir do mínimo", () => {
    const foto = servicos[1];
    expect(precoUnitario(foto, 9)).toEqual({ unitario: 12, volume: false });
    expect(precoUnitario(foto, 10)).toEqual({ unitario: 9, volume: true });
    expect(precoUnitario(servicos[0], 50)).toEqual({ unitario: 150, volume: false });
  });

  test("total, sinal e restante", () => {
    // 150 + 12×9 = 258, + deslocamento 25 = 283
    const c = calcularGerador(sel(), servicos, config, 40);
    expect(c.subtotal).toBe(283);
    expect(c.total).toBe(283);
    expect(c.sinal).toBe(114); // ceil(113,2)
    expect(c.restante).toBe(169);
    expect(c.prazos).toEqual(["Em até 7 dias"]);
    expect(c.pendencias).toEqual([]);
    expect(c.linhas.map((l) => [l.descricao, l.quantidade, l.unitario, l.valor])).toEqual([
      ["Ensaio externo", 1, 150, 150],
      ["Foto extra", 12, 9, 108],
      ["Deslocamento (10 a 20 km)", 1, 25, 25],
    ]);
  });

  test("desconto e acréscimo; total nunca negativo", () => {
    expect(calcularGerador(sel({ desconto: 33, acrescimo: 10 }), servicos, config, 40).total).toBe(260);
    expect(calcularGerador(sel({ desconto: 1000 }), servicos, config, 40).total).toBe(0);
  });

  test("sinal configurável", () => {
    const c = calcularGerador(sel(), servicos, config, 30);
    expect(c.sinal).toBe(85); // ceil(84,9)
    expect(c.sinal + c.restante).toBe(c.total);
  });

  test("pendências: nenhum serviço, serviço ou faixa que sumiu", () => {
    expect(calcularGerador(sel({ itens: [] }), servicos, config, 40).pendencias).toContain("Escolha ao menos um serviço.");
    const c = calcularGerador(sel({ itens: [{ servicoId: "x", quantidade: 1 }], deslocamentoId: "longe" }), servicos, config, 40);
    expect(c.pendencias).toHaveLength(3);
  });

  test("itens do orçamento batem com o total e reabrem no montador", () => {
    const c = calcularGerador(sel({ desconto: 8, acrescimo: 3 }), servicos, config, 40);
    let n = 0;
    const itens = itensDoCalculo(c, () => `i${++n}`);
    expect(itens[2]).toMatchObject({ deslocamentoId: "10a20", tipo: "adicional", valorUnitario: 25 });
    expect(calcOrcamentoTotais(itens, 8, "valor", 3).total).toBe(c.total);

    const o = { itens, desconto: 8, descontoTipo: "valor", acrescimo: 3 } as Orcamento;
    expect(selecaoDoOrcamento(o)).toEqual(sel({ desconto: 8, acrescimo: 3 }));
    // Item livre (fora do catálogo) não reabre no montador.
    expect(selecaoDoOrcamento({ ...o, itens: [...itens, { id: "x", descricao: "Livre", quantidade: 1, valorUnitario: 5 }] })).toBeNull();
  });
});

describe("[ref ORC-…] vai e volta", () => {
  const dados = { codigo: "ORC-0012", data: "2026-12-20", horario: "16:00" };

  test("formato da linha", () => {
    const ref = refDaSelecao(sel({ desconto: 10.5 }), dados, empresa);
    expect(codificarRefOrc(ref)).toBe("[ref ORC-0012 e=EMPR5 v3 i=ENS:1,FTX:12 d=10.5 ds=10a20 dt=2026-12-20 hr=16:00]");
  });

  test("decodificar(codificar(x)) = x, mesmo no meio da mensagem", () => {
    const ref = refDaSelecao(sel({ desconto: 10.5, acrescimo: 4 }), dados, empresa);
    const texto = `Oi!\n*Total:* R$ 1,00\n${codificarRefOrc(ref)}\n_(não apague)_`;
    expect(decodificarRefOrc(texto)).toEqual(ref);
  });

  test("sem data, desconto ou deslocamento, os campos somem da linha", () => {
    const ref = refDaSelecao(sel({ deslocamentoId: "" }), { codigo: "ORC-0001", data: "", horario: "" }, empresa);
    const linha = codificarRefOrc(ref);
    expect(linha).toBe("[ref ORC-0001 e=EMPR5 v3 i=ENS:1,FTX:12]");
    expect(decodificarRefOrc(linha)).toEqual(ref);
  });

  test("recalcular a ref dá o mesmo total do montador", () => {
    const s = sel({ desconto: 10.5, acrescimo: 4 });
    const r = recalcularRefOrc(refDaSelecao(s, dados, empresa), empresa, 40);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.calculo.total).toBe(calcularGerador(s, servicos, config, 40).total);
    expect(r.selecao).toEqual(s);
    expect(r.avisos).toEqual([]);
  });

  test("catálogo novo, outra empresa e faixa removida viram aviso", () => {
    const ref = refDaSelecao(sel(), dados, empresa);
    const novo = { servicos, config: { ...config, versaoCatalogo: 4, codigo: "OUTRA", deslocamentos: [] } };
    const r = recalcularRefOrc(ref, novo, 40);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.avisos.join(" ")).toMatch(/versão 3 do catálogo; a atual é 4/);
    expect(r.avisos.join(" ")).toMatch(/outra empresa/);
    expect(r.avisos.join(" ")).toMatch(/10a20/);
    expect(r.calculo.total).toBe(258);
  });

  test("serviço que sumiu do catálogo impede o cálculo", () => {
    const ref = refDaSelecao(sel(), dados, empresa);
    const r = recalcularRefOrc(ref, { servicos: servicos.slice(0, 1), config }, 40);
    expect(r).toEqual({ ok: false, erro: expect.stringContaining("FTX") });
  });

  test("linha malformada ou de outra origem é ignorada", () => {
    expect(decodificarRefOrc("[ref EJ-7K2M9 v5 c=evento]")).toBeNull();
    expect(decodificarRefOrc("[ref ORC-12 e=X v1]")).toBeNull();
    expect(decodificarRefOrc("[ref ORC-0012 v1 i=A:1]")).toBeNull(); // sem empresa
    expect(decodificarRefOrc("sem ref nenhuma")).toBeNull();
  });
});

describe("mensagem", () => {
  const c = calcularGerador(sel({ desconto: 8 }), servicos, config, 40);
  const ref = refDaSelecao(sel({ desconto: 8 }), { codigo: "ORC-0012", data: "2026-12-20", horario: "16:00" }, empresa);
  const texto = gerarMensagemOrcamento(c, {
    codigo: "ORC-0012",
    empresaNome: "Studio Luz",
    moeda: "BRL",
    cliente: { nome: "Ana [teste]*", telefone: "(86) 98888-7777" },
    data: "2026-12-20",
    horario: "16:00",
    local: "Parque\nPotycabana",
    observacoes: "Levar *roupa* extra",
    emitidoEm: "2026-11-08",
    validadeDias: 15,
    ref,
  });

  test("traz itens, deslocamento, prazo, total, sinal e restante", () => {
    expect(texto).toContain("*Orçamento ORC-0012* — Studio Luz");
    expect(texto).toContain("*Cliente:* Ana teste");
    expect(texto).toContain("*WhatsApp:* (86) 98888-7777");
    expect(texto).toContain("*Serviço:* Ensaio externo + Foto extra");
    expect(texto).toContain("*Data desejada:* 20/12/2026 às 16:00");
    expect(texto).toContain("*Local:* Parque Potycabana");
    expect(texto).toMatch(/• Foto extra × 12 — R\$\s108,00 \(R\$\s9,00 cada, preço por volume\)/);
    expect(texto).toMatch(/\*Deslocamento:\* 10 a 20 km — R\$\s25,00/);
    expect(texto).toMatch(/\*Desconto:\* −R\$\s8,00/);
    expect(texto).toContain("*Prazo de entrega:* Em até 7 dias");
    expect(texto).toMatch(/\*Total:\* R\$\s275,00/);
    expect(texto).toMatch(/\*Sinal \(40%\):\* R\$\s110,00/);
    expect(texto).toMatch(/\*Restante:\* R\$\s165,00/);
    expect(texto).toContain("Válido até 23/11/2026");
    expect(texto).toContain("*Observações:* Levar roupa extra");
  });

  test("a [ref] da mensagem recalcula para o mesmo total", () => {
    const lida = decodificarRefOrc(texto)!;
    const r = recalcularRefOrc(lida, empresa, 40);
    expect(r.ok && r.calculo.total).toBe(275);
  });

  test("link do WhatsApp", () => {
    expect(linkWhatsApp("(86) 98888-7777", "oi")).toBe("https://wa.me/5586988887777?text=oi");
    expect(linkWhatsApp("", "a b")).toBe("https://wa.me/?text=a%20b");
  });
});

describe("orçamento salvo", async () => {
  const { calculoDoOrcamento } = await import("./gerador");
  test("reenviar usa os preços gravados, não os de hoje", () => {
    const c = calcularGerador(sel(), servicos, config, 40);
    let n = 0;
    const itens = itensDoCalculo(c, () => `i${++n}`);
    const o = { itens, desconto: 0, descontoTipo: "valor", acrescimo: 0 } as unknown as Orcamento;
    const maisCaro = servicos.map((s) => (s.id === "s-ensaio" ? { ...s, valor: 999 } : s));
    const r = calculoDoOrcamento(o, maisCaro, 40);
    expect(r.total).toBe(c.total);
    expect(r.sinal).toBe(c.sinal);
    expect(r.linhas.find((l) => l.servicoId === "s-foto")?.volume).toBe(true);
  });
});
