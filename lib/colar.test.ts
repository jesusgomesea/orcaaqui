import { describe, expect, test, vi } from "vitest";
import { agendarOrcamento, aprovarLeitura, campo, lerColagemEj, lerColagemOrc, lerDataBR, lerMoeda, tipoDeRef } from "./colar";
import { mergeEmpresa } from "./estado";
import { calcularGerador, gerarMensagemOrcamento, refDaSelecao, type SelecaoGerador } from "./gerador";
import { calcOrcamentoTotais } from "./helpers";
import type { RecalculoEj } from "./ej";
import type { Empresa } from "./tipos";

function empresaBase(): Empresa {
  return mergeEmpresa({
    id: "emp",
    nome: "Studio Luz",
    clientes: [{ id: "c-ana", nome: "Ana Souza", documento: "", telefone: "(86) 98888-7777", email: "", endereco: "", observacoes: "" }],
    servicos: [
      { id: "s-ensaio", codigo: "ENS", categoria: "", nome: "Ensaio externo", descricao: "", valor: 150, prazo: "Em até 7 dias" },
      { id: "s-foto", codigo: "FTX", categoria: "", nome: "Foto extra", descricao: "", valor: 12, precoVolume: 9, volumeMin: 10 },
    ],
    config: {
      sinalPercentual: 40,
      validadeDias: 15,
      deslocamentos: [{ id: "10a20", nome: "10 a 20 km", valor: 25 }],
      etapasAgenda: [],
      versaoCatalogo: 2,
      codigo: "EMPR5",
    },
  });
}

const selecao: SelecaoGerador = {
  itens: [
    { servicoId: "s-ensaio", quantidade: 1 },
    { servicoId: "s-foto", quantidade: 12 },
  ],
  desconto: 0,
  acrescimo: 0,
  deslocamentoId: "10a20",
};

function mensagemOrc(empresa: Empresa, codigo = "ORC-0007", cliente = { nome: "Bruno Lima", telefone: "86 99999-1111" }) {
  const calc = calcularGerador(selecao, empresa.servicos, empresa.config, 40);
  return gerarMensagemOrcamento(calc, {
    codigo,
    empresaNome: empresa.nome,
    moeda: "BRL",
    cliente,
    data: "2026-12-20",
    horario: "16:00",
    local: "Parque Potycabana",
    observacoes: "Levar o cachorro",
    emitidoEm: "2026-11-08",
    validadeDias: 15,
    ref: refDaSelecao(selecao, { codigo, data: "2026-12-20", horario: "16:00" }, empresa),
  });
}

describe("leitura das linhas com rótulo", () => {
  test("campo com e sem asteriscos", () => {
    expect(campo("*Cliente:* Ana\n*WhatsApp:* 86 9", "Cliente")).toBe("Ana");
    expect(campo("Cliente: Ana", "Cliente")).toBe("Ana");
    expect(campo("nada", "Cliente")).toBe("");
  });
  test("moeda", () => {
    expect(lerMoeda("R$ 1.234,56")).toBe(1234.56);
    expect(lerMoeda("a partir de R$ 80,00 + itens a combinar")).toBe(80);
    expect(lerMoeda("150.50")).toBe(150.5);
    expect(lerMoeda("sem número")).toBeNull();
  });
  test("data e horário", () => {
    expect(lerDataBR("20/12/2026 às 16:00")).toEqual({ data: "2026-12-20", horario: "16:00" });
    expect(lerDataBR("31/02/2026")).toEqual({ data: "", horario: "" });
    expect(lerDataBR("a definir")).toEqual({ data: "", horario: "" });
  });
  test("tipo da ref", () => {
    expect(tipoDeRef("x [ref EJ-7K2M9 v5 c=ensaio]")).toBe("ej");
    expect(tipoDeRef("[ref ORC-0001 e=X v1]")).toBe("orc");
    expect(tipoDeRef("sem ref")).toBeNull();
  });
});

