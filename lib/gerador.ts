// Gerador de orçamento do prestador ("Montar orçamento"): preço pelo catálogo
// da empresa, totais com sinal e restante, a linha `[ref ORC-…]` e a mensagem
// do WhatsApp. Puro, coberto por lib/gerador.test.ts.
//
// Princípio herdado do painel do EJ: quem recebe a mensagem de volta NUNCA
// confia no total escrito — recalcula pela `[ref]` (ver `recalcularRefOrc`).

import { addDaysStr, formatDateBR, formatMoney } from "./helpers";
import { calcularSinal, paraCentavos } from "./documentos/formatos";
import type { CodigoMoeda, ConfigEmpresa, Empresa, ItemOrcamento, Orcamento, Servico, UnidadeServico } from "./tipos";

export const UNIDADES: { id: UnidadeServico; nome: string }[] = [
  { id: "un", nome: "Unidade" },
  { id: "hora", nome: "Hora" },
  { id: "foto", nome: "Foto" },
  { id: "dia", nome: "Dia" },
  { id: "km", nome: "Km" },
];

export function nomeUnidade(u: UnidadeServico | undefined): string {
  return UNIDADES.find((x) => x.id === (u ?? "un"))?.nome.toLowerCase() ?? "unidade";
}

export interface ItemSelecionado {
  servicoId: string;
  quantidade: number;
}

export interface SelecaoGerador {
  itens: ItemSelecionado[];
  /** Desconto em valor (moeda do orçamento). */
  desconto: number;
  acrescimo: number;
  /** Id de `config.deslocamentos`; "" = sem deslocamento. */
  deslocamentoId: string;
}

export function selecaoVazia(): SelecaoGerador {
  return { itens: [], desconto: 0, acrescimo: 0, deslocamentoId: "" };
}

export interface LinhaGerador {
  servicoId?: string;
  deslocamentoId?: string;
  descricao: string;
  quantidade: number;
  unitario: number;
  valor: number;
  /** O preço por volume foi aplicado nesta linha. */
  volume: boolean;
}

export interface CalculoGerador {
  linhas: LinhaGerador[];
  subtotal: number;
  desconto: number;
  acrescimo: number;
  total: number;
  sinalPercentual: number;
  sinal: number;
  restante: number;
  /** Prazos dos serviços escolhidos, sem repetição. */
  prazos: string[];
  pendencias: string[];
}

const cent = paraCentavos;

/** Preço unitário com desconto por volume: a partir de `volumeMin`, TODAS as unidades saem por `precoVolume`. */
export function precoUnitario(servico: Pick<Servico, "valor" | "precoVolume" | "volumeMin">, quantidade: number): {
  unitario: number;
  volume: boolean;
} {
  const { precoVolume, volumeMin } = servico;
  if (
    typeof precoVolume === "number" &&
    typeof volumeMin === "number" &&
    volumeMin > 0 &&
    quantidade >= volumeMin &&
    precoVolume < servico.valor
  ) {
    return { unitario: precoVolume, volume: true };
  }
  return { unitario: Number(servico.valor) || 0, volume: false };
}

