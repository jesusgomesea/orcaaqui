export function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export function diffDays(fromStr, toStr) {
  const a = new Date(fromStr + "T00:00:00");
  const b = new Date(toStr + "T00:00:00");
  return Math.round((b - a) / 86400000);
}

export function formatDateBR(dateStr) {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export const MOEDAS = [
  { codigo: "BRL", label: "Real (R$)" },
  { codigo: "USD", label: "Dólar (US$)" },
  { codigo: "EUR", label: "Euro (€)" },
  { codigo: "GBP", label: "Libra (£)" },
  { codigo: "ARS", label: "Peso argentino" },
  { codigo: "MXN", label: "Peso mexicano" },
  { codigo: "CLP", label: "Peso chileno" },
  { codigo: "PYG", label: "Guarani" },
];

export function formatMoney(v, moeda = "BRL") {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: moeda });
}

export function numeroOrcamento(orcamentos, index) {
  const n = (index != null ? index : orcamentos.length) + 1;
  return "ORC-" + String(n).padStart(4, "0");
}

export function calcOrcamentoTotais(itens, desconto, descontoTipo, acrescimo) {
  const subtotal = (itens || []).reduce((s, it) => s + (Number(it.quantidade) || 0) * (Number(it.valorUnitario) || 0), 0);
  const descontoValor = descontoTipo === "percentual" ? subtotal * ((Number(desconto) || 0) / 100) : Number(desconto) || 0;
  const acrescimoValor = Number(acrescimo) || 0;
  const total = Math.max(0, subtotal - descontoValor + acrescimoValor);
  return { subtotal, descontoValor, acrescimoValor, total };
}

export const STATUS_LABEL = { rascunho: "Rascunho", enviado: "Enviado", aprovado: "Aprovado", recusado: "Recusado", expirado: "Expirado" };
export const STATUS_TONE = { rascunho: "gray", enviado: "amber", aprovado: "green", recusado: "red", expirado: "gray" };

export function statusEfetivo(o) {
  if (o.status === "aprovado" || o.status === "recusado") return o.status;
  const validoAte = addDaysStr(o.data, o.validadeDias || 0);
  if (diffDays(todayStr(), validoAte) < 0) return "expirado";
  return o.status;
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function downloadFile(filename, content, mime = "application/json") {
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

const CLIENTE_CSV_CAMPOS = ["nome", "documento", "telefone", "email", "endereco", "observacoes"];

function csvEscape(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function clientesParaCsv(clientes) {
  const linhas = [CLIENTE_CSV_CAMPOS.join(",")];
  for (const c of clientes) linhas.push(CLIENTE_CSV_CAMPOS.map((campo) => csvEscape(c[campo])).join(","));
  return linhas.join("\n");
}

// Parser simples: cobre aspas e vírgulas dentro de campos, não cobre CSVs com
// quebras de linha dentro de um campo entre aspas (caso raro pra dados de cliente).
function parseCsvLinha(linha) {
  const campos = [];
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

export function csvParaClientes(texto) {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (linhas.length < 2) return [];
  const cabecalho = parseCsvLinha(linhas[0]).map((h) => h.trim().toLowerCase());
  return linhas.slice(1).map((linha) => {
    const valores = parseCsvLinha(linha);
    const cliente = {};
    cabecalho.forEach((campo, i) => {
      if (CLIENTE_CSV_CAMPOS.includes(campo)) cliente[campo] = (valores[i] || "").trim();
    });
    return { nome: "", documento: "", telefone: "", email: "", endereco: "", observacoes: "", ...cliente };
  }).filter((c) => c.nome);
}