describe("colar mensagem do gerador ([ref ORC-…])", () => {
  test("cria cliente, orçamento aprovado e agendamento com os valores recalculados", () => {
    const empresa = empresaBase();
    const r = lerColagemOrc(mensagemOrc(empresa), empresa);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const l = r.leitura;
    expect(l.total).toBe(283);
    expect(l.totalNoTexto).toBe(283);
    expect(l.avisos).toEqual([]);
    expect(l.cliente).toEqual({ nome: "Bruno Lima", telefone: "86 99999-1111" });
    expect([l.data, l.horario, l.local, l.observacoes]).toEqual(["2026-12-20", "16:00", "Parque Potycabana", "Levar o cachorro"]);
    expect(l.existenteId).toBeNull();

    const agora = new Date("2026-11-09T10:00:00Z");
    const a = aprovarLeitura(empresa, l, agora);
    expect(a.clienteNovo).toBe(true);
    expect(a.orcamentoNovo).toBe(true);
    const o = a.empresa.orcamentos.find((x) => x.id === a.orcamentoId)!;
    expect(o).toMatchObject({ status: "aprovado", origem: "colado-orc", codigoRef: "ORC-0007", numero: 1, sinalPercentual: 40 });
    expect(calcOrcamentoTotais(o.itens, o.desconto, o.descontoTipo, o.acrescimo).total).toBe(283);
    expect(o.servicoContrato).toMatchObject({ dataServico: "2026-12-20", horarioInicio: "16:00", local: "Parque Potycabana" });
    expect(a.empresa.proximoNumero).toBe(2);
    const ag = a.empresa.agendamentos.find((x) => x.id === a.agendamentoId)!;
    expect(ag).toMatchObject({ orcamentoId: o.id, clienteId: o.clienteId, etapa: "recebido", sinalPercentual: 40 });
    expect(a.empresa.clientes.find((c) => c.id === o.clienteId)?.nome).toBe("Bruno Lima");
  });

  test("cliente com o mesmo telefone é reaproveitado", () => {
    const empresa = empresaBase();
    const r = lerColagemOrc(mensagemOrc(empresa, "ORC-0007", { nome: "Ana", telefone: "+55 86 98888-7777" }), empresa);
    if (!r.ok) throw new Error(r.erro);
    const a = aprovarLeitura(empresa, r.leitura);
    expect(a.clienteNovo).toBe(false);
    expect(a.empresa.clientes).toHaveLength(1);
  });

  test("total editado na mensagem é detectado (vale o recalculado)", () => {
    const empresa = empresaBase();
    const editada = mensagemOrc(empresa).replace(/\*Total:\* R\$\s283,00/, "*Total:* R$ 200,00");
    const r = lerColagemOrc(editada, empresa);
    if (!r.ok) throw new Error(r.erro);
    expect(r.leitura.total).toBe(283);
    expect(r.leitura.totalNoTexto).toBe(200);
    expect(r.leitura.avisos.join(" ")).toMatch(/não bate com o recalculado/);
  });

  test("tabela mudou depois: aviso de versão e valor pelo catálogo atual", () => {
    const empresa = empresaBase();
    const texto = mensagemOrc(empresa);
    const nova = { ...empresa, servicos: empresa.servicos.map((s) => (s.id === "s-ensaio" ? { ...s, valor: 170 } : s)), config: { ...empresa.config, versaoCatalogo: 3 } };
    const r = lerColagemOrc(texto, nova);
    if (!r.ok) throw new Error(r.erro);
    expect(r.leitura.total).toBe(303);
    expect(r.leitura.avisos.join(" ")).toMatch(/versão 2 do catálogo; a atual é 3/);
    expect(r.leitura.avisos.join(" ")).toMatch(/não bate/);
  });

  test("código que já existe atualiza o orçamento salvo e não duplica o agendamento", () => {
    let empresa = empresaBase();
    empresa = {
      ...empresa,
      proximoNumero: 8,
      orcamentos: [
        {
          id: "o7", numero: 7, criadoEm: "2026-11-08", clienteId: "c-ana", data: "2026-11-08", validadeDias: 15, moeda: "BRL",
          itens: [{ id: "x", descricao: "Ensaio externo", quantidade: 1, valorUnitario: 150, servicoId: "s-ensaio" }],
          desconto: 0, descontoTipo: "valor", acrescimo: 0, condicoes: "", observacoes: "", status: "enviado", origem: "gerador", codigoRef: "ORC-0007",
        },
      ],
    };
    const r = lerColagemOrc(mensagemOrc(empresa), empresa);
    if (!r.ok) throw new Error(r.erro);
    expect(r.leitura.existenteId).toBe("o7");
    expect(r.leitura.avisos.join(" ")).toMatch(/salvo ORC-0007 tem total R\$\s150,00/);

    const a = aprovarLeitura(empresa, r.leitura);
    expect(a.orcamentoNovo).toBe(false);
    expect(a.empresa.orcamentos).toHaveLength(1);
    expect(a.empresa.orcamentos[0]).toMatchObject({ id: "o7", numero: 7, status: "aprovado", origem: "gerador", clienteId: "c-ana" });
    expect(a.empresa.proximoNumero).toBe(8);
    // Colar de novo não cria um segundo agendamento.
    const r2 = lerColagemOrc(mensagemOrc(a.empresa), a.empresa);
    if (!r2.ok) throw new Error(r2.erro);
    expect(aprovarLeitura(a.empresa, r2.leitura).empresa.agendamentos).toHaveLength(1);
  });

  test("ref alterada ou com serviço inexistente dá erro claro", () => {
    const empresa = empresaBase();
    expect(lerColagemOrc("[ref ORC-0007 v2 i=ENS:1]", empresa)).toEqual({ ok: false, erro: expect.stringContaining("incompleta") });
    const r = lerColagemOrc(mensagemOrc(empresa).replace("FTX:12", "ZZZ:12"), empresa);
    expect(r).toEqual({ ok: false, erro: expect.stringContaining("ZZZ") });
  });
});