export function calcularGerador(
  sel: SelecaoGerador,
  servicos: Servico[],
  config: Pick<ConfigEmpresa, "deslocamentos">,
  sinalPercentual: number
): CalculoGerador {
  const linhas: LinhaGerador[] = [];
  const pendencias: string[] = [];
  const prazos: string[] = [];

  for (const it of sel.itens) {
    const qtd = Math.max(0, Math.floor(Number(it.quantidade) || 0));
    if (!qtd) continue;
    const s = servicos.find((x) => x.id === it.servicoId);
    if (!s) {
      pendencias.push("Um serviço escolhido não existe mais no catálogo.");
      continue;
    }
    const { unitario, volume } = precoUnitario(s, qtd);
    linhas.push({
      servicoId: s.id,
      descricao: s.nome,
      quantidade: qtd,
      unitario,
      valor: (cent(unitario) * qtd) / 100,
      volume,
    });
    if (s.prazo?.trim() && !prazos.includes(s.prazo.trim())) prazos.push(s.prazo.trim());
  }

  if (sel.deslocamentoId) {
    const d = config.deslocamentos.find((x) => x.id === sel.deslocamentoId);
    if (d) {
      linhas.push({
        deslocamentoId: d.id,
        descricao: `Deslocamento (${d.nome})`,
        quantidade: 1,
        unitario: d.valor,
        valor: d.valor,
        volume: false,
      });
    } else {
      pendencias.push("A faixa de deslocamento escolhida não existe mais.");
    }
  }

  if (!linhas.some((l) => l.servicoId)) pendencias.push("Escolha ao menos um serviço.");

  const subtotalC = linhas.reduce((s, l) => s + cent(l.valor), 0);
  const descontoC = Math.max(0, cent(sel.desconto));
  const acrescimoC = Math.max(0, cent(sel.acrescimo));
  const totalC = Math.max(0, subtotalC - descontoC + acrescimoC);
  const { sinal, restante } = calcularSinal(totalC / 100, sinalPercentual);

  return {
    linhas,
    subtotal: subtotalC / 100,
    desconto: descontoC / 100,
    acrescimo: acrescimoC / 100,
    total: totalC / 100,
    sinalPercentual,
    sinal,
    restante,
    prazos,
    pendencias,
  };
}

/** Itens do orçamento oficial a partir do cálculo (deslocamento entra como adicional, para o contrato). */
export function itensDoCalculo(calc: CalculoGerador, novoId: () => string): ItemOrcamento[] {
  return calc.linhas.map((l) => ({
    id: novoId(),
    descricao: l.descricao,
    quantidade: l.quantidade,
    valorUnitario: l.unitario,
    ...(l.servicoId ? { servicoId: l.servicoId } : {}),
    ...(l.deslocamentoId ? { deslocamentoId: l.deslocamentoId, tipo: "adicional" as const } : {}),
  }));
}

/**
 * Seleção do gerador a partir de um orçamento salvo (para reabrir no montador).
 * null = o orçamento tem item livre, fora do catálogo — só o formulário livre edita.
 */
export function selecaoDoOrcamento(o: Orcamento): SelecaoGerador | null {
  const itens = o.itens.filter((it) => it.descricao.trim() || it.valorUnitario);
  if (!itens.length || itens.some((it) => !it.servicoId && !it.deslocamentoId)) return null;
  if (o.descontoTipo === "percentual" && o.desconto) return null;
  return {
    itens: itens.filter((it) => it.servicoId).map((it) => ({ servicoId: it.servicoId!, quantidade: it.quantidade })),
    desconto: o.desconto || 0,
    acrescimo: o.acrescimo || 0,
    deslocamentoId: itens.find((it) => it.deslocamentoId)?.deslocamentoId ?? "",
  };
}

// ---------- linha [ref ORC-…] ----------

export interface RefOrc {
  /** ORC-0012 */
  codigo: string;
  /** Código curto da empresa (`config.codigo`). */
  empresa: string;
  /** `config.versaoCatalogo` quando a mensagem foi gerada. */
  versao: number;
  /** Por código curto do serviço (`Servico.codigo`). */
  itens: { codigo: string; quantidade: number }[];
  desconto: number;
  acrescimo: number;
  deslocamentoId: string;
  /** AAAA-MM-DD ou "" */
  data: string;
  /** HH:MM ou "" */
  horario: string;
}

const numeroRef = (n: number) => String(Math.round(n * 100) / 100);

