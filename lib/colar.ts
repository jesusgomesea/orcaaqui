// "Colar orçamento": lê a mensagem que o cliente devolveu, recalcula pela
// `[ref]` e transforma em orçamento aprovado + agendamento.
//
// Princípio herdado do painel do EJ: NUNCA confiar no total escrito. A conta
// sai da `[ref]` — `[ref ORC-…]` pelo catálogo da empresa, `[ref EJ-…]` pela
// API do site do EJ — e o total do texto só serve para avisar que foi editado.
// Mínimo não atingido (Personalizado do EJ) é pendência, não bloqueio.

import { novoAgendamento, totalDoOrcamento } from "./agenda";
import { extrairRefEj, itensDoRecalculoEj, type RecalculoEj } from "./ej";
import { decodificarRefOrc, itensDoCalculo, recalcularRefOrc, servicoContratoDosItens } from "./gerador";
import { formatarNumeroOrcamento, formatMoney, todayStr, uuid } from "./helpers";
import { acharClientePorTelefone, servicoContratoVazio } from "./orcamento";
import type { CodigoMoeda, Empresa, ItemOrcamento, OrigemOrcamento, ServicoContrato } from "./tipos";

/** Valor de uma linha com rótulo (`*Cliente:* Ana` ou `Cliente: Ana`), com ou sem asteriscos. */
export function campo(texto: string, rotulo: string): string {
  const re = new RegExp(`^\\s*\\*?${rotulo}:\\*?\\s*(.*)$`, "im");
  return texto.match(re)?.[1]?.trim() ?? "";
}

/** "R$ 1.234,56" → 1234.56; "a partir de R$ 80,00 + itens" → 80. */
export function lerMoeda(texto: string): number | null {
  // "150.50" digitado com ponto (teclado de celular) vira "150,50"; "1.500" continua milhar.
  if (/^\s*(R\$\s*)?\d+\.\d{1,2}\s*$/.test(texto)) texto = texto.replace(".", ",");
  const m = texto.match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?/);
  if (!m) return null;
  const inteiro = Number(m[1].replace(/\./g, ""));
  const centavos = m[2] ? Number(m[2].padEnd(2, "0")) / 100 : 0;
  return inteiro + centavos;
}

/** "20/12/2026 às 16:00" → { data: "2026-12-20", horario: "16:00" } */
export function lerDataBR(texto: string): { data: string; horario: string } {
  const m = texto.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  let data = "";
  if (m) {
    const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    const d = new Date(`${iso}T00:00:00Z`);
    if (!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso) data = iso;
  }
  return { data, horario: texto.match(/(\d{2}:\d{2})/)?.[1] ?? "" };
}

export type TipoRef = "ej" | "orc";

