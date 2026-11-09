// Testes das regras de contrato e recibo. Rodar com `npm test`
// (node --test, sem dependência extra: o Node executa TypeScript direto).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import PizZip from "pizzip";
import type { Cliente, Orcamento, Prestador } from "../tipos";
import { valorPorExtenso, dataPorExtenso, numeroPorExtenso } from "./extenso.ts";
import {
  calcularSinal,
  cpfValido,
  formatarCpf,
  formatarNumeroDocumento,
  formatarReais,
  formatarTelefone,
  hojeNoFuso,
  nomeArquivoDocumento,
} from "./formatos.ts";
import { montarCamposContrato, montarCamposRecibo, totalPagoAte } from "./campos.ts";
import { preencherModelo, marcadoresRestantes, ErroMarcadores } from "./preencher.ts";

const NBSP = " ";
const reais = (s: string) => s.replace(" ", NBSP);

test("valor por extenso — casos do critério de aceite", () => {
  assert.equal(valorPorExtenso(80), "oitenta reais");
  assert.equal(valorPorExtenso(100), "cem reais");
  assert.equal(valorPorExtenso(101), "cento e um reais");
  assert.equal(valorPorExtenso(1234.56), "mil duzentos e trinta e quatro reais e cinquenta e seis centavos");
});

test("valor por extenso — outros casos", () => {
  assert.equal(valorPorExtenso(1), "um real");
  assert.equal(valorPorExtenso(0.01), "um centavo");
  assert.equal(valorPorExtenso(0.5), "cinquenta centavos");
  assert.equal(valorPorExtenso(1000), "mil reais");
  assert.equal(valorPorExtenso(1100), "mil e cem reais");
  assert.equal(valorPorExtenso(1050), "mil e cinquenta reais");
  assert.equal(valorPorExtenso(2000.1), "dois mil reais e dez centavos");
  assert.equal(valorPorExtenso(1_000_000), "um milhão de reais");
  assert.equal(valorPorExtenso(2_500_000), "dois milhões quinhentos mil reais");
  assert.equal(valorPorExtenso(120), "cento e vinte reais");
  assert.equal(numeroPorExtenso(219), "duzentos e dezenove");
});

test("sinal de 40% arredondado para cima em reais inteiros", () => {
  assert.deepEqual(calcularSinal(175), { sinal: 70, restante: 105 });
  assert.deepEqual(calcularSinal(333), { sinal: 134, restante: 199 });
  assert.deepEqual(calcularSinal(200), { sinal: 80, restante: 120 });
  assert.deepEqual(calcularSinal(1234.56), { sinal: 494, restante: 740.56 });
  // Total menor que R$ 1: o sinal nunca passa do total.
  assert.deepEqual(calcularSinal(0.1 + 0.2), { sinal: 0.3, restante: 0 });
  assert.deepEqual(calcularSinal(0), { sinal: 0, restante: 0 });
});

test("formatos", () => {
  assert.equal(formatarReais(1234.56), reais("R$ 1.234,56"));
  assert.equal(formatarReais(80), reais("R$ 80,00"));
  assert.equal(formatarCpf("52998224725"), "529.982.247-25");
  assert.ok(cpfValido("529.982.247-25"));
  assert.ok(!cpfValido("529.982.247-24"));
  assert.ok(!cpfValido("111.111.111-11"));
  assert.equal(formatarTelefone("86999998888"), "(86) 99999-8888");
  assert.equal(formatarTelefone("+55 86 99999-8888"), "(86) 99999-8888");
  assert.equal(formatarNumeroDocumento(1, 2026), "001/2026");
  assert.equal(dataPorExtenso("2026-11-09"), "9 de novembro de 2026");
  assert.equal(nomeArquivoDocumento("contrato", "001/2026", "Ana Souza", "pdf"), "Contrato 001-2026 - Ana Souza.pdf");
  assert.equal(nomeArquivoDocumento("recibo", "002/2026", "Ana/Souza", "docx"), "Recibo 002-2026 - Ana Souza.docx");
  // 02:00 UTC do dia 9 ainda é dia 8 em Teresina (UTC-3).
  assert.equal(hojeNoFuso(new Date("2026-11-09T02:00:00Z")), "2026-11-08");
});

// ---------- dados de exemplo ----------

const prestador: Prestador = {
  habilitado: true,
  nome: "Fulano de Tal",
  cpf: "52998224725",
  endereco: "Rua X, 123, Centro, Teresina/PI",
  whatsapp: "86999990000",
  email: "foto@example.com",
  pix: "foto@example.com",
  modeloVersao: "v3 — nov/2026",
};

