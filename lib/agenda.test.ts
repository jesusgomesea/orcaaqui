import { describe, expect, test } from "vitest";
import {
  compararPorData,
  mudarEtapa,
  nomeEtapa,
  novoAgendamento,
  percentualSinal,
  situacao,
  valorDoSinal,
  valorPago,
  valorRestante,
  valorTotal,
} from "./agenda";
import { calcularSinal } from "./documentos/formatos";
import { configPadrao, ETAPAS_PADRAO } from "./estado";
import type { Orcamento } from "./tipos";

const empresa = { config: configPadrao("e1"), moeda: "BRL" as const };

function orcamento(patch: Partial<Orcamento> = {}): Orcamento {
  return {
    id: "o1",
    numero: 1,
    criadoEm: "2026-11-01",
    clienteId: "c1",
    data: "2026-11-01",
    validadeDias: 15,
    moeda: "BRL",
    itens: [{ id: "i1", descricao: "Ensaio", quantidade: 1, valorUnitario: 175 }],
    desconto: 0,
    descontoTipo: "valor",
    acrescimo: 0,
    condicoes: "",
    observacoes: "",
    status: "aprovado",
    ...patch,
  };
}

describe("sinal configurável", () => {
  test("ceil(total × % / 100) em reais e sinal + restante = total", () => {
    expect(calcularSinal(175, 40)).toEqual({ sinal: 70, restante: 105 });
    expect(calcularSinal(333, 40)).toEqual({ sinal: 134, restante: 199 });
    expect(calcularSinal(333, 30)).toEqual({ sinal: 100, restante: 233 });
    expect(calcularSinal(199.9, 50)).toEqual({ sinal: 100, restante: 99.9 });
    expect(calcularSinal(100, 0)).toEqual({ sinal: 0, restante: 100 });
    expect(calcularSinal(100, 100)).toEqual({ sinal: 100, restante: 0 });
    // 33,30 × 40% = 13,32 exato: não pode virar 14 por erro de ponto flutuante.
    expect(calcularSinal(3330, 40).sinal).toBe(1332);
    for (const total of [1, 9.99, 57.5, 380, 1234.56]) {
      for (const pct of [10, 25, 33.3, 40, 60]) {
        const { sinal, restante } = calcularSinal(total, pct);
        expect(Math.round((sinal + restante) * 100)).toBe(Math.round(total * 100));
        expect(Number.isInteger(sinal) || sinal === total).toBe(true);
      }
    }
  });

  test("percentual: o do orçamento, senão o da empresa, senão 40", () => {
    expect(percentualSinal({ sinalPercentual: 25 }, { config: { ...empresa.config, sinalPercentual: 30 } })).toBe(25);
    expect(percentualSinal({}, { config: { ...empresa.config, sinalPercentual: 30 } })).toBe(30);
    expect(percentualSinal({})).toBe(40);
  });
});

describe("agendamento", () => {
  const agora = new Date("2026-11-08T12:00:00.000Z");

  test("nasce na primeira etapa, com o sinal da empresa gravado", () => {
    const a = novoAgendamento(orcamento(), { ...empresa, config: { ...empresa.config, sinalPercentual: 30 } }, agora);
    expect(a.etapa).toBe("recebido");
    expect(a.historico).toEqual([{ etapa: "recebido", em: agora.toISOString() }]);
    expect(a.orcamentoId).toBe("o1");
    expect(a.clienteId).toBe("c1");
    expect(a.sinalPercentual).toBe(30);
    expect(a.valorCombinado).toBeNull();
  });

  test("valores: total, pago, restante e sinal", () => {
    const o = orcamento({ pagamentos: [{ id: "p", tipo: "sinal", valor: 70, data: "2026-11-02", forma: "Pix" }] });
    const a = novoAgendamento(o, empresa, agora);
    expect(valorTotal(a, o)).toBe(175);
    expect(valorPago(o)).toBe(70);
    expect(valorRestante(a, o)).toBe(105);
    expect(valorDoSinal(a, o)).toBe(70);

    const comExtra = { ...a, extras: [{ id: "x", descricao: "Remarcação", valor: 45 }] };
    expect(valorTotal(comExtra, o)).toBe(220);
    expect(valorRestante(comExtra, o)).toBe(150);
    expect(valorDoSinal(comExtra, o)).toBe(70); // extra não entra no sinal

    const combinado = { ...a, valorCombinado: 150 };
    expect(valorTotal(combinado, o)).toBe(150);
    expect(valorDoSinal(combinado, o)).toBe(60);
    expect(valorRestante({ ...a, valorCombinado: 50 }, o)).toBe(0); // nunca negativo
  });

  test("etapas, situação e histórico", () => {
    const etapas = ETAPAS_PADRAO;
    const a = novoAgendamento(orcamento(), empresa, agora);
    expect(situacao(a, etapas)).toBe("ativo");
    const depois = new Date("2026-11-09T12:00:00.000Z");
    const entregue = mudarEtapa(a, "entregue", depois);
    expect(situacao(entregue, etapas)).toBe("concluido");
    expect(entregue.historico.at(-1)).toEqual({ etapa: "entregue", em: depois.toISOString() });
    expect(mudarEtapa(entregue, "entregue")).toBe(entregue);
    expect(situacao(mudarEtapa(a, "cancelado"), etapas)).toBe("cancelado");
    expect(nomeEtapa("cancelado", etapas)).toBe("Cancelado");
    expect(nomeEtapa("sinal_pago", etapas)).toBe("Sinal pago");
    expect(nomeEtapa("removida", etapas)).toBe("removida");
  });

  test("ordem: com data primeiro (data + hora), sem data por último", () => {
    const itens = [
      { id: "sem-data-velho", data: "", horario: "", criadoEm: "2026-01-01" },
      { id: "dia20-16h", data: "2026-12-20", horario: "16:00", criadoEm: "2026-01-01" },
      { id: "dia20-09h", data: "2026-12-20", horario: "09:00", criadoEm: "2026-01-01" },
      { id: "sem-data-novo", data: "", horario: "", criadoEm: "2026-02-01" },
      { id: "dia10", data: "2026-12-10", horario: "", criadoEm: "2026-01-01" },
    ];
    expect([...itens].sort(compararPorData).map((x) => x.id)).toEqual([
      "dia10",
      "dia20-09h",
      "dia20-16h",
      "sem-data-novo",
      "sem-data-velho",
    ]);
  });
});