/** Qual `[ref]` o texto traz (a última manda). */
export function tipoDeRef(texto: string): TipoRef | null {
  const achados = [...texto.matchAll(/\[ref\s+(EJ|ORC)-/g)];
  if (!achados.length) return null;
  return achados[achados.length - 1][1] === "EJ" ? "ej" : "orc";
}

export interface LeituraColada {
  origem: Extract<OrigemOrcamento, "colado-ej" | "colado-orc">;
  codigoRef: string;
  /** Linha `[ref EJ-…]` (só nas mensagens do EJ). */
  refEj?: string;
  cliente: { nome: string; telefone: string };
  data: string;
  horario: string;
  local: string;
  observacoes: string;
  moeda: CodigoMoeda;
  itens: ItemOrcamento[];
  desconto: number;
  acrescimo: number;
  /** Total recalculado (o que vale). */
  total: number;
  /** Total escrito na mensagem; null = não havia. */
  totalNoTexto: number | null;
  sinalPercentual: number;
  /** Campos extras do contrato (pacote, prazo…), quando a origem traz. */
  servicoContrato: Partial<ServicoContrato>;
  /** Orçamento já salvo com o mesmo código (montado aqui no gerador). */
  existenteId: string | null;
  avisos: string[];
  pendencias: string[];
}

export type ResultadoColagem = { ok: true; leitura: LeituraColada } | { ok: false; erro: string };

function legiveis(texto: string) {
  const dataLegivel = lerDataBR(campo(texto, "Data desejada"));
  return {
    nome: campo(texto, "Cliente"),
    telefone: campo(texto, "WhatsApp"),
    local: campo(texto, "Local"),
    observacoes: campo(texto, "Observações"),
    totalNoTexto: lerMoeda(campo(texto, "Total")),
    data: dataLegivel.data,
    horario: dataLegivel.horario,
  };
}

function avisosComuns(l: LeituraColada, moeda: CodigoMoeda): string[] {
  const avisos: string[] = [];
  if (l.totalNoTexto !== null && Math.abs(l.totalNoTexto - l.total) >= 0.01) {
    avisos.push(
      `O total escrito na mensagem (${formatMoney(l.totalNoTexto, moeda)}) não bate com o recalculado (${formatMoney(l.total, moeda)}). Confira se o texto foi editado — vale o recalculado.`
    );
  }
  if (!l.cliente.nome) avisos.push("A mensagem não tem o nome do cliente.");
  return avisos;
}

/** Diferenças entre o recalculado e o orçamento salvo com o mesmo código. */
function compararComSalvo(l: LeituraColada, empresa: Empresa): string[] {
  const salvo = empresa.orcamentos.find((o) => o.id === l.existenteId);
  if (!salvo) return [];
  const moeda = salvo.moeda || empresa.moeda;
  const avisos: string[] = [];
  const totalSalvo = totalDoOrcamento(salvo);
  if (Math.abs(totalSalvo - l.total) >= 0.01) {
    avisos.push(
      `O orçamento salvo ${formatarNumeroOrcamento(salvo.numero)} tem total ${formatMoney(totalSalvo, moeda)}; o recalculado agora é ${formatMoney(l.total, moeda)}. Ao confirmar, os itens são atualizados.`
    );
  }
  const sc = salvo.servicoContrato;
  if (l.data && sc?.dataServico && sc.dataServico !== l.data) avisos.push(`A data mudou: salvo ${sc.dataServico}, na mensagem ${l.data}.`);
  return avisos;
}

/** Orçamento com o mesmo código: `ORC-0012` casa pelo número; `EJ-…` pelo `codigoRef`. */
function acharExistente(empresa: Empresa, codigo: string): string | null {
  const porRef = empresa.orcamentos.find((o) => o.codigoRef === codigo);
  if (porRef) return porRef.id;
  const n = /^ORC-(\d+)$/.exec(codigo)?.[1];
  return n ? empresa.orcamentos.find((o) => o.numero === Number(n))?.id ?? null : null;
}

/** Lê uma mensagem com `[ref ORC-…]` e recalcula pelo catálogo da empresa. */
export function lerColagemOrc(texto: string, empresa: Empresa): ResultadoColagem {
  const ref = decodificarRefOrc(texto);
  if (!ref) return { ok: false, erro: "A linha [ref ORC-…] está incompleta ou foi alterada." };
  const existenteId = acharExistente(empresa, ref.codigo);
  const salvo = empresa.orcamentos.find((o) => o.id === existenteId);
  const pct = salvo?.sinalPercentual ?? empresa.config.sinalPercentual;
  const r = recalcularRefOrc(ref, empresa, pct);
  if (!r.ok) return { ok: false, erro: r.erro };

  const leg = legiveis(texto);
  const moeda = salvo?.moeda || empresa.moeda;
  const leitura: LeituraColada = {
    origem: "colado-orc",
    codigoRef: ref.codigo,
    cliente: { nome: leg.nome, telefone: leg.telefone },
    // Data e horário: a [ref] é a fonte confiável; a linha legível é o plano B.
    data: ref.data || leg.data,
    horario: ref.horario || (ref.data ? "" : leg.horario),
    local: leg.local,
    observacoes: leg.observacoes,
    moeda,
    itens: itensDoCalculo(r.calculo, uuid),
    desconto: r.calculo.desconto,
    acrescimo: r.calculo.acrescimo,
    total: r.calculo.total,
    totalNoTexto: leg.totalNoTexto,
    sinalPercentual: pct,
    // Serviço, pacote, tempo, fotos e prazo para o contrato, pelos itens do catálogo.
    servicoContrato: servicoContratoDosItens(itensDoCalculo(r.calculo, () => ""), empresa.servicos),
    existenteId,
    avisos: [],
    pendencias: r.calculo.pendencias,
  };
  leitura.avisos = [...r.avisos.filter((a) => !r.calculo.pendencias.includes(a)), ...avisosComuns(leitura, moeda), ...compararComSalvo(leitura, empresa)];
  return { ok: true, leitura };
}

/** Lê uma mensagem com `[ref EJ-…]`; o recálculo vem da API do EJ (injetado, para testar sem rede). */
export async function lerColagemEj(
  texto: string,
  empresa: Empresa,
  recalcular: (linhaRef: string) => Promise<RecalculoEj>
): Promise<ResultadoColagem> {
  const linha = extrairRefEj(texto);
  if (!linha) return { ok: false, erro: "Não encontrei a linha [ref EJ-…]." };
  let r: RecalculoEj;
  try {
    r = await recalcular(linha);
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não foi possível recalcular pela tabela do EJ." };
  }
  if (!r.linhas.length) return { ok: false, erro: `O código do orçamento está incompleto: ${r.pendencias.join(" ")}` };

  const leg = legiveis(texto);
  const leitura: LeituraColada = {
    origem: "colado-ej",
    codigoRef: r.codigo,
    refEj: linha,
    cliente: { nome: leg.nome, telefone: leg.telefone },
    data: r.data || leg.data,
    horario: r.horario || (r.data ? "" : leg.horario),
    local: leg.local,
    observacoes: leg.observacoes,
    moeda: "BRL",
    itens: itensDoRecalculoEj(r, uuid),
    desconto: 0,
    acrescimo: 0,
    total: r.total,
    totalNoTexto: leg.totalNoTexto,
    sinalPercentual: r.sinalPercentual,
    servicoContrato: {
      servico: r.servico,
      ...(r.prazo ? { prazoEntrega: `${r.prazo.detalhe.charAt(0).toUpperCase()}${r.prazo.detalhe.slice(1)}` } : {}),
    },
    existenteId: acharExistente(empresa, r.codigo),
    avisos: [],
    pendencias: r.pendencias,
  };
  const versao =
    r.versaoRef !== r.versaoTabela
      ? [`Orçamento montado com a tabela v${r.versaoRef} do EJ; o valor já está pela atual (v${r.versaoTabela}).`]
      : [];
  leitura.avisos = [...versao, ...r.avisos.filter((a) => !versao.length || !/tabela v\d/.test(a)), ...avisosComuns(leitura, "BRL"), ...compararComSalvo(leitura, empresa)];
  return { ok: true, leitura };
}

export interface ResultadoAprovacao {
  empresa: Empresa;
  orcamentoId: string;
  agendamentoId: string;
  clienteNovo: boolean;
  orcamentoNovo: boolean;
}

/**
 * Aplica uma leitura colada: cliente (dedupe por telefone), orçamento APROVADO
 * (cria ou atualiza o de mesmo código) e agendamento (só se ainda não houver
 * um para esse orçamento). Pura: devolve a empresa nova.
 */
export function aprovarLeitura(empresa: Empresa, l: LeituraColada, agora: Date = new Date()): ResultadoAprovacao {
  let clientes = empresa.clientes;
  const salvo = empresa.orcamentos.find((o) => o.id === l.existenteId);
  let cliente =
    (salvo && clientes.find((c) => c.id === salvo.clienteId)) || acharClientePorTelefone(clientes, l.cliente.telefone);
  const clienteNovo = !cliente;
  if (!cliente) {
    cliente = {
      id: uuid(),
      nome: l.cliente.nome || "Cliente sem nome",
      documento: "",
      telefone: l.cliente.telefone,
      email: "",
      endereco: "",
      observacoes: "",
    };
    clientes = [...clientes, cliente];
  }

  const servicoContrato: ServicoContrato = {
    ...servicoContratoVazio(),
    ...salvo?.servicoContrato,
    ...l.servicoContrato,
    dataServico: l.data || salvo?.servicoContrato?.dataServico || "",
    horarioInicio: l.horario || salvo?.servicoContrato?.horarioInicio || "",
    local: l.local || salvo?.servicoContrato?.local || "",
  };
  const campos = {
    clienteId: cliente.id,
    itens: l.itens,
    desconto: l.desconto,
    descontoTipo: "valor" as const,
    acrescimo: l.acrescimo,
    status: "aprovado" as const,
    servicoContrato,
    codigoRef: l.codigoRef,
    ...(l.refEj ? { refEj: l.refEj } : {}),
    sinalPercentual: l.sinalPercentual,
    moeda: l.moeda,
  };

  let orcamentos = empresa.orcamentos;
  let proximoNumero = empresa.proximoNumero;
  let orcamentoId: string;
  if (salvo) {
    orcamentoId = salvo.id;
    orcamentos = orcamentos.map((o) =>
      o.id === salvo.id ? { ...o, ...campos, observacoes: l.observacoes || o.observacoes, origem: o.origem ?? l.origem } : o
    );
  } else {
    orcamentoId = uuid();
    orcamentos = [
      ...orcamentos,
      {
        id: orcamentoId,
        numero: proximoNumero,
        criadoEm: todayStr(),
        data: todayStr(),
        validadeDias: empresa.config.validadeDias,
        condicoes: empresa.condicoesPadrao || "",
        observacoes: l.observacoes,
        origem: l.origem,
        ...campos,
      },
    ];
    proximoNumero += 1;
  }

  const orcamento = orcamentos.find((o) => o.id === orcamentoId)!;
  let agendamentos = empresa.agendamentos;
  let agendamento = agendamentos.find((a) => a.orcamentoId === orcamentoId);
  if (!agendamento) {
    agendamento = novoAgendamento(orcamento, empresa, agora);
    agendamentos = [...agendamentos, agendamento];
  } else if (agendamento.clienteId !== cliente.id) {
    agendamentos = agendamentos.map((a) => (a.id === agendamento!.id ? { ...a, clienteId: cliente!.id } : a));
  }

  return {
    empresa: { ...empresa, clientes, orcamentos, proximoNumero, agendamentos },
    orcamentoId,
    agendamentoId: agendamento.id,
    clienteNovo,
    orcamentoNovo: !salvo,
  };
}

/** "Cliente aprovou → agendar": aprova o orçamento salvo e cria o agendamento (se ainda não houver). */
export function agendarOrcamento(
  empresa: Empresa,
  orcamentoId: string,
  agora: Date = new Date()
): { empresa: Empresa; agendamentoId: string; jaExistia: boolean } | null {
  const o = empresa.orcamentos.find((x) => x.id === orcamentoId);
  if (!o) return null;
  const orcamentos = empresa.orcamentos.map((x) =>
    x.id === orcamentoId
      ? { ...x, status: "aprovado" as const, sinalPercentual: x.sinalPercentual ?? empresa.config.sinalPercentual }
      : x
  );
  const existente = empresa.agendamentos.find((a) => a.orcamentoId === orcamentoId);
  if (existente) return { empresa: { ...empresa, orcamentos }, agendamentoId: existente.id, jaExistia: true };
  const a = novoAgendamento(orcamentos.find((x) => x.id === orcamentoId)!, empresa, agora);
  return { empresa: { ...empresa, orcamentos, agendamentos: [...empresa.agendamentos, a] }, agendamentoId: a.id, jaExistia: false };
}