const cliente: Cliente = {
  id: "c1",
  nome: "Ana Souza",
  documento: "111.444.777-35",
  telefone: "(86) 98888-7777",
  email: "ana@example.com",
  endereco: "Av. Y, 45, Jóquei, Teresina/PI",
  observacoes: "",
};

function orcamentoBase(patch: Partial<Orcamento> = {}): Orcamento {
  return {
    id: "o1",
    criadoEm: "2026-11-01",
    clienteId: "c1",
    data: "2026-11-01",
    validadeDias: 15,
    moeda: "BRL",
    itens: [
      { id: "i1", descricao: "Ensaio ao ar livre — Padrão", quantidade: 1, valorUnitario: 115 },
      { id: "i2", descricao: "Hora extra (1h)", quantidade: 1, valorUnitario: 35, tipo: "adicional" },
      { id: "i3", descricao: "Expressa 24h", quantidade: 1, valorUnitario: 50, tipo: "adicional" },
    ],
    desconto: 0,
    descontoTipo: "valor",
    acrescimo: 0,
    condicoes: "",
    observacoes: "",
    status: "aprovado",
    servicoContrato: {
      servico: "Ensaio ao ar livre",
      pacote: "Padrão",
      dataServico: "2026-12-14",
      horarioInicio: "16:30",
      horarioFim: "17:30",
      local: "Parque Potycabana",
      tempoCampo: "1h",
      fotosEditadas: "30–40",
      personalizado: false,
      personalizadoHoras: 0,
      personalizadoFotos: 0,
      prazoEntrega: "Em até 24h",
    },
    pagamentos: [
      { id: "p1", tipo: "sinal", valor: 80, data: "2026-11-10", forma: "Pix" },
      { id: "p2", tipo: "restante", valor: 120, data: "2026-12-14", forma: "Pix" },
    ],
    ...patch,
  };
}

const dadosContrato = (o: Orcamento) =>
  montarCamposContrato({ prestador, cliente, orcamento: o, numero: "001/2026", dataGeracao: "2026-11-09" });

test("contrato — ensaio ao ar livre com adicionais", () => {
  const { campos, faltando } = dadosContrato(orcamentoBase());
  assert.deepEqual(faltando, []);
  assert.equal(campos.valor_total, reais("R$ 200,00"));
  assert.equal(campos.valor_sinal, reais("R$ 80,00"));
  assert.equal(campos.valor_restante, reais("R$ 120,00"));
  assert.equal(campos.adicionais, `Hora extra (1h) — ${reais("R$ 35,00")}; Expressa 24h — ${reais("R$ 50,00")}`);
  assert.equal(campos.personalizado_resumo, "—");
  assert.equal(campos.cliente_cpf, "111.444.777-35");
  assert.equal(campos.data_contrato_extenso, "9 de novembro de 2026");
});

test("contrato — evento pequeno sem horário de fim e sem adicionais", () => {
  const o = orcamentoBase({
    itens: [{ id: "i1", descricao: "Evento pequeno", quantidade: 1, valorUnitario: 175 }],
  });
  o.servicoContrato = { ...o.servicoContrato!, servico: "Evento pequeno", horarioFim: "", fotosEditadas: "60–80" };
  const { campos, faltando } = dadosContrato(o);
  assert.deepEqual(faltando, []);
  assert.equal(campos.horario_fim, "—");
  assert.equal(campos.adicionais, "Nenhum");
  assert.equal(campos.valor_sinal, reais("R$ 70,00"));
  assert.equal(campos.valor_restante, reais("R$ 105,00"));
});

test("contrato — personalizado", () => {
  const o = orcamentoBase({ itens: [{ id: "i1", descricao: "Personalizado", quantidade: 1, valorUnitario: 333 }] });
  o.servicoContrato = { ...o.servicoContrato!, pacote: "Personalizado", personalizado: true, personalizadoHoras: 3, personalizadoFotos: 40, tempoCampo: "", fotosEditadas: "" };
  const { campos, faltando } = dadosContrato(o);
  assert.deepEqual(faltando, []);
  assert.equal(campos.personalizado_resumo, "3 horas · 40 fotos");
  assert.equal(campos.tempo_campo, "3h");
  assert.equal(campos.fotos_editadas, "40");
  assert.equal(campos.valor_sinal, reais("R$ 134,00"));
  assert.equal(campos.valor_restante, reais("R$ 199,00"));
});

