// Regras e formatos usados por contratos e recibos. Sem dependências de React
// nem de servidor: roda no navegador, na rota de API e nos testes (`npm test`).

/** Fuso de Teresina/PI (UTC-3, sem horário de verão). */
export const FUSO_DOCUMENTOS = "America/Fortaleza";

/** Data de hoje (YYYY-MM-DD) no fuso de Teresina — o servidor roda em UTC. */
export function hojeNoFuso(agora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_DOCUMENTOS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(agora);
  const p = (tipo: string) => partes.find((x) => x.type === tipo)?.value ?? "";
  return `${p("year")}-${p("month")}-${p("day")}`;
}

export function paraCentavos(valor: number): number {
  return Math.round((Number(valor) || 0) * 100);
}

/** R$ 1.234,56 — com espaço não separável, para "R$" não quebrar de linha. */
export function formatarReais(valor: number): string {
  const centavos = paraCentavos(valor);
  const negativo = centavos < 0;
  const abs = Math.abs(centavos);
  const inteiro = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const cent = String(abs % 100).padStart(2, "0");
  return `${negativo ? "-" : ""}R$ ${inteiro},${cent}`;
}

/**
 * Sinal = `ceil(total × % / 100)` em reais inteiros (padrão 40%, a mesma regra
 * do site do EJ), e restante = total − sinal, então sinal + restante = total.
 * Conta em centavos inteiros para não sofrer com ponto flutuante: % de c
 * centavos, em reais, é c × % / 10000. O sinal nunca passa do total.
 */
export function calcularSinal(total: number, percentual = 40): { sinal: number; restante: number } {
  const totalCentavos = paraCentavos(total);
  const pct = Math.min(100, Math.max(0, Number(percentual) || 0));
  if (totalCentavos <= 0 || pct <= 0) return { sinal: 0, restante: Math.max(0, totalCentavos) / 100 };
  // Inteiro × inteiro antes de dividir; o -1e-9 evita que 13320,000000001 vire 13321.
  const sinalReais = Math.ceil((totalCentavos * pct) / 10000 - 1e-9);
  const sinalCentavos = Math.min(sinalReais * 100, totalCentavos);
  return { sinal: sinalCentavos / 100, restante: (totalCentavos - sinalCentavos) / 100 };
}

export function somenteDigitos(s: string | undefined | null): string {
  return String(s ?? "").replace(/\D/g, "");
}

/** Valida os dígitos verificadores do CPF. */
export function cpfValido(cpf: string): boolean {
  const d = somenteDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(d.slice(0, 9), 10) === Number(d[9]) && dv(d.slice(0, 10), 11) === Number(d[10]);
}

/** 000.000.000-00 (devolve o texto original se não tiver 11 dígitos). */
export function formatarCpf(cpf: string): string {
  const d = somenteDigitos(cpf);
  if (d.length !== 11) return cpf.trim();
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** (00) 00000-0000 ou (00) 0000-0000; aceita +55 na frente. */
export function formatarTelefone(tel: string): string {
  let d = somenteDigitos(tel);
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel.trim();
}

export function telefoneValido(tel: string): boolean {
  return /^\(\d{2}\) \d{4,5}-\d{4}$/.test(formatarTelefone(tel));
}

export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** YYYY-MM-DD → dd/mm/aaaa */
export function formatarData(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** 1 → "001/2026" */
export function formatarNumeroDocumento(sequencial: number, ano: number): string {
  return `${String(sequencial).padStart(3, "0")}/${ano}`;
}

/** Nome sugerido: "Contrato 001-2026 - Ana Souza.pdf". Sem CPF, por LGPD. */
export function nomeArquivoDocumento(
  tipo: "contrato" | "recibo",
  numero: string,
  clienteNome: string,
  extensao: "pdf" | "docx"
): string {
  const rotulo = tipo === "contrato" ? "Contrato" : "Recibo";
  const nome = clienteNome.replace(/[\\/:*?"<>|\r\n\t]+/g, " ").replace(/\s+/g, " ").trim() || "Cliente";
  return `${rotulo} ${numero.replace("/", "-")} - ${nome}.${extensao}`;
}
