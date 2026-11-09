// Página impressa dos modelos (margens, cabeçalho e rodapé). Rodar com `npm test`.

import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import PizZip from "pizzip";
import { cssDaPagina, lerPaginaDocx } from "./paginaDocx";

const modelo = (nome: string) => new Uint8Array(readFileSync(join(process.cwd(), "templates", nome)));

test("contrato: A4, margens do modelo, logo + texto no cabeçalho e Página X de Y no rodapé", () => {
  const layout = lerPaginaDocx(modelo("contrato-prestacao-servicos.docx"));

  expect(layout.largura).toBeCloseTo(595.3, 1);
  expect(layout.altura).toBeCloseTo(841.9, 1);
  expect(layout.margens).toEqual({ topo: 65, direita: 56.7, base: 56.7, esquerda: 56.7 });

  const cab = layout.cabecalho!;
  expect(cab.imagem?.dataUrl).toMatch(/^data:image\/png;base64,/);
  expect(cab.imagem?.larguraPt).toBeCloseTo(39, 0);
  expect(cab.esquerda).toEqual([]);
  expect(cab.direita.map((t) => ("texto" in t ? t.texto : `{${t.campo}}`)).join("")).toContain("Fotografia");
  expect(cab.bordaInferior?.cor).toBe("#B8935A");

  expect(layout.rodape?.alinhamento).toBe("centro");
  expect(layout.rodape?.esquerda).toEqual([
    { texto: "Contrato de Prestação de Serviços Fotográficos  ·  Página " },
    { campo: "pagina" },
    { texto: " de " },
    { campo: "paginas" },
  ]);
});

test("recibo: rodapé com contadores de página no CSS", () => {
  const css = cssDaPagina(lerPaginaDocx(modelo("recibo-pagamento.docx")));
  expect(css).toMatch(/^@page\{size:595\.3pt 841\.9pt;margin:65\.0pt 56\.7pt 56\.7pt 56\.7pt;/);
  expect(css).toContain('@bottom-center{content:"Recibo de Pagamento  ·  Página " counter(page) " de " counter(pages)');
  expect(css).toContain("@top-left{");
  expect(css).toContain("@top-right{");
});

test("resultado já calculado de um campo não aparece junto do contador", () => {
  const zip = new PizZip(modelo("recibo-pagamento.docx"));
  const rodape = zip.file("word/footer1.xml")!.asText()
    .replace(/(<w:fldChar w:fldCharType="separate"\/>)/, '$1</w:r><w:r><w:t>7</w:t>');
  zip.file("word/footer1.xml", rodape);
  const layout = lerPaginaDocx(zip);
  const texto = layout.rodape!.esquerda.map((t) => ("texto" in t ? t.texto : "#")).join("");
  expect(texto).toBe("Recibo de Pagamento  ·  Página # de #");
});

test("texto do modelo com aspas ou barra não quebra o CSS", () => {
  const css = cssDaPagina({
    margens: { topo: 10, direita: 10, base: 10, esquerda: 10 },
    largura: 100,
    altura: 100,
    rodape: { esquerda: [{ texto: 'a "b" \\ c</style>' }], direita: [], alinhamento: "esquerda", estilo: {} },
  });
  expect(css).toContain('content:"a \\"b\\" \\\\ c\\3C /style>"');
  expect(css).not.toContain("</style>");
});
