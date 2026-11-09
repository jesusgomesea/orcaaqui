// Página impressa de um .docx: margens, cabeçalho e rodapé, lidos do próprio
// modelo. O corpo do documento é desenhado no navegador pelo docx-preview
// (lib/documentosImpressao.ts), mas ele não repete cabeçalho/rodapé por página
// nem preenche os campos PAGE/NUMPAGES — então eles viram caixas de margem do
// `@page` (cabeçalho e "Página X de Y" em toda página). Nada de texto é fixado
// aqui: tudo sai do XML do modelo.

import PizZip from "pizzip";

/** Trecho do rodapé/cabeçalho: texto fixo ou contador de página. */
export type TrechoPagina = { texto: string } | { campo: "pagina" | "paginas" };

export interface EstiloTexto {
  /** em pt */
  tamanho?: number;
  /** #RRGGBB */
  cor?: string;
  fonte?: string;
}

export interface ParteCabecalho {
  /** Antes do primeiro tab (alinhado à esquerda). */
  esquerda: TrechoPagina[];
  /** Depois do tab (alinhado à direita). */
  direita: TrechoPagina[];
  imagem?: { dataUrl: string; larguraPt: number; alturaPt: number };
  /** Linha sob o parágrafo (`w:pBdr/w:bottom`). */
  bordaInferior?: { cor: string; espessuraPt: number };
  alinhamento: "esquerda" | "centro" | "direita";
  estilo: EstiloTexto;
}

export interface LayoutPagina {
  /** Margens da página em pt. */
  margens: { topo: number; direita: number; base: number; esquerda: number };
  /** Tamanho da página em pt. */
  largura: number;
  altura: number;
  cabecalho?: ParteCabecalho;
  rodape?: ParteCabecalho;
}

const TWIP_PT = 1 / 20;
const EMU_PT = 1 / 12700;

function attr(xml: string, nome: string): string | undefined {
  return new RegExp(`${nome}="([^"]*)"`).exec(xml)?.[1];
}

function desescaparXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml" };

/** Junta textos vizinhos, pra não gerar `"a" "b"` à toa no CSS. */
function compactar(trechos: TrechoPagina[]): TrechoPagina[] {
  const saida: TrechoPagina[] = [];
  for (const t of trechos) {
    const ultimo = saida[saida.length - 1];
    if ("texto" in t && ultimo && "texto" in ultimo) ultimo.texto += t.texto;
    else saida.push({ ...t });
  }
  return saida.filter((t) => !("texto" in t) || t.texto !== "");
}

function aparar(trechos: TrechoPagina[]): TrechoPagina[] {
  const c = compactar(trechos);
  const primeiro = c[0];
  if (primeiro && "texto" in primeiro) primeiro.texto = primeiro.texto.trimStart();
  const ultimo = c[c.length - 1];
  if (ultimo && "texto" in ultimo) ultimo.texto = ultimo.texto.trimEnd();
  return c.filter((t) => !("texto" in t) || t.texto !== "");
}

