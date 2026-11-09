// Monta o dicionário de campos dos modelos .docx a partir dos dados do app e
// lista o que falta. O texto jurídico mora só nos modelos — aqui só há dados.

import type { Cliente, Orcamento, Pagamento, Prestador, TipoPagamento } from "../tipos";
import { calcOrcamentoTotais } from "../helpers";
import { dataPorExtenso, valorPorExtenso } from "./extenso";
import {
  calcularSinal,
  cpfValido,
  emailValido,
  formatarCpf,
  formatarData,
  formatarReais,
  formatarTelefone,
  paraCentavos,
  telefoneValido,
} from "./formatos";

export type Campos = Record<string, string>;

export interface Resultado {
  campos: Campos;
  /** Mensagens legíveis do que falta preencher; vazio = pode gerar. */
  faltando: string[];
}

export const RECIBO_TIPO_TEXTO: Record<TipoPagamento, string> = {
  sinal: "Sinal (40%) para reserva de data",
  restante: "Restante (60%) e quitação total",
  integral: "Pagamento integral",
};

export const PAGAMENTO_LABEL: Record<TipoPagamento, string> = {
  sinal: "Sinal (40%)",
  restante: "Restante (60%)",
  integral: "Integral",
};

const texto = (v: unknown) => String(v ?? "").trim();

/** Uma linha só: descrições de item podem ter quebras. */
const umaLinha = (v: unknown) => texto(v).replace(/\s*\n\s*/g, " ");

function exigir(faltando: string[], valor: string, rotulo: string) {
  if (!valor) faltando.push(rotulo);
}

function camposPrestador(p: Prestador | undefined, faltando: string[], completo: boolean): Campos {
  const nome = texto(p?.nome);
  const cpf = texto(p?.cpf);
  exigir(faltando, nome, "Nome completo do prestador (Empresa → Contratos e recibos)");
  if (!cpf) faltando.push("CPF do prestador");
  else if (!cpfValido(cpf)) faltando.push("CPF do prestador válido");

  const campos: Campos = { prestador_nome: nome, prestador_cpf: formatarCpf(cpf) };
  if (!completo) return campos;

  const endereco = texto(p?.endereco);
  const whatsapp = texto(p?.whatsapp);
  const email = texto(p?.email);
  const pix = texto(p?.pix);
  exigir(faltando, endereco, "Endereço do prestador");
  if (!whatsapp) faltando.push("WhatsApp do prestador");
  else if (!telefoneValido(whatsapp)) faltando.push("WhatsApp do prestador no formato (00) 00000-0000");
  if (!email) faltando.push("E-mail do prestador");
  else if (!emailValido(email)) faltando.push("E-mail do prestador válido");
  exigir(faltando, pix, "Chave Pix do prestador");
  exigir(faltando, texto(p?.modeloVersao), "Versão do modelo (Empresa → Contratos e recibos)");

  return {
    ...campos,
    prestador_endereco: endereco,
    prestador_whatsapp: formatarTelefone(whatsapp),
    prestador_email: email,
    prestador_pix: pix,
  };
}

function camposCliente(c: Cliente | undefined, faltando: string[], completo: boolean): Campos {
  if (!c) {
    faltando.push("Cliente do orçamento (foi removido ou não está selecionado)");
    return {};
  }
  const nome = texto(c.nome);
  const cpf = texto(c.documento);
  exigir(faltando, nome, "Nome completo do cliente");
  if (!cpf) faltando.push("CPF do cliente");
  else if (!cpfValido(cpf)) faltando.push("CPF do cliente válido (campo CPF/CNPJ do cadastro)");

  const campos: Campos = { cliente_nome: nome, cliente_cpf: formatarCpf(cpf) };
  if (!completo) return campos;

  const endereco = texto(c.endereco);
  const whatsapp = texto(c.telefone);
  const email = texto(c.email);
  exigir(faltando, endereco, "Endereço do cliente");
  if (!whatsapp) faltando.push("WhatsApp do cliente");
  else if (!telefoneValido(whatsapp)) faltando.push("WhatsApp do cliente no formato (00) 00000-0000");
  if (!email) faltando.push("E-mail do cliente");
  else if (!emailValido(email)) faltando.push("E-mail do cliente válido");

  return {
    ...campos,
    cliente_endereco: endereco,
    cliente_whatsapp: formatarTelefone(whatsapp),
    cliente_email: email,
  };
}

