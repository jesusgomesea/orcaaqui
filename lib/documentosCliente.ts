"use client";

import { useCallback, useEffect, useState } from "react";
import type { DocumentoGerado } from "./tipos";

/** Erro de geração: `faltando` traz a lista do que precisa ser preenchido. */
export class ErroDocumento extends Error {
  faltando: string[];
  constructor(mensagem: string, faltando: string[] = []) {
    super(mensagem);
    this.faltando = faltando;
  }
}

async function postar(url: string, corpo: Record<string, string>): Promise<DocumentoGerado> {
  const resposta = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  const dados = (await resposta.json().catch(() => ({}))) as {
    documento?: DocumentoGerado;
    erro?: string;
    faltando?: string[];
  };
  if (!resposta.ok || !dados.documento) {
    throw new ErroDocumento(dados.erro || `Falha ao gerar (${resposta.status}).`, dados.faltando || []);
  }
  return dados.documento;
}

export function gerarContrato(empresaId: string, orcamentoId: string) {
  return postar("/api/documentos/contrato", { empresaId, orcamentoId });
}

export function gerarRecibo(empresaId: string, orcamentoId: string, pagamentoId: string) {
  return postar("/api/documentos/recibo", { empresaId, orcamentoId, pagamentoId });
}

interface RespostaLista {
  documentos: DocumentoGerado[];
  pdfDisponivel: boolean;
}

async function buscarDocumentos(empresaId: string): Promise<RespostaLista> {
  const resposta = await fetch(`/api/documentos?empresaId=${encodeURIComponent(empresaId)}`);
  if (!resposta.ok) throw new Error(String(resposta.status));
  return (await resposta.json()) as RespostaLista;
}

const ERRO_LISTA = "Não foi possível carregar o histórico de documentos.";

/** Histórico de documentos da empresa, com recarga manual após gerar. */
export function useDocumentos(empresaId: string) {
  const [documentos, setDocumentos] = useState<DocumentoGerado[]>([]);
  const [pdfDisponivel, setPdfDisponivel] = useState(true);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const aplicar = useCallback((dados: RespostaLista) => {
    setDocumentos(dados.documentos);
    setPdfDisponivel(dados.pdfDisponivel);
    setErro("");
  }, []);

  useEffect(() => {
    let vivo = true;
    buscarDocumentos(empresaId)
      .then((dados) => vivo && aplicar(dados))
      .catch(() => vivo && setErro(ERRO_LISTA))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [empresaId, aplicar]);

  const recarregar = useCallback(async () => {
    try {
      aplicar(await buscarDocumentos(empresaId));
    } catch {
      setErro(ERRO_LISTA);
    }
  }, [empresaId, aplicar]);

  return { documentos, pdfDisponivel, carregando, erro, recarregar };
}

async function baixarBlob(doc: DocumentoGerado): Promise<Blob> {
  const resposta = await fetch(`/api/documentos/arquivo/${encodeURIComponent(doc.id)}`);
  if (!resposta.ok) throw new Error(`Falha ao baixar (${resposta.status}).`);
  return resposta.blob();
}

export async function baixarDocumento(doc: DocumentoGerado) {
  const blob = await baixarBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = doc.nomeArquivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Compartilha pelo menu nativo (no celular, inclui o WhatsApp). Sem suporte a
 * arquivos no navegador, cai no download. O envio continua manual.
 */
export async function compartilharDocumento(doc: DocumentoGerado): Promise<"compartilhado" | "baixado"> {
  const blob = await baixarBlob(doc);
  const arquivo = new File([blob], doc.nomeArquivo, { type: blob.type });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: doc.nomeArquivo });
      return "compartilhado";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "compartilhado";
      throw e;
    }
  }
  await baixarDocumento(doc);
  return "baixado";
}