/** Lê o primeiro parágrafo com conteúdo de um header/footer do Word. */
function lerParte(zip: PizZip, caminho: string): ParteCabecalho | undefined {
  const xml = zip.file(caminho)?.asText();
  if (!xml) return undefined;

  const pasta = caminho.replace(/[^/]+$/, "");
  const rels = zip.file(`${pasta}_rels/${caminho.slice(pasta.length)}.rels`)?.asText() ?? "";

  const paragrafos = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];
  const paragrafo = paragrafos.find((p) => /<w:t[ >]|<w:drawing|w:instr/.test(p));
  if (!paragrafo) return undefined;

  const pPr = /<w:pPr>[\s\S]*?<\/w:pPr>/.exec(paragrafo)?.[0] ?? "";
  const corpo = paragrafo.replace(pPr, "");

  const jc = attr(/<w:jc [^>]*>/.exec(pPr)?.[0] ?? "", "w:val");
  const alinhamento = jc === "center" ? "centro" : jc === "right" || jc === "end" ? "direita" : "esquerda";

  let bordaInferior: ParteCabecalho["bordaInferior"];
  const borda = /<w:pBdr>[\s\S]*?<w:bottom ([^>]*)\/>/.exec(pPr)?.[1];
  if (borda && attr(borda, "w:val") !== "none" && attr(borda, "w:val") !== "nil") {
    // w:sz em oitavos de ponto.
    bordaInferior = { cor: `#${attr(borda, "w:color") || "000000"}`, espessuraPt: Number(attr(borda, "w:sz") || 4) / 8 };
  }

  // Estilo do primeiro texto (cor, tamanho e fonte).
  const rPr = /<w:r>\s*<w:rPr>([\s\S]*?)<\/w:rPr>\s*<w:t[ >]/.exec(corpo)?.[1] ?? "";
  const sz = attr(/<w:sz [^>]*>/.exec(rPr)?.[0] ?? "", "w:val");
  const cor = attr(/<w:color [^>]*>/.exec(rPr)?.[0] ?? "", "w:val");
  const fonte = attr(/<w:rFonts [^>]*>/.exec(rPr)?.[0] ?? "", "w:ascii");
  const estilo: EstiloTexto = {
    ...(sz ? { tamanho: Number(sz) / 2 } : {}),
    ...(cor && cor !== "auto" ? { cor: `#${cor}` } : {}),
    ...(fonte ? { fonte } : {}),
  };

  let imagem: ParteCabecalho["imagem"];
  const esquerda: TrechoPagina[] = [];
  const direita: TrechoPagina[] = [];
  let destino = esquerda;

  // Percorre na ordem do documento: texto, tab, campo (simples ou complexo) e imagem.
  // Entre `separate` e `end` de um campo fica o último valor que o Word calculou
  // ("1"): é pulado, quem numera é o contador do CSS.
  const tokens = /<w:t(?: [^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:instrText(?: [^>]*)?>([^<]*)<\/w:instrText>|<w:fldSimple [^>]*w:instr="([^"]*)"[^>]*?(\/)?>|<\/w:fldSimple>|<w:drawing>([\s\S]*?)<\/w:drawing>|<w:fldChar [^>]*w:fldCharType="(separate|end)"/g;
  let dentroDoResultado = false;
  for (let m = tokens.exec(corpo); m; m = tokens.exec(corpo)) {
    const [inteiro, texto, instr, instrSimples, simplesFechado, desenho, fldChar] = m;
    if (fldChar !== undefined) {
      dentroDoResultado = fldChar === "separate";
    } else if (inteiro === "</w:fldSimple>") {
      dentroDoResultado = false;
    } else if (texto !== undefined) {
      if (dentroDoResultado) continue;
      const partes = desescaparXml(texto).split("\t");
      partes.forEach((parte, i) => {
        if (i > 0) destino = direita;
        destino.push({ texto: parte });
      });
    } else if (inteiro === "<w:tab/>") {
      destino = direita;
    } else if (instr !== undefined || instrSimples !== undefined) {
      const campo = (instr ?? instrSimples ?? "").trim().split(/\s+/)[0]?.toUpperCase();
      if (campo === "PAGE") destino.push({ campo: "pagina" });
      else if (campo === "NUMPAGES") destino.push({ campo: "paginas" });
      // fldSimple não fechado em si mesmo traz o resultado dentro dele.
      if (instrSimples !== undefined && !simplesFechado) dentroDoResultado = true;
    } else if (desenho !== undefined && !imagem) {
      const rId = /r:embed="([^"]+)"/.exec(desenho)?.[1];
      const alvo = rId ? new RegExp(`Id="${rId}"[^>]*Target="([^"]+)"`).exec(rels)?.[1] : undefined;
      const arquivo = alvo ? zip.file(`${pasta}${alvo.replace(/^\.\//, "")}`) : null;
      const ext = alvo?.split(".").pop()?.toLowerCase() ?? "";
      const extent = /<wp:extent ([^>]*)\/>/.exec(desenho)?.[1] ?? "";
      if (arquivo && MIME[ext]) {
        const base64 = btoaBinario(arquivo.asBinary());
        imagem = {
          dataUrl: `data:${MIME[ext]};base64,${base64}`,
          larguraPt: Number(attr(extent, "cx") || 0) * EMU_PT,
          alturaPt: Number(attr(extent, "cy") || 0) * EMU_PT,
        };
      }
    }
  }

  const parte: ParteCabecalho = {
    esquerda: aparar(esquerda),
    direita: aparar(direita),
    alinhamento,
    estilo,
    ...(imagem ? { imagem } : {}),
    ...(bordaInferior ? { bordaInferior } : {}),
  };
  if (!parte.esquerda.length && !parte.direita.length && !parte.imagem) return undefined;
  return parte;
}

