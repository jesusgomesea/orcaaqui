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

function digitosConferem(d: string): boolean {
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(d.slice(0, 9), 10) === Number(d[9]) && dv(d.slice(0, 10), 11) === Number(d[10]);
}

/**
 * Os 11 dígitos do CPF, ou null se não for um CPF válido. CPF que começa com 0
 * costuma perder os zeros à esquerda ao passar por planilha (o Excel trata como
 * número): com 9 ou 10 dígitos, completa com zeros e aceita se os dígitos
 * verificadores conferirem.
 */
export function cpfNormalizado(cpf: string): string | null {
  const d = somenteDigitos(cpf);
  if (d.length < 9 || d.length > 11) return null;
  const completo = d.padStart(11, "0");
  return digitosConferem(completo) ? completo : null;
}

/** Valida os dígitos verificadores do CPF (aceita o que perdeu os zeros à esquerda). */
export function cpfValido(cpf: string): boolean {
  return cpfNormalizado(cpf) !== null;
}

/**
 * CPF que basta para gerar contrato e recibo: o que confere, ou qualquer um com
 * 11 números. A conferência dos dígitos verificadores NÃO bloqueia — decisão do
 * dono do produto, depois de um CPF verdadeiro ser recusado. Só avisa (ver
 * `motivoCpfInvalido`).
 */
export function cpfAceito(cpf: string): boolean {
  return cpfValido(cpf) || somenteDigitos(cpf).length === 11;
}

/** Por que o CPF não passa — para a tela dizer o que conferir. Vazio = válido. */
export function motivoCpfInvalido(cpf: string): string {
  const d = somenteDigitos(cpf);
  if (!d) return "sem números";
  if (cpfNormalizado(cpf)) return "";
  if (d.length === 14) return "parece um CNPJ (14 números); o contrato pede o CPF da pessoa";
  if (d.length !== 11) return `tem ${d.length} números; o CPF tem 11`;
  if (/^(\d)\1{10}$/.test(d)) return "todos os números iguais";
  return "os 2 últimos números (dígitos verificadores) não conferem; o contrato sai assim mesmo, mas vale conferir se não há número trocado";
}

/** 000.000.000-00 (devolve o texto original se não for um CPF válido nem tiver 11 dígitos). */
export function formatarCpf(cpf: string): string {
  const d = cpfNormalizado(cpf) ?? somenteDigitos(cpf);
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