describe("colar mensagem do site do EJ ([ref EJ-…])", () => {
  const recalculo: RecalculoEj = {
    versaoApi: 1, versaoTabela: 5, versaoRef: 5, codigo: "EJ-7K2M9", emitidoEm: "2026-11-08", data: "2026-12-20", horario: "16:00",
    selecao: {} as RecalculoEj["selecao"], servico: "Evento pequeno — Padrão",
    linhas: [
      { descricao: "Pacote Padrão (até 2h30 de cobertura · 50–60 fotos)", quantidade: 1, unitario: 250, valor: 250, tipo: "fixo" },
      { descricao: "Hora extra em campo", quantidade: 1, unitario: 45, valor: 45, tipo: "fixo" },
      { descricao: "Entrega expressa 24h (em até 24h)", quantidade: 1, unitario: 60, valor: 60, tipo: "fixo", grupo: "entrega" },
      { descricao: "Deslocamento (10 a 20 km de Teresina)", quantidade: 1, unitario: 25, valor: 25, tipo: "fixo", grupo: "deslocamento" },
    ],
    total: 380, totalEhMinimo: false, sinalPercentual: 40, sinal: 152, restante: 228,
    prazo: { nome: "Expressa 24h", detalhe: "em até 24h", preco: 60 }, pendencias: [], avisos: [],
  };
  const ref = "[ref EJ-7K2M9 v5 em=2026-11-08 c=evento p=ev-padrao3 he=1 en=ev24 ds=10a20 dt=2026-12-20 hr=16:00]";
  const texto = [
    "📸 *Orçamento EJ-7K2M9* — Eluan Jesus Fotografia",
    "",
    "*Cliente:* Carla Dias",
    "*WhatsApp:* (86) 97777-2222",
    "*Serviço:* Evento pequeno — Padrão",
    "*Data desejada:* 20/12/2026 às 16:00",
    "*Local:* Clube dos Diários",
    "",
    "*Total:* R$ 380,00",
    "",
    "*Observações:* Aniversário de 15 anos",
    "",
    ref,
    "_(não apague a linha acima: ela identifica o seu orçamento)_",
  ].join("\n");

  test("só a linha [ref] vai para o EJ; cria orçamento e agendamento", async () => {
    const recalcular = vi.fn(async () => recalculo);
    const empresa = empresaBase();
    const r = await lerColagemEj(texto, empresa, recalcular);
    expect(recalcular).toHaveBeenCalledWith(ref);
    expect(JSON.stringify(recalcular.mock.calls)).not.toMatch(/Carla|97777|Clube/);
    if (!r.ok) throw new Error(r.erro);
    expect(r.leitura).toMatchObject({
      origem: "colado-ej", codigoRef: "EJ-7K2M9", total: 380, totalNoTexto: 380, data: "2026-12-20", horario: "16:00",
      local: "Clube dos Diários", observacoes: "Aniversário de 15 anos", cliente: { nome: "Carla Dias", telefone: "(86) 97777-2222" },
    });
    expect(r.leitura.avisos).toEqual([]);
    expect(r.leitura.servicoContrato).toMatchObject({ servico: "Evento pequeno — Padrão", prazoEntrega: "Em até 24h" });

    const a = aprovarLeitura(empresa, r.leitura);
    const o = a.empresa.orcamentos.find((x) => x.id === a.orcamentoId)!;
    expect(o).toMatchObject({ codigoRef: "EJ-7K2M9", origem: "colado-ej", status: "aprovado", moeda: "BRL" });
    expect(calcOrcamentoTotais(o.itens, 0, "valor", 0).total).toBe(380);
    expect(a.empresa.agendamentos).toHaveLength(1);
  });

  test("total editado e tabela antiga viram aviso; mínimo não atingido é pendência", async () => {
    const editado = texto.replace("*Total:* R$ 380,00", "*Total:* R$ 300,00");
    const antigo = { ...recalculo, versaoRef: 4, pendencias: ["Personalizado: mínimo de 20 fotos."], avisos: ["Orçamento montado com a tabela v4; o valor está pela tabela atual (v5)."] };
    const r = await lerColagemEj(editado, empresaBase(), async () => antigo);
    if (!r.ok) throw new Error(r.erro);
    expect(r.leitura.avisos.join(" ")).toMatch(/tabela v4 do EJ; o valor já está pela atual \(v5\)/);
    expect(r.leitura.avisos.filter((a) => /tabela v4/.test(a))).toHaveLength(1);
    expect(r.leitura.avisos.join(" ")).toMatch(/R\$\s300,00.*não bate/);
    expect(r.leitura.pendencias).toEqual(["Personalizado: mínimo de 20 fotos."]);
  });

  test("falha da API vira erro legível", async () => {
    const r = await lerColagemEj(texto, empresaBase(), async () => {
      throw new Error("O site do EJ não respondeu a tempo. Tente de novo.");
    });
    expect(r).toEqual({ ok: false, erro: "O site do EJ não respondeu a tempo. Tente de novo." });
  });
});