/** base64 de uma string binária (funciona no navegador e no Node dos testes). */
function btoaBinario(binario: string): string {
  if (typeof btoa === "function") return btoa(binario);
  return Buffer.from(binario, "binary").toString("base64");
}

/** Caminho (dentro de word/) do header/footer padrão da última seção. */
function referencia(zip: PizZip, sectPr: string, tipo: "header" | "footer"): string | undefined {
  const refs = [...sectPr.matchAll(new RegExp(`<w:${tipo}Reference ([^>]*)/>`, "g"))].map((m) => m[1]);
  const ref = refs.find((r) => attr(r, "w:type") === "default") ?? refs[0];
  const rId = ref ? attr(ref, "r:id") : undefined;
  if (!rId) return undefined;
  const rels = zip.file("word/_rels/document.xml.rels")?.asText() ?? "";
  const alvo = new RegExp(`Id="${rId}"[^>]*Target="([^"]+)"`).exec(rels)?.[1]
    ?? new RegExp(`Target="([^"]+)"[^>]*Id="${rId}"`).exec(rels)?.[1];
  return alvo ? `word/${alvo.replace(/^\/?word\//, "")}` : undefined;
}

/** Lê margens, tamanho, cabeçalho e rodapé de um .docx (bytes ou zip já aberto). */
export function lerPaginaDocx(docx: Uint8Array | ArrayBuffer | PizZip): LayoutPagina {
  const zip = docx instanceof PizZip ? docx : new PizZip(docx);
  const documento = zip.file("word/document.xml")?.asText() ?? "";
  const secoes = documento.match(/<w:sectPr[ >][\s\S]*?<\/w:sectPr>/g) ?? [];
  const sectPr = secoes[secoes.length - 1] ?? "";

  const pgSz = /<w:pgSz ([^>]*)\/>/.exec(sectPr)?.[1] ?? "";
  const pgMar = /<w:pgMar ([^>]*)\/>/.exec(sectPr)?.[1] ?? "";
  const twip = (nome: string, padrao: number) => {
    const v = Number(attr(pgMar, nome));
    return Number.isFinite(v) && attr(pgMar, nome) !== undefined ? Math.abs(v) * TWIP_PT : padrao;
  };

  // Padrão do Word: A4 com 2,5 cm/3 cm não importa aqui — sem pgSz/pgMar vale A4 e 2 cm.
  const largura = Number(attr(pgSz, "w:w") || 11906) * TWIP_PT;
  const altura = Number(attr(pgSz, "w:h") || 16838) * TWIP_PT;
  const margens = {
    topo: twip("w:top", 56.7),
    direita: twip("w:right", 56.7),
    base: twip("w:bottom", 56.7),
    esquerda: twip("w:left", 56.7),
  };

  const caminhoCab = referencia(zip, sectPr, "header");
  const caminhoRod = referencia(zip, sectPr, "footer");
  const cabecalho = caminhoCab ? lerParte(zip, caminhoCab) : undefined;
  const rodape = caminhoRod ? lerParte(zip, caminhoRod) : undefined;

  return {
    margens,
    largura,
    altura,
    ...(cabecalho ? { cabecalho } : {}),
    ...(rodape ? { rodape } : {}),
  };
}

