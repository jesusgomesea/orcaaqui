// Parcerias: um orçamento em que o parceiro "paga" (no todo ou em parte) com
// contrapartidas — divulgação, permuta, indicação de clientes — em vez de só
// dinheiro. O que VOCÊ entrega continua nos itens do orçamento (e nas fotos,
// prazo etc. de `servicoContrato`); aqui moram as contrapartidas e o controle
// do que o parceiro já cumpriu. Puro, coberto por lib/parceria.test.ts.

import { calcOrcamentoTotais, formatDateBR, formatMoney, uuid } from "./helpers";
import { paraCentavos } from "./documentos/formatos";
import type { CodigoMoeda, Contrapartida, Orcamento, Parceria, TipoContrapartida } from "./tipos";

export const TIPOS_CONTRAPARTIDA: { id: TipoContrapartida; nome: string; sugestoes: string[] }[] = [
  {
    id: "divulgacao",
    nome: "Divulgação",
    sugestoes: ["Post no feed marcando meu @", "Stories marcando meu @", "Reels em collab", "Link na bio", "Depoimento/avaliação"],
  },
  { id: "permuta", nome: "Permuta", sugestoes: ["Uso do espaço", "Produto", "Serviço do parceiro"] },
  { id: "indicacao", nome: "Indicação de clientes", sugestoes: ["Indicar clientes"] },
  { id: "outra", nome: "Outra", sugestoes: [] },
];

export function nomeTipoContrapartida(tipo: TipoContrapartida): string {
  return TIPOS_CONTRAPARTIDA.find((t) => t.id === tipo)?.nome ?? "Outra";
}

export function novaContrapartida(tipo: TipoContrapartida = "divulgacao"): Contrapartida {
  return { id: uuid(), tipo, descricao: "", quantidade: 1, prazo: "", valorEstimado: 0, registros: [] };
}

export function parceriaVazia(): Parceria {
  return { contrapartidas: [novaContrapartida("divulgacao")] };
}

/** Quanto já foi cumprido de uma contrapartida. */
export function progresso(c: Contrapartida): { feitas: number; total: number; cumprida: boolean } {
  const total = Math.max(1, Math.floor(Number(c.quantidade) || 1));
  const feitas = Math.min(total, c.registros.length);
  return { feitas, total, cumprida: feitas >= total };
}

/** Pendente e com prazo já passado (hoje = YYYY-MM-DD). */
export function atrasada(c: Contrapartida, hoje: string): boolean {
  return !progresso(c).cumprida && !!c.prazo && c.prazo < hoje;
}

export interface ResumoParceria {
  /** Quanto custaria sem a parceria (soma dos itens). */
  valorCheio: number;
  /** Desconto dado pela parceria. */
  desconto: number;
  /** O que o parceiro paga em dinheiro (pode ser zero). */
  emDinheiro: number;
  /** Soma estimada das permutas. */
  emPermuta: number;
  contrapartidas: number;
  cumpridas: number;
  pendentes: number;
}

export function resumoParceria(o: Pick<Orcamento, "itens" | "desconto" | "descontoTipo" | "acrescimo" | "parceria">): ResumoParceria {
  const { subtotal, descontoValor, total } = calcOrcamentoTotais(o.itens, o.desconto, o.descontoTipo, o.acrescimo);
  const lista = o.parceria?.contrapartidas ?? [];
  const cumpridas = lista.filter((c) => progresso(c).cumprida).length;
  const permutaCentavos = lista.filter((c) => c.tipo === "permuta").reduce((s, c) => s + paraCentavos(c.valorEstimado), 0);
  return {
    valorCheio: subtotal,
    desconto: descontoValor,
    emDinheiro: total,
    emPermuta: permutaCentavos / 100,
    contrapartidas: lista.length,
    cumpridas,
    pendentes: lista.length - cumpridas,
  };
}

/** Uma linha por contrapartida, para a mensagem do WhatsApp e o PDF. */
const limpar = (t: string) => t.replace(/[\r\n]+/g, " ").replace(/[[\]*]/g, "").replace(/\s{2,}/g, " ").trim();

export function linhasContrapartidas(p: Parceria, moeda: CodigoMoeda): string[] {
  return p.contrapartidas
    .filter((c) => limpar(c.descricao))
    .map((c) => {
      const qtd = c.quantidade > 1 ? `${c.quantidade}× ` : "";
      const valor = c.tipo === "permuta" && c.valorEstimado > 0 ? ` (valor estimado ${formatMoney(c.valorEstimado, moeda)})` : "";
      const prazo = c.prazo ? ` — até ${formatDateBR(c.prazo)}` : "";
      return `${qtd}${limpar(c.descricao)}${valor}${prazo}`;
    });
}

/** Bloco "Parceria" da mensagem do WhatsApp (texto com *negrito*). */
export function textoParceria(o: Pick<Orcamento, "itens" | "desconto" | "descontoTipo" | "acrescimo" | "parceria">, moeda: CodigoMoeda): string {
  if (!o.parceria) return "";
  const r = resumoParceria(o);
  const l: string[] = ["*Parceria*"];
  const linhas = linhasContrapartidas(o.parceria, moeda);
  if (linhas.length) {
    l.push("Em troca, você oferece:");
    for (const x of linhas) l.push(`• ${x}`);
  }
  if (r.desconto > 0) l.push(`Valor cheio ${formatMoney(r.valorCheio, moeda)}; desconto de parceria ${formatMoney(r.desconto, moeda)}.`);
  l.push(r.emDinheiro > 0 ? `Em dinheiro: ${formatMoney(r.emDinheiro, moeda)}.` : "Sem pagamento em dinheiro.");
  return l.join("\n");
}

/** Limpa o que vier de backup/servidor; ausente ou inválido = não é parceria. */
export function normalizarParceria(bruto: unknown): Parceria | undefined {
  if (typeof bruto !== "object" || bruto === null) return undefined;
  const lista = (bruto as { contrapartidas?: unknown }).contrapartidas;
  if (!Array.isArray(lista)) return undefined;
  const tipos = TIPOS_CONTRAPARTIDA.map((t) => t.id);
  const texto = (v: unknown) => (typeof v === "string" ? v : "");
  const numero = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    contrapartidas: lista
      .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
      .map((c) => ({
        id: texto(c.id) || uuid(),
        tipo: (tipos.includes(c.tipo as TipoContrapartida) ? c.tipo : "outra") as TipoContrapartida,
        descricao: texto(c.descricao),
        quantidade: Math.max(1, Math.floor(numero(c.quantidade) || 1)),
        prazo: texto(c.prazo),
        valorEstimado: Math.max(0, numero(c.valorEstimado)),
        registros: (Array.isArray(c.registros) ? c.registros : [])
          .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
          .map((r) => ({ id: texto(r.id) || uuid(), data: texto(r.data), detalhe: texto(r.detalhe) })),
      })),
  };
}
