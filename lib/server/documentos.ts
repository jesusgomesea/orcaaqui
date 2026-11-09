import "server-only";

import { getStore } from "@netlify/blobs";
import type { DocumentoGerado, TipoDocumento } from "@/lib/tipos";

/**
 * Documentos gerados (contratos e recibos) e seus contadores.
 *
 * Ficam numa store separada, fora do estado principal, de propósito: o
 * navegador regrava o estado inteiro a cada alteração (PUT /api/dados), então
 * qualquer registro escrito pelo servidor ali seria apagado pelo próximo
 * salvamento automático. Aqui só o servidor escreve, e nada é sobrescrito.
 *
 * Chaves (todas sob o id do usuário do Identity — um usuário nunca alcança
 * os arquivos de outro):
 * - usuario/<uid>/empresa/<eid>/contador/<tipo>-<ano>.json  { ultimo }
 * - usuario/<uid>/empresa/<eid>/indice.json                 { documentos: [...] }
 * - usuario/<uid>/arquivo/<docId>                            bytes + metadata
 */
const NOME_DA_STORE = "orcaaqui-documentos";

function store() {
  return getStore({ name: NOME_DA_STORE, consistency: "strong" });
}

const prefixoEmpresa = (uid: string, eid: string) => `usuario/${uid}/empresa/${eid}`;
const chaveArquivo = (uid: string, docId: string) => `usuario/${uid}/arquivo/${docId}`;

const TENTATIVAS = 12;
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Lê–altera–grava com controle otimista: só grava se ninguém mexeu na chave
 * desde a leitura (`onlyIfMatch` com o etag lido, ou `onlyIfNew` se ainda não
 * existia). Se outra geração ganhou a corrida, relê e tenta de novo. É o que
 * garante numeração sem duplicidade com duas gerações ao mesmo tempo.
 */
async function atualizarJson<T>(chave: string, inicial: T, alterar: (atual: T) => T): Promise<T> {
  const s = store();
  for (let tentativa = 0; tentativa < TENTATIVAS; tentativa++) {
    const atual = await s.getWithMetadata(chave, { type: "json" });
    const novo = alterar(atual ? (atual.data as T) : inicial);
    const resultado = atual?.etag
      ? await s.setJSON(chave, novo, { onlyIfMatch: atual.etag })
      : await s.setJSON(chave, novo, { onlyIfNew: true });
    if (resultado.modified) return novo;
    await esperar(30 + Math.random() * 120 * (tentativa + 1));
  }
  throw new Error("Muitas gerações ao mesmo tempo. Tente de novo em instantes.");
}

/** Reserva o próximo número da sequência (por empresa, tipo e ano). Nunca reaproveita. */
export async function reservarNumero(uid: string, eid: string, tipo: TipoDocumento, ano: number): Promise<number> {
  const chave = `${prefixoEmpresa(uid, eid)}/contador/${tipo}-${ano}.json`;
  const { ultimo } = await atualizarJson(chave, { ultimo: 0 }, (c) => ({ ultimo: (Number(c.ultimo) || 0) + 1 }));
  return ultimo;
}

interface Indice {
  documentos: DocumentoGerado[];
}

export async function listarDocumentos(uid: string, eid: string): Promise<DocumentoGerado[]> {
  const indice = (await store().get(`${prefixoEmpresa(uid, eid)}/indice.json`, { type: "json" })) as Indice | null;
  return indice?.documentos ?? [];
}

/**
 * Acrescenta o documento ao índice. `versao` é calculada aqui, dentro do
 * controle otimista, para duas gerações simultâneas não ganharem a mesma.
 */
export async function registrarDocumento(
  uid: string,
  eid: string,
  doc: Omit<DocumentoGerado, "versao">
): Promise<DocumentoGerado> {
  let registrado: DocumentoGerado | null = null;
  await atualizarJson<Indice>(`${prefixoEmpresa(uid, eid)}/indice.json`, { documentos: [] }, (indice) => {
    const anteriores = (indice.documentos ?? []).filter((d) =>
      doc.tipo === "contrato"
        ? d.tipo === "contrato" && d.orcamentoId === doc.orcamentoId
        : d.tipo === "recibo" && d.pagamentoId === doc.pagamentoId
    );
    registrado = { ...doc, versao: anteriores.length + 1 };
    return { documentos: [...(indice.documentos ?? []), registrado] };
  });
  return registrado as unknown as DocumentoGerado;
}

export async function gravarArquivo(
  uid: string,
  docId: string,
  bytes: Uint8Array,
  meta: { nomeArquivo: string; contentType: string }
): Promise<void> {
  // Grava só se for novo: um arquivo gerado nunca é sobrescrito.
  const copia = bytes.slice().buffer as ArrayBuffer;
  const r = await store().set(chaveArquivo(uid, docId), copia, { metadata: meta, onlyIfNew: true });
  if (!r.modified) throw new Error("Já existe um arquivo com este identificador.");
}

export async function lerArquivo(
  uid: string,
  docId: string
): Promise<{ bytes: ArrayBuffer; nomeArquivo: string; contentType: string } | null> {
  const r = await store().getWithMetadata(chaveArquivo(uid, docId), { type: "arrayBuffer" });
  if (!r) return null;
  return {
    bytes: r.data,
    nomeArquivo: String(r.metadata?.nomeArquivo ?? "documento"),
    contentType: String(r.metadata?.contentType ?? "application/octet-stream"),
  };
}
