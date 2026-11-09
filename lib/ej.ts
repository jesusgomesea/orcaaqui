// Cliente da API pública do site do EJ Fotografia (fonte da tabela de preços).
//
// A tabela e as regras do EJ ficam SÓ lá (decisão do plano de integração):
// aqui não há preço nem regra do EJ, só o formato da linha `[ref EJ-…]` (o
// contrato entre os dois sistemas) e as chamadas:
//   GET <url>/api/catalogo                → a tabela em JSON
//   GET <url>/api/recalcular?ref=<[ref]>  → itens, total, sinal, restante…
// As duas são públicas e liberadas para qualquer origem; por isso o navegador
// chama direto. Só a linha [ref] sai daqui — nome, telefone e local do cliente
// nunca vão para o EJ.

export const URL_SUGERIDA_EJ = "https://ejfotografia.netlify.app";

const TEMPO_LIMITE_MS = 8_000;

export type CategoriaEjId = "ensaio" | "evento" | "auxiliar" | "edicao";

export interface PrecoFotoEj {
  preco: number;
  precoVolume: number;
  volumeMin: number;
}

export interface CatalogoEj {
  versaoApi: number;
  versao: number;
  sinalPercentual: number;
  validadeDias: number;
  categorias: {
    id: CategoriaEjId;
    nome: string;
    descricao: string;
    temSessao: boolean;
    horaExtra?: number;
    foto?: PrecoFotoEj;
    personalizado?: {
      valorHora: number;
      blocoMinutos: number;
      minutosMin: number;
      minutosMax: number;
      fotosMin: number;
      foto: PrecoFotoEj;
    };
    legado?: boolean;
  }[];
  pacotes: {
    id: string;
    categoria: CategoriaEjId;
    nome: string;
    duracao: string;
    entrega: string;
    preco: number;
    prazo: string;
    ativo?: boolean;
    aviso?: string;
    personalizado?: boolean;
    legado?: boolean;
  }[];
  entregas: { id: string; nome: string; detalhe: string; preco: number; pacotes?: string[] }[];
  deslocamentos: { id: string; nome: string; preco: number; aCombinar?: boolean; legado?: boolean }[];
  auxiliar?: { modos?: { id: "com" | "sem"; nome: string; diaria: number; cobraDeslocamento: boolean }[] } & Record<string, unknown>;
}

/** O que o prestador escolhe no montador do EJ (mesmos campos da `Selecao` de lá). */
export interface SelecaoEj {
  categoria: CategoriaEjId;
  pacoteId: string | null;
  horasExtras: number;
  fotosExtras: number;
  minutosPersonalizado: number;
  fotosPersonalizado: number;
  entregaId: string;
  deslocamentoId: string;
  diariasAuxiliar: number;
  modoAuxiliar: "com" | "sem";
}

export function selecaoEjVazia(categoria: CategoriaEjId = "ensaio"): SelecaoEj {
  return {
    categoria,
    pacoteId: null,
    horasExtras: 0,
    fotosExtras: 0,
    minutosPersonalizado: 0,
    fotosPersonalizado: 0,
    entregaId: "padrao",
    deslocamentoId: "ate10",
    diariasAuxiliar: categoria === "auxiliar" ? 1 : 0,
    modoAuxiliar: "com",
  };
}

export interface LinhaEj {
  descricao: string;
  quantidade: number;
  unitario: number;
  valor: number;
  /** aCombinar não entra no total. */
  tipo: "fixo" | "aPartirDe" | "aCombinar";
  grupo?: string;
}

export interface RecalculoEj {
  versaoApi: number;
  versaoTabela: number;
  versaoRef: number;
  codigo: string;
  emitidoEm: string;
  data: string;
  horario: string;
  selecao: SelecaoEj;
  servico: string;
  linhas: LinhaEj[];
  total: number;
  totalEhMinimo: boolean;
  sinalPercentual: number;
  sinal: number;
  restante: number;
  prazo: { nome: string; detalhe: string; preco: number } | null;
  pendencias: string[];
  avisos: string[];
}