export function codificarRefOrc(r: RefOrc): string {
  const partes = [r.codigo, `e=${r.empresa}`, `v${r.versao}`];
  const itens = r.itens.filter((i) => i.quantidade > 0).map((i) => `${i.codigo}:${i.quantidade}`);
  if (itens.length) partes.push(`i=${itens.join(",")}`);
  if (r.desconto > 0) partes.push(`d=${numeroRef(r.desconto)}`);
  if (r.acrescimo > 0) partes.push(`a=${numeroRef(r.acrescimo)}`);
  if (r.deslocamentoId) partes.push(`ds=${r.deslocamentoId}`);
  if (r.data) partes.push(`dt=${r.data}`);
  if (r.horario) partes.push(`hr=${r.horario}`);
  return `[ref ${partes.join(" ")}]`;
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Lê a última linha `[ref ORC-…]` de um texto (a mensagem inteira pode ser colada). */
export function decodificarRefOrc(texto: string): RefOrc | null {
  const achados = [...texto.matchAll(/\[ref\s+(ORC-[^\]\n]+)\]/g)];
  if (!achados.length) return null;
  const [codigo, ...resto] = achados[achados.length - 1][1].trim().split(/\s+/);
  if (!/^ORC-\d{4,}$/.test(codigo)) return null;

  const mapa = new Map<string, string>();
  let versao = NaN;
  for (const p of resto) {
    if (/^v\d+$/.test(p)) versao = Number(p.slice(1));
    const i = p.indexOf("=");
    if (i > 0) mapa.set(p.slice(0, i), p.slice(i + 1));
  }
  const empresa = mapa.get("e") ?? "";
  if (!empresa || !Number.isFinite(versao)) return null;

  const itens: RefOrc["itens"] = [];
  for (const par of (mapa.get("i") ?? "").split(",").filter(Boolean)) {
    const [c, q] = par.split(":");
    const quantidade = Number(q);
    if (c && Number.isInteger(quantidade) && quantidade > 0 && quantidade <= 99999) itens.push({ codigo: c, quantidade });
  }
  const valor = (k: string) => {
    const n = Number(mapa.get(k) ?? 0);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const data = mapa.get("dt") ?? "";
  const horario = mapa.get("hr") ?? "";
  return {
    codigo,
    empresa,
    versao,
    itens,
    desconto: valor("d"),
    acrescimo: valor("a"),
    deslocamentoId: mapa.get("ds") ?? "",
    data: DATA_ISO.test(data) ? data : "",
    horario: /^\d{2}:\d{2}$/.test(horario) ? horario : "",
  };
}

/** A `[ref]` de uma seleção, com os códigos curtos dos serviços. */
export function refDaSelecao(
  sel: SelecaoGerador,
  dados: { codigo: string; data: string; horario: string },
  empresa: Pick<Empresa, "servicos" | "config">
): RefOrc {
  return {
    codigo: dados.codigo,
    empresa: empresa.config.codigo,
    versao: empresa.config.versaoCatalogo,
    itens: sel.itens
      .map((i) => ({ codigo: empresa.servicos.find((s) => s.id === i.servicoId)?.codigo ?? "", quantidade: i.quantidade }))
      .filter((i) => i.codigo && i.quantidade > 0),
    desconto: sel.desconto,
    acrescimo: sel.acrescimo,
    deslocamentoId: sel.deslocamentoId,
    data: dados.data,
    horario: dados.horario,
  };
}

export type ResultadoRefOrc =
  | { ok: true; selecao: SelecaoGerador; calculo: CalculoGerador; avisos: string[] }
  | { ok: false; erro: string };

/**
 * Recalcula uma `[ref ORC-…]` pelo catálogo ATUAL da empresa. Versão antiga e
 * empresa diferente viram aviso (não bloqueiam); serviço que sumiu do catálogo
 * impede o cálculo.
 */
export function recalcularRefOrc(
  ref: RefOrc,
  empresa: Pick<Empresa, "servicos" | "config">,
  sinalPercentual: number
): ResultadoRefOrc {
  const itens: ItemSelecionado[] = [];
  for (const i of ref.itens) {
    const s = empresa.servicos.find((x) => x.codigo === i.codigo);
    if (!s) return { ok: false, erro: `O serviço de código ${i.codigo} não existe mais no catálogo desta empresa.` };
    itens.push({ servicoId: s.id, quantidade: i.quantidade });
  }
  if (!itens.length) return { ok: false, erro: "A linha [ref] não tem nenhum serviço." };

  const avisos: string[] = [];
  if (ref.empresa !== empresa.config.codigo) {
    avisos.push(`Este orçamento foi gerado por outra empresa (código ${ref.empresa}); o valor abaixo usa o catálogo da empresa atual.`);
  }
  if (ref.versao !== empresa.config.versaoCatalogo) {
    avisos.push(
      `Orçamento gerado com a versão ${ref.versao} do catálogo; a atual é ${empresa.config.versaoCatalogo}. O valor abaixo já está pelos preços atuais.`
    );
  }
  const desl = ref.deslocamentoId;
  if (desl && !empresa.config.deslocamentos.some((d) => d.id === desl)) {
    avisos.push(`A faixa de deslocamento "${desl}" não existe mais e ficou de fora do cálculo.`);
  }

  const selecao: SelecaoGerador = {
    itens,
    desconto: ref.desconto,
    acrescimo: ref.acrescimo,
    deslocamentoId: empresa.config.deslocamentos.some((d) => d.id === desl) ? desl : "",
  };
  const calculo = calcularGerador(selecao, empresa.servicos, empresa.config, sinalPercentual);
  return { ok: true, selecao, calculo, avisos: [...avisos, ...calculo.pendencias] };
}

// ---------- mensagem do WhatsApp ----------

/** Texto livre vira uma linha só, sem `[`, `]` e `*` (não confunde as linhas com rótulo nem a `[ref]`). */
export function limparLivre(texto: string): string {
  return texto.replace(/[\r\n]+/g, " ").replace(/[[\]*]/g, "").replace(/\s{2,}/g, " ").trim();
}

export interface DadosMensagem {
  codigo: string;
  empresaNome: string;
  moeda: CodigoMoeda;
  cliente: { nome: string; telefone: string };
  data: string;
  horario: string;
  local: string;
  observacoes: string;
  /** AAAA-MM-DD de emissão. */
  emitidoEm: string;
  validadeDias: number;
  ref: RefOrc;
}

/**
 * Mensagem do gerador. Os rótulos (`*Cliente:*`, `*WhatsApp:*`, `*Serviço:*`,
 * `*Data desejada:*`, `*Local:*`, `*Total:*`, `*Observações:*`) são os mesmos
 * do site do EJ: a mesma leitura serve para as duas origens ao colar.
 */
export function gerarMensagemOrcamento(calc: CalculoGerador, m: DadosMensagem): string {
  const $ = (v: number) => formatMoney(v, m.moeda);
  const l: string[] = [];
  l.push(`📋 *Orçamento ${m.codigo}*${m.empresaNome ? ` — ${limparLivre(m.empresaNome)}` : ""}`, "");
  l.push(`*Cliente:* ${limparLivre(m.cliente.nome)}`);
  if (m.cliente.telefone.trim()) l.push(`*WhatsApp:* ${limparLivre(m.cliente.telefone)}`);
  const servicos = calc.linhas.filter((x) => x.servicoId).map((x) => x.descricao);
  if (servicos.length) l.push(`*Serviço:* ${limparLivre(servicos.join(" + "))}`);
  l.push(m.data ? `*Data desejada:* ${formatDateBR(m.data)}${m.horario ? ` às ${m.horario}` : ""}` : "*Data desejada:* a definir");
  if (m.local.trim()) l.push(`*Local:* ${limparLivre(m.local)}`);

  l.push("", "*Itens*");
  for (const it of calc.linhas.filter((x) => x.servicoId)) {
    const qtd = it.quantidade > 1 ? ` × ${it.quantidade}` : "";
    const cada = it.quantidade > 1 ? ` (${$(it.unitario)} cada${it.volume ? ", preço por volume" : ""})` : "";
    l.push(`• ${limparLivre(it.descricao)}${qtd} — ${$(it.valor)}${cada}`);
  }

  const desl = calc.linhas.find((x) => x.deslocamentoId);
  const extras: string[] = [];
  if (desl) {
    const faixa = desl.descricao.replace(/^Deslocamento \((.*)\)$/, "$1");
    extras.push(`*Deslocamento:* ${limparLivre(faixa)} — ${desl.valor > 0 ? $(desl.valor) : "sem custo"}`);
  }
  if (calc.desconto > 0) extras.push(`*Desconto:* −${$(calc.desconto)}`);
  if (calc.acrescimo > 0) extras.push(`*Acréscimo:* ${$(calc.acrescimo)}`);
  if (calc.prazos.length) extras.push(`*Prazo de entrega:* ${limparLivre(calc.prazos.join(" · "))}`);
  if (extras.length) l.push("", ...extras);

  l.push("");
  l.push(`*Total:* ${$(calc.total)}`);
  if (calc.sinal > 0) {
    l.push(`*Sinal (${String(calc.sinalPercentual).replace(".", ",")}%):* ${$(calc.sinal)} — reserva a data`);
    l.push(`*Restante:* ${$(calc.restante)} — até o dia do serviço`);
  }
  l.push(`Válido até ${formatDateBR(addDaysStr(m.emitidoEm, m.validadeDias))}`);

  if (m.observacoes.trim()) l.push("", `*Observações:* ${limparLivre(m.observacoes)}`);

  l.push("", codificarRefOrc(m.ref), "_(não apague a linha acima: ela identifica o seu orçamento)_");
  return l.join("\n");
}

/** Link do WhatsApp; número brasileiro sem DDI ganha 55. */
export function linkWhatsApp(telefone: string, texto: string): string {
  const numero = telefone.replace(/\D/g, "");
  const destino = numero ? (numero.length <= 11 ? `55${numero}` : numero) : "";
  return `https://wa.me/${destino}?text=${encodeURIComponent(texto)}`;
}

/**
 * Cálculo a partir de um orçamento JÁ SALVO (para reenviar a mensagem): usa os
 * preços gravados nos itens, não os do catálogo de hoje — o que foi combinado
 * não muda sozinho. Se o catálogo mudou, quem colar de volta recebe o aviso.
 */
export function calculoDoOrcamento(o: Orcamento, servicos: Servico[], sinalPercentual: number): CalculoGerador {
  const linhas: LinhaGerador[] = o.itens
    .filter((it) => it.servicoId || it.deslocamentoId)
    .map((it) => {
      const s = it.servicoId ? servicos.find((x) => x.id === it.servicoId) : undefined;
      return {
        ...(it.servicoId ? { servicoId: it.servicoId } : {}),
        ...(it.deslocamentoId ? { deslocamentoId: it.deslocamentoId } : {}),
        descricao: it.descricao,
        quantidade: it.quantidade,
        unitario: it.valorUnitario,
        valor: (cent(it.valorUnitario) * (Number(it.quantidade) || 0)) / 100,
        volume: !!s && s.precoVolume === it.valorUnitario && s.precoVolume < s.valor,
      };
    });
  const prazos: string[] = [];
  for (const l of linhas) {
    const p = servicos.find((x) => x.id === l.servicoId)?.prazo?.trim();
    if (p && !prazos.includes(p)) prazos.push(p);
  }
  const subtotalC = linhas.reduce((s, l) => s + cent(l.valor), 0);
  const descontoC = o.descontoTipo === "percentual" ? 0 : Math.max(0, cent(o.desconto));
  const acrescimoC = Math.max(0, cent(o.acrescimo));
  const totalC = Math.max(0, subtotalC - descontoC + acrescimoC);
  const { sinal, restante } = calcularSinal(totalC / 100, sinalPercentual);
  return {
    linhas,
    subtotal: subtotalC / 100,
    desconto: descontoC / 100,
    acrescimo: acrescimoC / 100,
    total: totalC / 100,
    sinalPercentual,
    sinal,
    restante,
    prazos,
    pendencias: [],
  };
}