function totalDoOrcamento(o: Orcamento): number {
  return calcOrcamentoTotais(o.itens, o.desconto, o.descontoTipo, o.acrescimo).total;
}

function checarMoeda(o: Orcamento, faltando: string[]) {
  if (o.moeda && o.moeda !== "BRL") faltando.push("Moeda do orçamento em Real (R$) — contratos e recibos são em reais");
}

/** Campos de serviço comuns a contrato e recibo. */
function camposServicoBasico(o: Orcamento, faltando: string[]): Campos {
  const s = o.servicoContrato;
  const servico = texto(s?.servico);
  const pacote = texto(s?.pacote);
  const data = formatarData(texto(s?.dataServico));
  exigir(faltando, servico, "Serviço (Dados do serviço no orçamento)");
  exigir(faltando, pacote, "Pacote");
  exigir(faltando, data, "Data do serviço");
  return { servico, pacote, data_servico: data };
}

export function listarAdicionais(o: Orcamento): string {
  const adicionais = (o.itens || [])
    .filter((it) => it.tipo === "adicional" && umaLinha(it.descricao))
    .map((it) => `${umaLinha(it.descricao)} — ${formatarReais((Number(it.quantidade) || 0) * (Number(it.valorUnitario) || 0))}`);
  return adicionais.length ? adicionais.join("; ") : "Nenhum";
}

function plural(n: number, singular: string, pluralTxt: string) {
  return `${n} ${n === 1 ? singular : pluralTxt}`;
}

export interface EntradaContrato {
  prestador: Prestador | undefined;
  cliente: Cliente | undefined;
  orcamento: Orcamento;
  /** NNN/AAAA */
  numero: string;
  /** YYYY-MM-DD da geração */
  dataGeracao: string;
}

export function montarCamposContrato(e: EntradaContrato): Resultado {
  const faltando: string[] = [];
  const { orcamento: o } = e;

  if (o.status !== "aprovado") faltando.push("Orçamento com status Aprovado");
  checarMoeda(o, faltando);

  const prestador = camposPrestador(e.prestador, faltando, true);
  const cliente = camposCliente(e.cliente, faltando, true);
  const basico = camposServicoBasico(o, faltando);

  const s = o.servicoContrato;
  const horarioInicio = texto(s?.horarioInicio);
  const horarioFim = texto(s?.horarioFim);
  const local = texto(s?.local);
  const prazo = texto(s?.prazoEntrega);
  if (!horarioInicio) faltando.push("Horário de início");
  else if (!/^\d{2}:\d{2}$/.test(horarioInicio)) faltando.push("Horário de início no formato HH:MM");
  if (horarioFim && !/^\d{2}:\d{2}$/.test(horarioFim)) faltando.push("Horário de término no formato HH:MM");
  exigir(faltando, local, "Local do serviço");
  exigir(faltando, prazo, "Prazo de entrega");

  let tempoCampo: string;
  let fotos: string;
  let resumo: string;
  if (s?.personalizado) {
    const horas = Number(s.personalizadoHoras) || 0;
    const qtdFotos = Number(s.personalizadoFotos) || 0;
    if (horas <= 0) faltando.push("Horas do pacote Personalizado");
    if (qtdFotos <= 0) faltando.push("Quantidade de fotos do pacote Personalizado");
    const horasTxt = String(horas).replace(".", ",");
    tempoCampo = horas > 0 ? `${horasTxt}h` : "";
    fotos = qtdFotos > 0 ? String(qtdFotos) : "";
    resumo = `${horas === 1 ? "1 hora" : `${horasTxt} horas`} · ${plural(qtdFotos, "foto", "fotos")}`;
  } else {
    tempoCampo = texto(s?.tempoCampo);
    fotos = texto(s?.fotosEditadas);
    exigir(faltando, tempoCampo, "Tempo em campo");
    exigir(faltando, fotos, "Fotos editadas (faixa do pacote)");
    resumo = "—";
  }

  const total = totalDoOrcamento(o);
  if (paraCentavos(total) <= 0) faltando.push("Valor total do orçamento maior que zero");
  const { sinal, restante } = calcularSinal(total);

  exigir(faltando, texto(e.numero), "Número do contrato");
  exigir(faltando, texto(e.dataGeracao), "Data do contrato");

  const campos: Campos = {
    ...prestador,
    ...cliente,
    ...basico,
    horario_inicio: horarioInicio,
    horario_fim: horarioFim || "—",
    local,
    tempo_campo: tempoCampo,
    fotos_editadas: fotos,
    personalizado_resumo: resumo,
    adicionais: listarAdicionais(o),
    prazo_entrega: prazo,
    valor_total: formatarReais(total),
    valor_sinal: formatarReais(sinal),
    valor_restante: formatarReais(restante),
    contrato_numero: texto(e.numero),
    modelo_versao: texto(e.prestador?.modeloVersao),
    data_contrato_extenso: dataPorExtenso(e.dataGeracao),
  };
  return { campos, faltando: [...new Set(faltando)] };
}

