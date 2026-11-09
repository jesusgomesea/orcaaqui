import { describe, expect, test } from "vitest";
import { codigoDeId, codigoServicoLivre, ETAPAS_PADRAO, mergeEmpresa, mudouPreco, normalizar } from "./estado";
import type { EstadoImportado, Servico } from "./tipos";

/** Estado como era gravado antes da agenda (contratos + numeração fixa, sem config). */
const estadoAntigo = {
  empresaAtivaId: "emp-1",
  novidadesVistoId: "2026-09-10-01",
  empresas: [
    {
      id: "emp-1",
      nome: "Studio",
      documento: "",
      telefone: "",
      email: "",
      site: "",
      endereco: "",
      logoDataUrl: "",
      corPrimaria: "#123456",
      moeda: "BRL",
      dadosBancarios: "Pix x",
      condicoesPadrao: "Sinal de 50%",
      clientes: [{ id: "c1", nome: "Ana", documento: "", telefone: "86999990000", email: "", endereco: "", observacoes: "" }],
      orcamentos: [
        {
          id: "o1",
          criadoEm: "2026-10-01",
          clienteId: "c1",
          data: "2026-10-01",
          validadeDias: 15,
          moeda: "BRL",
          itens: [{ id: "i1", descricao: "Ensaio", quantidade: 1, valorUnitario: 200 }],
          desconto: 0,
          descontoTipo: "valor",
          acrescimo: 0,
          condicoes: "",
          observacoes: "",
          status: "aprovado",
          pagamentos: [{ id: "p1", tipo: "sinal", valor: 80, data: "2026-10-02", forma: "Pix" }],
        },
        {
          id: "o2",
          criadoEm: "2026-10-05",
          clienteId: "c1",
          data: "2026-10-05",
          validadeDias: 15,
          moeda: "USD",
          itens: [],
          desconto: 0,
          descontoTipo: "valor",
          acrescimo: 0,
          condicoes: "",
          observacoes: "",
          status: "rascunho",
        },
      ],
      servicos: [
        { id: "s1", categoria: "Foto", nome: "Ensaio", descricao: "", valor: 200 },
        { id: "s2", categoria: "Foto", nome: "Evento", descricao: "", valor: 350 },
      ],
      prestador: { habilitado: true, nome: "Fulano", cpf: "", endereco: "", whatsapp: "", email: "", pix: "", modeloVersao: "v3" },
    },
  ],
} as unknown as EstadoImportado;

describe("normalizar — estado antigo", () => {
  const estado = normalizar(structuredClone(estadoAntigo))!;
  const e = estado.empresas[0];

  test("mantém tudo o que já existia", () => {
    expect(estado.empresaAtivaId).toBe("emp-1");
    expect(estado.novidadesVistoId).toBe("2026-09-10-01");
    expect(e.nome).toBe("Studio");
    expect(e.condicoesPadrao).toBe("Sinal de 50%");
    expect(e.clientes).toHaveLength(1);
    expect(e.orcamentos.map((o) => o.id)).toEqual(["o1", "o2"]);
    expect(e.orcamentos[0].pagamentos).toEqual([{ id: "p1", tipo: "sinal", valor: 80, data: "2026-10-02", forma: "Pix" }]);
    expect(e.orcamentos[1].moeda).toBe("USD");
    expect(e.prestador?.modeloVersao).toBe("v3");
  });

  test("numera orçamentos pela ordem atual", () => {
    expect(e.orcamentos.map((o) => o.numero)).toEqual([1, 2]);
    expect(e.proximoNumero).toBe(3);
  });

  test("ganha configuração padrão e agenda vazia", () => {
    expect(e.config.sinalPercentual).toBe(40);
    expect(e.config.validadeDias).toBe(15);
    expect(e.config.deslocamentos).toEqual([]);
    expect(e.config.etapasAgenda.map((x) => x.id)).toEqual(ETAPAS_PADRAO.map((x) => x.id));
    expect(e.config.versaoCatalogo).toBe(1);
    expect(e.config.codigo).toMatch(/^[2-9A-HJKMNP-Z]{5}$/);
    expect(e.config.urlTabelaEj).toBeUndefined();
    expect(e.agendamentos).toEqual([]);
  });

  test("serviços ganham código único e estável", () => {
    const codigos = e.servicos.map((s) => s.codigo);
    expect(new Set(codigos).size).toBe(2);
    // Abrir de novo (antes de gravar) dá os mesmos códigos: a [ref] não pode mudar.
    const outraVez = normalizar(structuredClone(estadoAntigo))!.empresas[0];
    expect(outraVez.config.codigo).toBe(e.config.codigo);
    expect(outraVez.servicos.map((s) => s.codigo)).toEqual(codigos);
  });

  test("normalizar duas vezes não muda nada (idempotente)", () => {
    expect(normalizar(structuredClone(estado))).toEqual(estado);
  });
});