test("contrato — falta de dados lista o que falta", () => {
  const o = orcamentoBase({ status: "enviado", servicoContrato: undefined });
  const { faltando } = montarCamposContrato({
    prestador,
    cliente: { ...cliente, documento: "", endereco: "" },
    orcamento: o,
    numero: "001/2026",
    dataGeracao: "2026-11-09",
  });
  for (const esperado of ["Orçamento com status Aprovado", "CPF do cliente", "Endereço do cliente", "Data do serviço", "Local do serviço"]) {
    assert.ok(faltando.some((f) => f.startsWith(esperado)), `deveria faltar: ${esperado} — veio ${faltando.join(" | ")}`);
  }
});

test("recibo — total pago acumulado até o pagamento", () => {
  const o = orcamentoBase();
  assert.equal(totalPagoAte(o.pagamentos!, "p1"), 80);
  assert.equal(totalPagoAte(o.pagamentos!, "p2"), 200);
  const { campos, faltando } = montarCamposRecibo({
    prestador, cliente, orcamento: o, pagamentoId: "p1",
    contrato: { numero: "001/2026", dataGeracao: "2026-11-09" }, numero: "001/2026",
  });
  assert.deepEqual(faltando, []);
  assert.equal(campos.recibo_tipo, "Sinal (40%) para reserva de data");
  assert.equal(campos.recibo_valor_extenso, "oitenta reais");
  assert.equal(campos.total_pago, reais("R$ 80,00"));
  assert.equal(campos.saldo_restante, reais("R$ 120,00"));
  assert.equal(campos.data_contrato, "09/11/2026");
  assert.equal(campos.data_recibo_extenso, "10 de novembro de 2026");
});

test("recibo — exige contrato gerado", () => {
  const { faltando } = montarCamposRecibo({
    prestador, cliente, orcamento: orcamentoBase(), pagamentoId: "p1", contrato: null, numero: "001/2026",
  });
  assert.ok(faltando.some((f) => f.startsWith("Contrato gerado")));
});

// ---------- modelos reais ----------

const modelo = (nome: string) => new Uint8Array(readFileSync(join(import.meta.dirname, "..", "..", "templates", nome)));

function textoDocumento(docx: Uint8Array): string {
  const zip = new PizZip(docx);
  return (zip.file("word/document.xml")?.asText() ?? "").replace(/<[^>]+>/g, "");
}

test("modelo do contrato preenchido não deixa marcadores e mantém o Anexo I em branco", () => {
  const original = modelo("contrato-prestacao-servicos.docx");
  assert.ok(marcadoresRestantes(original).length > 0);
  const saida = preencherModelo(original, dadosContrato(orcamentoBase()).campos);
  assert.deepEqual(marcadoresRestantes(saida), []);
  const texto = textoDocumento(saida);
  assert.ok(texto.includes("Eu, Ana Souza, CPF nº 111.444.777-35"));
  assert.ok(texto.includes("☐ Autorizo"));
  assert.ok(texto.includes("☐ Não autorizo"));
  assert.ok(!texto.includes("☑") && !texto.includes("☒"));
  // Cabeçalho, rodapé e logo continuam no arquivo.
  const zip = new PizZip(saida);
  assert.ok(zip.file("word/footer1.xml")?.asText().includes("NUMPAGES"));
  assert.ok(Object.keys(zip.files).some((n) => n.startsWith("word/media/")));
});

test("modelo do recibo preenchido não deixa marcadores", () => {
  const { campos } = montarCamposRecibo({
    prestador, cliente, orcamento: orcamentoBase(), pagamentoId: "p2",
    contrato: { numero: "001/2026", dataGeracao: "2026-11-09" }, numero: "002/2026",
  });
  const saida = preencherModelo(modelo("recibo-pagamento.docx"), campos);
  assert.deepEqual(marcadoresRestantes(saida), []);
  assert.ok(textoDocumento(saida).includes("duzentos reais") === false);
  assert.ok(textoDocumento(saida).includes("cento e vinte reais"));
});

test("campo vazio bloqueia a geração com o nome do marcador", () => {
  const { campos } = dadosContrato(orcamentoBase());
  assert.throws(
    () => preencherModelo(modelo("contrato-prestacao-servicos.docx"), { ...campos, local: "" }),
    (e: unknown) => e instanceof ErroMarcadores && e.marcadores.includes("local")
  );
});
