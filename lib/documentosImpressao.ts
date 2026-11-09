"use client";

// PDF de contrato/recibo sem servidor de conversão: o .docx já preenchido pelo
// servidor é desenhado no navegador (docx-preview) dentro do `#orcamento-print`
// e vai para `window.print()` — o mesmo caminho do PDF do orçamento. O texto e
// a formatação vêm do modelo; margens, cabeçalho e "Página X de Y" viram uma
// regra `@page` montada a partir do próprio .docx (lib/documentos/paginaDocx.ts).

import type { DocumentoGerado } from "./tipos";
import { cssDaPagina, lerPaginaDocx } from "./documentos/paginaDocx";

const ID_CONTAINER = "orcamento-print";
const ID_ESTILO_PAGINA = "docx-pagina-impressao";

async function baixarBytes(doc: DocumentoGerado): Promise<ArrayBuffer> {
  const resposta = await fetch(`/api/documentos/arquivo/${encodeURIComponent(doc.id)}`);
  if (!resposta.ok) throw new Error(`Falha ao abrir o documento (${resposta.status}).`);
  return resposta.arrayBuffer();
}

/**
 * Tira o documento e a regra @page dele. A regra é global, então quem for
 * imprimir outra coisa no `#orcamento-print` (o PDF do orçamento) chama isto
 * antes. Não dá para limpar no `afterprint`: no celular ele dispara antes de o
 * navegador capturar a página, e o PDF sairia em branco.
 */
export function limparImpressaoDocx() {
  document.getElementById(ID_ESTILO_PAGINA)?.remove();
  const container = document.getElementById(ID_CONTAINER);
  if (!container?.classList.contains("impressao-docx")) return;
  container.classList.remove("impressao-docx");
  container.innerHTML = "";
}

/** Desenha o .docx e abre a impressão ("Salvar como PDF"). */
export async function imprimirDocx(bytes: ArrayBuffer, titulo?: string) {
  const container = document.getElementById(ID_CONTAINER);
  if (!container) throw new Error("Área de impressão não encontrada.");

  // Carregado só aqui: a biblioteca é grande e só serve na hora de imprimir.
  const { renderAsync } = await import("docx-preview");

  limparImpressaoDocx();
  const estilos = document.createElement("div");
  const corpo = document.createElement("div");
  container.append(estilos, corpo);
  container.classList.add("impressao-docx");

  await renderAsync(bytes, corpo, estilos, {
    inWrapper: false,
    // Cabeçalho e rodapé saem da regra @page, repetidos em toda página.
    renderHeaders: false,
    renderFooters: false,
    renderFootnotes: true,
    renderEndnotes: true,
    // Página é do navegador: só quebras explícitas viram página nova.
    breakPages: true,
    ignoreLastRenderedPageBreak: true,
    ignoreWidth: false,
    ignoreHeight: false,
    useBase64URL: true,
    renderComments: false,
    renderChanges: false,
  });

  const estiloPagina = document.createElement("style");
  estiloPagina.id = ID_ESTILO_PAGINA;
  estiloPagina.textContent = cssDaPagina(lerPaginaDocx(bytes));
  document.head.appendChild(estiloPagina);

  // Fontes e imagens precisam estar prontas antes de o navegador paginar.
  await document.fonts?.ready;
  await Promise.all(
    [...corpo.querySelectorAll("img")].map((img) =>
      img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; })
    )
  );

  // O título da aba vira o nome sugerido do PDF ao salvar.
  const tituloAntes = document.title;
  if (titulo) document.title = titulo;

  const depois = () => {
    window.removeEventListener("afterprint", depois);
    document.title = tituloAntes;
  };
  window.addEventListener("afterprint", depois);
  window.print();
}

/** Abre a impressão do documento do histórico. PDF já convertido só é baixado. */
export async function imprimirDocumento(doc: DocumentoGerado) {
  const bytes = await baixarBytes(doc);
  await imprimirDocx(bytes, doc.nomeArquivo.replace(/\.(docx|pdf)$/i, ""));
}
