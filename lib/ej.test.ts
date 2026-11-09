import { describe, expect, test } from "vitest";
import { codificarRefEj, extrairRefEj, normalizarUrlEj, novoCodigoEj, selecaoEjVazia } from "./ej";

describe("integração EJ", () => {
  test("linha [ref EJ-…] no formato do site do EJ", () => {
    const linha = codificarRefEj({
      codigo: "EJ-7K2M9",
      versao: 5,
      emitidoEm: "2026-11-08",
      selecao: {
        ...selecaoEjVazia("evento"),
        pacoteId: "ev-padrao3",
        horasExtras: 1,
        minutosPersonalizado: 90,
        fotosPersonalizado: 20,
        entregaId: "ev24",
        deslocamentoId: "10a20",
      },
      data: "2026-12-20",
      horario: "16:00",
    });
    // Mesmo exemplo do contexto de integração.
    expect(linha).toBe("[ref EJ-7K2M9 v5 em=2026-11-08 c=evento p=ev-padrao3 he=1 mp=90 fp=20 en=ev24 ds=10a20 dt=2026-12-20 hr=16:00]");
  });

  test("padrões ficam de fora; auxiliar sem transporte leva am=sem", () => {
    expect(codificarRefEj({ codigo: "EJ-AAAAA", versao: 5, emitidoEm: "2026-11-08", selecao: selecaoEjVazia("ensaio"), data: "", horario: "" })).toBe(
      "[ref EJ-AAAAA v5 em=2026-11-08 c=ensaio]"
    );
    const aux = { ...selecaoEjVazia("auxiliar"), diariasAuxiliar: 2, modoAuxiliar: "sem" as const };
    expect(codificarRefEj({ codigo: "EJ-AAAAA", versao: 5, emitidoEm: "2026-11-08", selecao: aux, data: "", horario: "" })).toBe(
      "[ref EJ-AAAAA v5 em=2026-11-08 c=auxiliar ax=2 am=sem]"
    );
  });

  test("extrai só a linha [ref] do texto colado (nada de dado pessoal vai junto)", () => {
    const texto = "*Cliente:* Ana\n*WhatsApp:* 86 9999\n[ref EJ-7K2M9 v5 em=2026-11-08 c=ensaio]\n_(não apague)_";
    expect(extrairRefEj(texto)).toBe("[ref EJ-7K2M9 v5 em=2026-11-08 c=ensaio]");
    expect(extrairRefEj("[ref ORC-0001 e=X v1]")).toBeNull();
  });

  test("endereço e código", () => {
    expect(normalizarUrlEj("ejfotografia.netlify.app/")).toBe("https://ejfotografia.netlify.app");
    expect(normalizarUrlEj(" https://x.app// ")).toBe("https://x.app");
    expect(novoCodigoEj(() => 0)).toBe("EJ-22222");
    expect(novoCodigoEj()).toMatch(/^EJ-[2-9A-HJKMNP-Z]{5}$/);
  });
});

describe("orçamento e mensagem pelo recálculo do EJ", async () => {
  const { gerarMensagemEj, itensDoRecalculoEj } = await import("./ej");
  const { calcOrcamentoTotais } = await import("./helpers");
  // Resposta real da API para a ref de exemplo (tabela v5).
  const r = {
    versaoApi: 1, versaoTabela: 5, versaoRef: 5, codigo: "EJ-7K2M9", emitidoEm: "2026-11-08", data: "2026-12-20", horario: "16:00",
    selecao: selecaoEjVazia("evento"), servico: "Evento pequeno — Padrão",
    linhas: [
      { descricao: "Pacote Padrão (até 2h30 de cobertura · 50–60 fotos)", quantidade: 1, unitario: 250, valor: 250, tipo: "fixo" as const },
      { descricao: "Hora extra em campo", quantidade: 1, unitario: 45, valor: 45, tipo: "fixo" as const },
      { descricao: "Entrega expressa 24h (em até 24h)", quantidade: 1, unitario: 60, valor: 60, tipo: "fixo" as const, grupo: "entrega" },
      { descricao: "Deslocamento (10 a 20 km de Teresina)", quantidade: 1, unitario: 25, valor: 25, tipo: "fixo" as const, grupo: "deslocamento" },
    ],
    total: 380, totalEhMinimo: false, sinalPercentual: 40, sinal: 152, restante: 228,
    prazo: { nome: "Expressa 24h", detalhe: "em até 24h", preco: 60 }, pendencias: [], avisos: [],
  };

  test("itens somam o total do EJ; o pacote é o principal", () => {
    let n = 0;
    const itens = itensDoRecalculoEj(r, () => `i${++n}`);
    expect(calcOrcamentoTotais(itens, 0, "valor", 0).total).toBe(380);
    expect(itens[0].tipo).toBeUndefined();
    expect(itens.slice(1).every((i) => i.tipo === "adicional")).toBe(true);
  });

  test("a combinar fica com valor zero", () => {
    const comCombinar = { ...r, linhas: [...r.linhas, { descricao: "Deslocamento acima de 30 km", quantidade: 1, unitario: 0, valor: 0, tipo: "aCombinar" as const }] };
    const itens = itensDoRecalculoEj(comCombinar, () => "x");
    expect(itens.at(-1)).toMatchObject({ descricao: "Deslocamento acima de 30 km (a combinar)", valorUnitario: 0 });
  });

  test("mensagem no formato do EJ, com a ref", () => {
    const linhaRef = "[ref EJ-7K2M9 v5 em=2026-11-08 c=evento p=ev-padrao3 he=1 en=ev24 ds=10a20 dt=2026-12-20 hr=16:00]";
    const t = gerarMensagemEj(r, { empresaNome: "EJ Fotografia", cliente: { nome: "Ana", telefone: "86 9" }, local: "Clube", observacoes: "", validadeDias: 15, linhaRef });
    expect(t).toContain("*Serviço:* Evento pequeno — Padrão");
    expect(t).toContain("*Data desejada:* 20/12/2026 às 16:00");
    expect(t).toContain("• Hora extra em campo — R$");
    expect(t).not.toContain("• Entrega expressa"); // linhas de grupo saem nas linhas próprias
    expect(t).toMatch(/\*Deslocamento:\* 10 a 20 km de Teresina — R\$\s25,00/);
    expect(t).toMatch(/\*Entrega:\* Expressa 24h \(em até 24h\) — R\$\s60,00/);
    expect(t).toMatch(/\*Total:\* R\$\s380,00/);
    expect(t).toMatch(/\*Sinal \(40%\):\* R\$\s152,00/);
    expect(t).toContain("Válido até 23/11/2026");
    expect(extrairRefEj(t)).toBe(linhaRef);
  });
});
