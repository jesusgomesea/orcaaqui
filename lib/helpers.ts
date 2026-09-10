import type {
  Cliente,
  CodigoMoeda,
  DescontoTipo,
  ItemOrcamento,
  Orcamento,
  StatusEfetivo,
  StatusOrcamento,
} from "./tipos";

export function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function todayStr(): string {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export function diffDays(fromStr: string, toStr: string): number {
  const a = new Date(fromStr + "T00:00:00");
  const b = new Date(toStr + "T00:00:00");
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function formatDateBR(dateStr: string | undefined | null): string {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export const MOEDAS: { codigo: CodigoMoeda; label: string }[] = [
  { codigo: "BRL", label: "Real (R$)" },
  { codigo: "USD", label: "Dólar (US$)" },
  { codigo: "EUR", label: "Euro (€)" },
  { codigo: "GBP", label: "Libra (£)" },
  { codigo: "ARS", label: "Peso argentino" },
  { codigo: "MXN", label: "Peso mexicano" },
  { codigo: "CLP", label: "Peso chileno" },
  { codigo: "PYG", label: "Guarani" },
];

export function formatMoney(v: number | string | undefined, moeda: CodigoMoeda = "BRL"): string {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: moeda });
}

export function formatarNumeroOrcamento(numero: number): string {
  return "ORC-" + String(numero).padStart(4, "0");
}

/**
 * Escapa texto que vai para dentro de HTML montado à mão — hoje o documento
 * impresso (`gerarOrcamentoHtml`). Sem isso, um "Instalação <2m" some do PDF, e
 * um nome de cliente vindo de CSV de terceiro (`<img src=x onerror=...>`) roda
 * script na sessão de quem importou, com acesso à /api/dados.
 */
export function escapeHtml(valor: unknown): string {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * A logo entra como `data:` URL vinda do arquivo escolhido pelo usuário, mas o
 * backup importado é um JSON qualquer — e esse valor vai para um `src`. Só
 * imagem passa: `data:text/html` ou `javascript:` aqui seria injeção.
 */
export function logoSegura(dataUrl: string | undefined | null): string {
  const v = String(dataUrl ?? "").trim();
  // Qualquer subtipo de imagem passa (não vale sumir com a logo de quem usa um
  // formato menos comum); o que se barra é `data:text/html`, `javascript:` e cia.
  return /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+$/i.test(v) ? v : "";
}

export function calcOrcamentoTotais(
  itens: ItemOrcamento[] | undefined,
  desconto: number,
  descontoTipo: DescontoTipo,
  acrescimo: number
) {
  const subtotal = (itens || []).reduce((s, it) => s + (Number(it.quantidade) || 0) * (Number(it.valorUnitario) || 0), 0);
  const descontoValor = descontoTipo === "percentual" ? subtotal * ((Number(desconto) || 0) / 100) : Number(desconto) || 0;
  const acrescimoValor = Number(acrescimo) || 0;
  const total = Math.max(0, subtotal - descontoValor + acrescimoValor);
  return { subtotal, descontoValor, acrescimoValor, total };
}

export const STATUS_LABEL: Record<StatusEfetivo, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
  expirado: "Expirado",
};

export const STATUS_TONE: Record<StatusEfetivo, "gray" | "amber" | "green" | "red"> = {
  rascunho: "gray",
  enviado: "amber",
  aprovado: "green",
  recusado: "red",
  expirado: "gray",
};

export const STATUS_EDITAVEIS = Object.keys(STATUS_LABEL).filter((s) => s !== "expirado") as StatusOrcamento[];

export function statusEfetivo(o: Orcamento): StatusEfetivo {
  if (o.status === "aprovado" || o.status === "recusado") return o.status;
  const validoAte = addDaysStr(o.data, o.validadeDias || 0);
  if (diffDays(todayStr(), validoAte) < 0) return "expirado";
  return o.status;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function downloadFile(filename: string, content: string, mime = "application/json") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const CLIENTE_CSV_CAMPOS = ["nome", "documento", "telefone", "email", "endereco", "observacoes"] as const;
type ClienteCsvCampo = (typeof CLIENTE_CSV_CAMPOS)[number];

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function clientesParaCsv(clientes: Cliente[]): string {
  const linhas = [CLIENTE_CSV_CAMPOS.join(",")];
  for (const c of clientes) linhas.push(CLIENTE_CSV_CAMPOS.map((campo) => csvEscape(c[campo])).join(","));
  return linhas.join("\n");
}

// Parser simples: cobre aspas e vírgulas dentro de campos, não cobre CSVs com
// quebras de linha dentro de um campo entre aspas (caso raro pra dados de cliente).
function parseCsvLinha(linha: string): string[] {
  const campos: string[] = [];
  let atual = "";
  let dentroAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (dentroAspas) {
      if (c === '"' && linha[i + 1] === '"') { atual += '"'; i++; }
      else if (c === '"') dentroAspas = false;
      else atual += c;
    } else if (c === '"') dentroAspas = true;
    else if (c === ",") { campos.push(atual); atual = ""; }
    else atual += c;
  }
  campos.push(atual);
  return campos;
}

export function csvParaClientes(texto: string): Omit<Cliente, "id">[] {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (linhas.length < 2) return [];
  const cabecalho = parseCsvLinha(linhas[0]).map((h) => h.trim().toLowerCase());
  return linhas
    .slice(1)
    .map((linha) => {
      const valores = parseCsvLinha(linha);
      const cliente: Partial<Record<ClienteCsvCampo, string>> = {};
      cabecalho.forEach((campo, i) => {
        if ((CLIENTE_CSV_CAMPOS as readonly string[]).includes(campo)) {
          cliente[campo as ClienteCsvCampo] = (valores[i] || "").trim();
        }
      });
      return { nome: "", documento: "", telefone: "", email: "", endereco: "", observacoes: "", ...cliente };
    })
    .filter((c) => c.nome);
}
