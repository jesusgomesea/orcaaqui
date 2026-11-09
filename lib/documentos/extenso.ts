// Números, valores e datas por extenso em português do Brasil.

const UNIDADES = [
  "zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
  "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove",
];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = [
  "", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
  "seiscentos", "setecentos", "oitocentos", "novecentos",
];

/** 0–999 por extenso ("cem" sozinho, "cento e ..." acompanhado). */
function ate999(n: number): string {
  if (n < 20) return UNIDADES[n];
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    return u ? `${DEZENAS[d]} e ${UNIDADES[u]}` : DEZENAS[d];
  }
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const resto = n % 100;
  return resto ? `${CENTENAS[c]} e ${ate999(resto)}` : CENTENAS[c];
}

const ESCALAS: [singular: string, plural: string][] = [
  ["", ""],
  ["mil", "mil"],
  ["milhão", "milhões"],
  ["bilhão", "bilhões"],
];

/** Inteiro não negativo por extenso (até 999 bilhões). */
export function numeroPorExtenso(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return "zero";

  const grupos: number[] = [];
  while (n > 0) {
    grupos.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  if (grupos.length > ESCALAS.length) throw new Error("Número grande demais para escrever por extenso.");

  const partes: { texto: string; valor: number }[] = [];
  for (let i = grupos.length - 1; i >= 0; i--) {
    const g = grupos[i];
    if (!g) continue;
    let texto: string;
    if (i === 0) texto = ate999(g);
    else if (i === 1) texto = g === 1 ? "mil" : `${ate999(g)} mil`;
    else texto = `${ate999(g)} ${g === 1 ? ESCALAS[i][0] : ESCALAS[i][1]}`;
    partes.push({ texto, valor: g });
  }

  // O último grupo leva "e" quando é menor que 100 ou centena redonda:
  // "mil e cem", "mil e cinquenta", mas "mil duzentos e trinta e quatro".
  return partes.reduce((acc, parte, idx) => {
    if (idx === 0) return parte.texto;
    const ultima = idx === partes.length - 1;
    const usaE = ultima && grupos[0] === parte.valor && (parte.valor < 100 || parte.valor % 100 === 0);
    return `${acc}${usaE ? " e " : " "}${parte.texto}`;
  }, "");
}

/**
 * R$ 1.234,56 → "mil duzentos e trinta e quatro reais e cinquenta e seis centavos".
 * Milhão/bilhão redondo leva "de": "um milhão de reais".
 */
export function valorPorExtenso(valor: number): string {
  const centavosTotais = Math.round(Math.abs(Number(valor) || 0) * 100);
  const reais = Math.floor(centavosTotais / 100);
  const centavos = centavosTotais % 100;

  const partes: string[] = [];
  if (reais > 0) {
    const texto = numeroPorExtenso(reais);
    const de = reais >= 1_000_000 && reais % 1_000_000 === 0 ? " de" : "";
    partes.push(`${texto}${de} ${reais === 1 ? "real" : "reais"}`);
  }
  if (centavos > 0) partes.push(`${numeroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  return partes.length ? partes.join(" e ") : "zero real";
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** YYYY-MM-DD → "9 de novembro de 2026" */
export function dataPorExtenso(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!m) return "";
  const mes = MESES[Number(m[2]) - 1];
  if (!mes) return "";
  return `${Number(m[3])} de ${mes} de ${m[1]}`;
}