/** "ejfotografia.netlify.app/" → "https://ejfotografia.netlify.app" */
export function normalizarUrlEj(url: string): string {
  let u = url.trim().replace(/\/+$/, "");
  if (u && !/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

async function pegarJson(url: string): Promise<unknown> {
  let resposta: Response;
  try {
    resposta = await fetch(url, { signal: AbortSignal.timeout(TEMPO_LIMITE_MS), cache: "no-store" });
  } catch (e) {
    const tempo = e instanceof DOMException && e.name === "TimeoutError";
    throw new Error(tempo ? "O site do EJ não respondeu a tempo. Tente de novo." : "Não foi possível acessar o site do EJ. Confira o endereço e a conexão.");
  }
  const corpo = (await resposta.json().catch(() => null)) as { ok?: boolean; erro?: string } | null;
  if (!resposta.ok || !corpo) {
    throw new Error(corpo?.erro ? `Tabela do EJ: ${corpo.erro}` : `O site do EJ respondeu ${resposta.status}.`);
  }
  return corpo;
}

export async function buscarCatalogoEj(urlBase: string): Promise<CatalogoEj> {
  const cat = (await pegarJson(`${normalizarUrlEj(urlBase)}/api/catalogo`)) as CatalogoEj;
  if (typeof cat.versao !== "number" || !Array.isArray(cat.pacotes)) throw new Error("A resposta do site do EJ não parece uma tabela de preços.");
  return cat;
}

/** Recalcula pela tabela atual do EJ. Recebe só a linha `[ref]` (ou um texto que a contenha). */
export async function recalcularEj(urlBase: string, linhaRef: string): Promise<RecalculoEj> {
  const ref = extrairRefEj(linhaRef);
  if (!ref) throw new Error("Linha [ref EJ-…] não encontrada.");
  const url = `${normalizarUrlEj(urlBase)}/api/recalcular?ref=${encodeURIComponent(ref)}`;
  const corpo = (await pegarJson(url)) as { ok: boolean; recalculo?: RecalculoEj; erro?: string };
  if (!corpo.ok || !corpo.recalculo) throw new Error(corpo.erro || "O site do EJ não conseguiu recalcular este orçamento.");
  return corpo.recalculo;
}

/** A última linha `[ref EJ-…]` do texto, inteira — é só isso que vai para o EJ. */
export function extrairRefEj(texto: string): string | null {
  const achados = [...texto.matchAll(/\[ref\s+EJ-[^\]\n]+\]/g)];
  return achados.length ? achados[achados.length - 1][0] : null;
}

const ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function novoCodigoEj(aleatorio: () => number = Math.random): string {
  let s = "EJ-";
  for (let i = 0; i < 5; i++) s += ALFABETO[Math.floor(aleatorio() * ALFABETO.length)];
  return s;
}

const CHAVES: [keyof SelecaoEj, string][] = [
  ["horasExtras", "he"],
  ["fotosExtras", "fe"],
  ["minutosPersonalizado", "mp"],
  ["fotosPersonalizado", "fp"],
  ["diariasAuxiliar", "ax"],
];

/**
 * Monta a linha `[ref EJ-…]` no formato que o site do EJ lê (ver MANUTENCAO §3
 * de lá): padrões omitidos (`en=padrao`, `ds=ate10`, `am=com`), quantidades
 * zeradas omitidas.
 */
export function codificarRefEj(r: {
  codigo: string;
  versao: number;
  emitidoEm: string;
  selecao: SelecaoEj;
  data: string;
  horario: string;
}): string {
  const s = r.selecao;
  const partes = [r.codigo, `v${r.versao}`, `em=${r.emitidoEm}`, `c=${s.categoria}`];
  if (s.pacoteId) partes.push(`p=${s.pacoteId}`);
  for (const [campo, chave] of CHAVES) {
    const v = Math.max(0, Math.floor(Number(s[campo]) || 0));
    if (v > 0) partes.push(`${chave}=${v}`);
  }
  if (s.categoria === "auxiliar" && s.modoAuxiliar !== "com") partes.push(`am=${s.modoAuxiliar}`);
  if (s.entregaId && s.entregaId !== "padrao") partes.push(`en=${s.entregaId}`);
  if (s.deslocamentoId && s.deslocamentoId !== "ate10") partes.push(`ds=${s.deslocamentoId}`);
  if (r.data) partes.push(`dt=${r.data}`);
  if (r.horario) partes.push(`hr=${r.horario}`);
  return `[ref ${partes.join(" ")}]`;
}

// ---------- orçamento e mensagem a partir do recálculo do EJ ----------

/** Itens do orçamento oficial: a primeira linha (pacote/serviço) é o principal, as demais são adicionais. */
export function itensDoRecalculoEj(r: RecalculoEj, novoId: () => string) {
  return r.linhas.map((l, i) => ({
    id: novoId(),
    descricao: l.tipo === "aCombinar" ? `${l.descricao} (a combinar)` : l.descricao,
    quantidade: l.tipo === "aCombinar" ? 1 : l.quantidade,
    // "a combinar" não entra no total: fica com valor zero até ser combinado.
    valorUnitario: l.tipo === "aCombinar" ? 0 : l.quantidade ? Math.round((l.valor / l.quantidade) * 100) / 100 : l.valor,
    ...(i > 0 ? { tipo: "adicional" as const } : {}),
  }));
}

export interface DadosMensagemEj {
  empresaNome: string;
  cliente: { nome: string; telefone: string };
  local: string;
  observacoes: string;
  validadeDias: number;
  linhaRef: string;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const limpar = (t: string) => t.replace(/[\r\n]+/g, " ").replace(/[[\]*]/g, "").replace(/\s{2,}/g, " ").trim();
const dataBR = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Mensagem no mesmo formato do site do EJ (mesmos rótulos e a linha
 * `[ref EJ-…]`): colada de volta, é lida e recalculada como qualquer outra.
 */
export function gerarMensagemEj(r: RecalculoEj, m: DadosMensagemEj): string {
  const l: string[] = [];
  l.push(`📸 *Orçamento ${r.codigo}*${m.empresaNome ? ` — ${limpar(m.empresaNome)}` : ""}`, "");
  l.push(`*Cliente:* ${limpar(m.cliente.nome)}`);
  if (m.cliente.telefone.trim()) l.push(`*WhatsApp:* ${limpar(m.cliente.telefone)}`);
  l.push(`*Serviço:* ${limpar(r.servico)}`);
  l.push(r.data ? `*Data desejada:* ${dataBR(r.data)}${r.horario ? ` às ${r.horario}` : ""}` : "*Data desejada:* a definir");
  if (m.local.trim()) l.push(`*Local:* ${limpar(m.local)}`);

  l.push("", "*Itens*");
  for (const it of r.linhas.filter((x) => !x.grupo)) {
    const qtd = it.quantidade > 1 ? ` × ${it.quantidade}` : "";
    const valor = it.tipo === "aCombinar" ? "a combinar" : it.tipo === "aPartirDe" ? `a partir de ${brl(it.valor)}` : brl(it.valor);
    l.push(`• ${it.descricao}${qtd} — ${valor}`);
  }
  const desl = r.linhas.find((x) => x.grupo === "deslocamento");
  if (desl || r.prazo) l.push("");
  if (desl) l.push(`*Deslocamento:* ${desl.descricao.replace(/^Deslocamento \((.*)\)$/, "$1")} — ${desl.tipo === "aCombinar" ? "a combinar" : brl(desl.valor)}`);
  if (r.prazo) l.push(`*Entrega:* ${r.prazo.nome} (${r.prazo.detalhe}) — ${r.prazo.preco ? brl(r.prazo.preco) : "incluso"}`);

  l.push("");
  const temCombinar = r.linhas.some((x) => x.tipo === "aCombinar");
  const prefixo = r.totalEhMinimo || r.linhas.some((x) => x.tipo === "aPartirDe") ? "a partir de " : "";
  l.push(`*Total:* ${prefixo}${brl(r.total)}${temCombinar ? " + itens a combinar" : ""}`);
  l.push(`*Sinal (${r.sinalPercentual}%):* ${brl(r.sinal)} — reserva a data`);
  l.push(`*Restante:* ${brl(r.restante)} — até o dia do ensaio ou evento`);
  l.push(`Válido até ${dataBR(somarDias(r.emitidoEm, m.validadeDias))}`);
  if (m.observacoes.trim()) l.push("", `*Observações:* ${limpar(m.observacoes)}`);
  l.push("", m.linhaRef, "_(não apague a linha acima: ela identifica o seu orçamento)_");
  return l.join("\n");
}