describe("normalizar — backup antigo (v1, empresa única)", () => {
  const backupV1 = {
    empresa: { nome: "Antiga", moeda: "BRL" },
    clientes: [{ id: "c1", nome: "Bia", documento: "", telefone: "", email: "", endereco: "", observacoes: "" }],
    orcamentos: [
      {
        id: "o1",
        criadoEm: "2025-01-01",
        clienteId: "c1",
        data: "2025-01-01",
        validadeDias: 7,
        moeda: "BRL",
        itens: [{ id: "i1", descricao: "X", quantidade: 2, valorUnitario: 10 }],
        desconto: 0,
        descontoTipo: "valor",
        acrescimo: 0,
        condicoes: "",
        observacoes: "",
        status: "enviado",
      },
    ],
    servicos: [{ id: "s1", categoria: "", nome: "Y", descricao: "", valor: 5 }],
  } as unknown as EstadoImportado;

  test("vira estado multiempresa completo, sem perder dados", () => {
    const estado = normalizar(backupV1)!;
    expect(estado.empresas).toHaveLength(1);
    const e = estado.empresas[0];
    expect(estado.empresaAtivaId).toBe(e.id);
    expect(e.nome).toBe("Antiga");
    expect(e.clientes[0].nome).toBe("Bia");
    expect(e.orcamentos[0].numero).toBe(1);
    expect(e.orcamentos[0].itens[0].valorUnitario).toBe(10);
    expect(e.servicos[0].codigo).toBeTruthy();
    expect(e.config.sinalPercentual).toBe(40);
    expect(e.agendamentos).toEqual([]);
  });

  test("lixo não vira estado", () => {
    expect(normalizar(null)).toBeNull();
    expect(normalizar({} as EstadoImportado)).toBeNull();
    expect(normalizar("texto" as unknown as EstadoImportado)).toBeNull();
    expect(normalizar({ empresas: [] } as unknown as EstadoImportado)).toBeNull();
  });
});

describe("normalizar — campos novos com valores ruins", () => {
  test("config inválida volta ao padrão campo a campo", () => {
    const e = mergeEmpresa({
      id: "x",
      config: {
        sinalPercentual: 150,
        validadeDias: 0,
        deslocamentos: [{ id: "ate10", nome: "Até 10 km", valor: 0 }, { id: "ate10", nome: "dup", valor: 1 }, { nome: "sem id" }],
        etapasAgenda: [{ id: "cancelado", nome: "Cancelado" }],
        versaoCatalogo: -3,
        codigo: "o0",
        urlTabelaEj: "  https://ejfotografia.netlify.app  ",
      } as never,
    });
    expect(e.config.sinalPercentual).toBe(100);
    expect(e.config.validadeDias).toBe(15);
    expect(e.config.deslocamentos).toEqual([{ id: "ate10", nome: "Até 10 km", valor: 0 }]);
    expect(e.config.etapasAgenda.map((x) => x.id)).toEqual(ETAPAS_PADRAO.map((x) => x.id));
    expect(e.config.versaoCatalogo).toBe(1);
    expect(e.config.codigo).toMatch(/^[2-9A-HJKMNP-Z]{5}$/);
    expect(e.config.urlTabelaEj).toBe("https://ejfotografia.netlify.app");
  });

  test("config válida é mantida", () => {
    const etapas = [{ id: "a", nome: "A" }, { id: "b", nome: "B" }];
    const e = mergeEmpresa({
      id: "x",
      config: { sinalPercentual: 30, validadeDias: 10, deslocamentos: [], etapasAgenda: etapas, versaoCatalogo: 7, codigo: "ABCDE" },
    });
    expect(e.config).toMatchObject({ sinalPercentual: 30, validadeDias: 10, versaoCatalogo: 7, codigo: "ABCDE" });
    expect(e.config.etapasAgenda.map((x) => x.id)).toEqual(["a", "b"]);
  });

  test("agendamentos: descarta lixo e completa os campos", () => {
    const e = mergeEmpresa({
      id: "x",
      agendamentos: [
        { id: "a1", orcamentoId: "o1", criadoEm: "2026-11-01T10:00:00.000Z" },
        { id: "sem-orcamento" },
        "lixo",
      ] as never,
    });
    expect(e.agendamentos).toHaveLength(1);
    expect(e.agendamentos[0]).toMatchObject({
      id: "a1",
      orcamentoId: "o1",
      etapa: "recebido",
      historico: [{ etapa: "recebido", em: "2026-11-01T10:00:00.000Z" }],
      extras: [],
      notas: "",
      valorCombinado: null,
      sinalPercentual: 40,
      moeda: "BRL",
    });
  });

  test("código de serviço repetido é trocado; o primeiro fica", () => {
    const e = mergeEmpresa({
      id: "x",
      servicos: [
        { id: "s1", categoria: "", nome: "A", descricao: "", valor: 1, codigo: "ABC" },
        { id: "s2", categoria: "", nome: "B", descricao: "", valor: 1, codigo: "ABC" },
      ],
    });
    expect(e.servicos[0].codigo).toBe("ABC");
    expect(e.servicos[1].codigo).not.toBe("ABC");
  });
});

describe("códigos e versão do catálogo", () => {
  test("codigoDeId é determinístico e usa o alfabeto sem ambíguos", () => {
    expect(codigoDeId("abc", 5)).toBe(codigoDeId("abc", 5));
    expect(codigoDeId("abc", 5)).not.toBe(codigoDeId("abd", 5));
    for (let i = 0; i < 200; i++) expect(codigoDeId(`id-${i}`, 4)).toMatch(/^[2-9A-HJKMNP-Z]{4}$/);
  });

  test("codigoServicoLivre nunca repete um usado", () => {
    const usados = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const c = codigoServicoLivre(`s-${i}`, usados);
      expect(usados.has(c)).toBe(false);
      usados.add(c);
    }
  });

  test("mudouPreco só olha campos de preço", () => {
    const s: Servico = { id: "s", categoria: "", nome: "A", descricao: "", valor: 10 };
    expect(mudouPreco(s, { ...s, nome: "B", ativo: false })).toBe(false);
    expect(mudouPreco(s, { ...s, valor: 11 })).toBe(true);
    expect(mudouPreco(s, { ...s, precoVolume: 8, volumeMin: 10 })).toBe(true);
  });
});
