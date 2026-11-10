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
  motivoCpfInvalido,
  paraCentavos,
  telefoneValido,
} from "./formatos";

export type Campos = Record<string, string>;

export interface Resultado {
  campos: Campos;
  /** Mensagens legíveis do que falta preencher; vazio = pode gerar. */
  faltando: string[];
}

/** Texto do modelo de recibo. `outro` (pós-venda) fica de fora: o modelo não tem texto para ele. */
export const RECIBO_TIPO_TEXTO: Record<Exclude<TipoPagamento, "outro">, string> = {
  sinal: "Sinal (40%) para reserva de data",
  restante: "Restante (60%) e quitação total",
  integral: "Pagamento integral",
};

export const PAGAMENTO_LABEL: Record<TipoPagamento, string> = {
  sinal: "Sinal (40%)",
  restante: "Restante (60%)",
  integral: "Integral",
  outro: "Outro",
};

/**
 * O modelo de contrato traz "Sinal (40%)" e "Restante (60%)" escritos (cláusula
 * 2.1), e o texto jurídico não é editado por aqui. Sinal diferente geraria um
 * contrato que se contradiz — então a geração é bloqueada.
 */
export const SINAL_DO_MODELO = 40;

const texto = (v: unknown) => String(v ?? "").trim();

/**
 * Texto para campo opcional deixado em branco. O contrato só exige serviço,
 * CPF e e-mail do cliente (além dos dados do prestador); o resto sai assim.
 */
export const A_COMBINAR = "a combinar";
export const NAO_INFORMADO = "não informado";
const ouACombinar = (v: string) => v || A_COMBINAR;

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
  else if (!cpfValido(cpf)) faltando.push(`CPF do prestador válido (${motivoCpfInvalido(cpf)})`);

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
  else if (!cpfValido(cpf)) faltando.push(`CPF do cliente válido (${motivoCpfInvalido(cpf)})`);

  const campos: Campos = { cliente_nome: nome, cliente_cpf: formatarCpf(cpf) };
  if (!completo) return campos;

  // Do cliente, o contrato exige só CPF e e-mail; endereço e WhatsApp são opcionais.
  const endereco = texto(c.endereco);
  const whatsapp = texto(c.telefone);
  const email = texto(c.email);
  if (!email) faltando.push("E-mail do cliente");
  else if (!emailValido(email)) faltando.push("E-mail do cliente válido");

  return {
    ...campos,
    cliente_endereco: endereco || NAO_INFORMADO,
    cliente_whatsapp: !whatsapp ? NAO_INFORMADO : telefoneValido(whatsapp) ? formatarTelefone(whatsapp) : whatsapp,
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
  // Só o serviço é obrigatório; pacote e data em branco saem "a combinar".
  exigir(faltando, servico, "Serviço (Dados do serviço no orçamento)");
  return { servico, pacote: ouACombinar(pacote), data_servico: data || `data ${A_COMBINAR}` };
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
  /** % do sinal combinado no orçamento; ausente = 40. */
  sinalPercentual?: number;
}

export function montarCamposContrato(e: EntradaContrato): Resultado {
  const faltando: string[] = [];
  const { orcamento: o } = e;

  if (o.status !== "aprovado") faltando.push("Orçamento com status Aprovado");
  const pct = e.sinalPercentual ?? SINAL_DO_MODELO;
  if (pct !== SINAL_DO_MODELO) {
    faltando.push(
      `Sinal de ${SINAL_DO_MODELO}% — o modelo de contrato traz esse percentual escrito, e este orçamento usa ${String(pct).replace(".", ",")}%`
    );
  }
  checarMoeda(o, faltando);

  const prestador = camposPrestador(e.prestador, faltando, true);
  const cliente = camposCliente(e.cliente, faltando, true);
  const basico = camposServicoBasico(o, faltando);

  const s = o.servicoContrato;
  // Horário, local, prazo, tempo e fotos são opcionais: em branco saem "a combinar"
  // (o horário, que o modelo escreve "das … às …", sai "—").
  const horarioInicio = texto(s?.horarioInicio);
  const horarioFim = texto(s?.horarioFim);
  const local = texto(s?.local);
  const prazo = texto(s?.prazoEntrega);

  let tempoCampo: string;
  let fotos: string;
  let resumo: string;
  if (s?.personalizado) {
    const horas = Number(s.personalizadoHoras) || 0;
    const qtdFotos = Number(s.personalizadoFotos) || 0;
    const horasTxt = String(horas).replace(".", ",");
    tempoCampo = horas > 0 ? `${horasTxt}h` : A_COMBINAR;
    fotos = qtdFotos > 0 ? String(qtdFotos) : A_COMBINAR;
    resumo = [
      horas > 0 ? (horas === 1 ? "1 hora" : `${horasTxt} horas`) : `horas ${A_COMBINAR}`,
      qtdFotos > 0 ? plural(qtdFotos, "foto", "fotos") : `fotos ${A_COMBINAR}`,
    ].join(" · ");
  } else {
    tempoCampo = ouACombinar(texto(s?.tempoCampo));
    fotos = ouACombinar(texto(s?.fotosEditadas));
    resumo = "—";
  }

  // Valor zero é permitido (ex.: parceria só com contrapartidas); negativo não.
  const total = totalDoOrcamento(o);
  if (paraCentavos(total) < 0) faltando.push("Valor total do orçamento não pode ser negativo");
  const { sinal, restante } = calcularSinal(total, SINAL_DO_MODELO);

  exigir(faltando, texto(e.numero), "Número do contrato");
  exigir(faltando, texto(e.dataGeracao), "Data do contrato");

  const campos: Campos = {
    ...prestador,
    ...cliente,
    ...basico,
    horario_inicio: horarioInicio || "—",
    horario_fim: horarioFim || "—",
    local: ouACombinar(local),
    tempo_campo: tempoCampo,
    fotos_editadas: fotos,
    personalizado_resumo: resumo,
    adicionais: listarAdicionais(o),
    prazo_entrega: ouACombinar(prazo),
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
export function valorSugerido(o: Orcamento, tipo: TipoPagamento, sinalPercentual = SINAL_DO_MODELO): number {
  const total = totalDoOrcamento(o);
  if (tipo === "outro") return 0;
  if (tipo === "integral") return total;
  if (tipo === "sinal") return calcularSinal(total, sinalPercentual).sinal;
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
  if (pagamento?.tipo === "outro") faltando.push("Pagamento do tipo sinal, restante ou integral (o modelo de recibo não cobre outros)");
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
    recibo_tipo: pagamento && pagamento.tipo !== "outro" ? RECIBO_TIPO_TEXTO[pagamento.tipo] : "",
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
