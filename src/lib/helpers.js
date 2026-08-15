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

export function formatMoney(v) {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