/**
 * Soma dos pagamentos até este (inclusive), em ordem de data e de registro —
 * regerar o recibo do sinal depois de lançado o restante não conta o restante.
 */
export function totalPagoAte(pagamentos: Pagamento[], pagamentoId: string): number {
  const ordenados = pagamentos
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (a.p.data === b.p.data ? a.i - b.i : a.p.data < b.p.data ? -1 : 1));
  let centavos = 0;
  for (const { p } of ordenados) {
    centavos += paraCentavos(p.valor);
    if (p.id === pagamentoId) break;
  }
  return centavos / 100;
}

/** Valor sugerido ao registrar um pagamento de cada tipo. */
export function valorSugerido(o: Orcamento, tipo: TipoPagamento): number {
  const total = totalDoOrcamento(o);
  if (tipo === "integral") return total;
  if (tipo === "sinal") return calcularSinal(total).sinal;
  const pago = (o.pagamentos || []).reduce((s, p) => s + paraCentavos(p.valor), 0) / 100;
  return Math.max(0, (paraCentavos(total) - paraCentavos(pago)) / 100);
}

export interface EntradaRecibo {
  prestador: Prestador | undefined;
  cliente: Cliente | undefined;
  orcamento: Orcamento;
  pagamentoId: string;
  /** Contrato mais recente do orçamento; null = ainda não gerado. */
  contrato: { numero: string; dataGeracao: string } | null;
  /** NNN/AAAA */
  numero: string;
}

export function montarCamposRecibo(e: EntradaRecibo): Resultado {
  const faltando: string[] = [];
  const { orcamento: o } = e;
  const pagamentos = o.pagamentos || [];
  const pagamento = pagamentos.find((p) => p.id === e.pagamentoId);

  checarMoeda(o, faltando);
  if (!pagamento) faltando.push("Pagamento registrado no orçamento");
  if (!e.contrato) faltando.push("Contrato gerado para este orçamento (o recibo cita o número do contrato)");

  const prestador = camposPrestador(e.prestador, faltando, false);
  const cliente = camposCliente(e.cliente, faltando, false);
  const basico = camposServicoBasico(o, faltando);

  const valor = Number(pagamento?.valor) || 0;
  if (pagamento && paraCentavos(valor) <= 0) faltando.push("Valor do pagamento maior que zero");
  const forma = texto(pagamento?.forma);
  if (pagamento) exigir(faltando, forma, "Forma de pagamento");
  const dataRecibo = texto(pagamento?.data);
  if (pagamento) exigir(faltando, formatarData(dataRecibo), "Data do pagamento");

  const total = totalDoOrcamento(o);
  const pago = pagamento ? totalPagoAte(pagamentos, pagamento.id) : 0;
  const saldo = Math.max(0, (paraCentavos(total) - paraCentavos(pago)) / 100);

  exigir(faltando, texto(e.numero), "Número do recibo");

  const campos: Campos = {
    ...prestador,
    ...cliente,
    ...basico,
    recibo_numero: texto(e.numero),
    recibo_tipo: pagamento ? RECIBO_TIPO_TEXTO[pagamento.tipo] ?? "" : "",
    recibo_valor: formatarReais(valor),
    recibo_valor_extenso: valorPorExtenso(valor),
    total_pago: formatarReais(pago),
    saldo_restante: formatarReais(saldo),
    forma_pagamento: forma,
    valor_total: formatarReais(total),
    contrato_numero: e.contrato?.numero ?? "",
    data_contrato: formatarData(e.contrato?.dataGeracao ?? ""),
    data_recibo_extenso: dataPorExtenso(dataRecibo),
  };
  return { campos, faltando: [...new Set(faltando)] };
}