describe("Cliente aprovou → agendar", () => {
  test("aprova e cria um único agendamento", () => {
    let empresa = empresaBase();
    empresa = {
      ...empresa,
      config: { ...empresa.config, sinalPercentual: 30 },
      orcamentos: [
        {
          id: "o1", numero: 1, criadoEm: "2026-11-01", clienteId: "c-ana", data: "2026-11-01", validadeDias: 15, moeda: "BRL",
          itens: [{ id: "i", descricao: "X", quantidade: 1, valorUnitario: 100 }], desconto: 0, descontoTipo: "valor", acrescimo: 0,
          condicoes: "", observacoes: "", status: "enviado",
        },
      ],
    };
    const r = agendarOrcamento(empresa, "o1")!;
    expect(r.jaExistia).toBe(false);
    expect(r.empresa.orcamentos[0]).toMatchObject({ status: "aprovado", sinalPercentual: 30 });
    expect(r.empresa.agendamentos).toHaveLength(1);
    expect(r.empresa.agendamentos[0].sinalPercentual).toBe(30);
    const de_novo = agendarOrcamento(r.empresa, "o1")!;
    expect(de_novo.jaExistia).toBe(true);
    expect(de_novo.empresa.agendamentos).toHaveLength(1);
    expect(agendarOrcamento(empresa, "nao-existe")).toBeNull();
  });
});