/** String CSS segura para `content:` (aspas, barra e quebras de linha escapadas). */
function stringCss(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ").replace(/</g, "\\3C ")}"`;
}

function conteudoCss(trechos: TrechoPagina[]): string {
  if (!trechos.length) return '""';
  return trechos
    .map((t) => ("texto" in t ? stringCss(t.texto) : t.campo === "pagina" ? "counter(page)" : "counter(pages)"))
    .join(" ");
}

function estiloCss(e: EstiloTexto): string {
  const fonte = e.fonte ? `${stringCss(e.fonte)}, ` : "";
  return [
    `font-family:${fonte}Georgia, "Times New Roman", serif`,
    `font-size:${e.tamanho ?? 9}pt`,
    `color:${e.cor ?? "#555555"}`,
  ].join(";");
}

/** Cor segura (#RRGGBB) para o CSS; qualquer outra coisa vira cinza. */
function corSegura(c: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c : "#999999";
}

/**
 * Regra `@page` com o tamanho, as margens e as caixas de margem do cabeçalho e
 * do rodapé. Caixas de margem (`@top-left`…) existem no Chrome/Edge (131+);
 * nos outros navegadores só o cabeçalho/rodapé some — o corpo sai igual.
 */
export function cssDaPagina(layout: LayoutPagina): string {
  const { margens: m } = layout;
  const caixas: string[] = [];

  const montar = (parte: ParteCabecalho, lado: "top" | "bottom") => {
    const borda = parte.bordaInferior
      ? `border-bottom:${parte.bordaInferior.espessuraPt.toFixed(2)}pt solid ${corSegura(parte.bordaInferior.cor)};`
      : "";
    const estilo = estiloCss(parte.estilo);
    // Cabeçalho alinhado pela base da margem (encostado no texto); rodapé pelo topo.
    const vertical = lado === "top" ? "vertical-align:bottom;padding-bottom:6pt;" : "vertical-align:top;padding-top:6pt;";

    const temDireita = parte.direita.length > 0;
    if (!temDireita && !parte.imagem) {
      const caixa = parte.alinhamento === "centro" ? "center" : parte.alinhamento === "direita" ? "right" : "left";
      caixas.push(`@${lado}-${caixa}{content:${conteudoCss(parte.esquerda)};${estilo};${vertical}${borda}}`);
      return;
    }

    // Esquerda (imagem e/ou texto antes do tab) + direita (texto depois do tab).
    const img = parte.imagem;
    const fundo = img
      ? `background:url("${img.dataUrl}") no-repeat left ${lado === "top" ? "bottom 6pt" : "top 6pt"} / ${img.larguraPt.toFixed(1)}pt ${img.alturaPt.toFixed(1)}pt;` +
        `min-height:${(img.alturaPt + 6).toFixed(1)}pt;`
      : "";
    const recuo = img && parte.esquerda.length ? `padding-left:${(img.larguraPt + 6).toFixed(1)}pt;` : "";
    caixas.push(`@${lado}-left{content:${conteudoCss(parte.esquerda)};text-align:left;${estilo};${vertical}${fundo}${recuo}${borda}}`);
    // A caixa do meio fica vazia mas recebe a borda, senão a linha sai partida.
    if (borda) caixas.push(`@${lado}-center{content:"";${vertical}${borda}}`);
    caixas.push(`@${lado}-right{content:${conteudoCss(parte.direita)};text-align:right;${estilo};${vertical}${borda}}`);
  };

  if (layout.cabecalho) montar(layout.cabecalho, "top");
  if (layout.rodape) montar(layout.rodape, "bottom");

  return (
    `@page{size:${layout.largura.toFixed(1)}pt ${layout.altura.toFixed(1)}pt;` +
    `margin:${m.topo.toFixed(1)}pt ${m.direita.toFixed(1)}pt ${m.base.toFixed(1)}pt ${m.esquerda.toFixed(1)}pt;` +
    `${caixas.join("")}}`
  );
}
