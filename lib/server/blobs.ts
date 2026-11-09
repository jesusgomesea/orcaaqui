import "server-only";

import { getStore } from "@netlify/blobs";
import { semCorpoSeDescartavel } from "./blobsFetch";

export { comLimite, EtapaTravada } from "./blobsFetch";

/**
 * Resposta da última chamada ao Blobs, para diagnóstico na mensagem de erro.
 * Guarda só status e host — nunca URL nem token.
 */
let ultimaTentativa = "nenhuma chamada feita";
export function ultimaTentativaBlobs(): string {
  return ultimaTentativa;
}

/**
 * `fetch` entregue ao Blobs no lugar do global:
 * - usa o `fetch` original do Node, não a camada de cache que o Next põe por
 *   cima do global (guardado em `_nextOriginalFetch`) — com ela a leitura
 *   travava no Netlify. Resolvido a cada chamada porque o Next pode trocar o
 *   global depois que este módulo carregou;
 * - devolve sem corpo as respostas que o Blobs descarta (ver
 *   `semCorpoSeDescartavel`);
 * - anota a última resposta para a mensagem de erro.
 */
const fetchParaBlobs: typeof fetch = async (url, init) => {
  const base =
    (globalThis.fetch as typeof fetch & { _nextOriginalFetch?: typeof fetch })._nextOriginalFetch ?? globalThis.fetch;
  let host = "?";
  try {
    host = new URL(url instanceof Request ? url.url : String(url)).host;
  } catch {}
  try {
    const r = await base(url, init);
    ultimaTentativa = `HTTP ${r.status} de ${host}`;
    if (!r.ok && r.status !== 404 && r.status !== 412) console.warn(`[blobs] ${ultimaTentativa}`);
    return semCorpoSeDescartavel(r, init?.method ?? (url instanceof Request ? url.method : "GET"));
  } catch (e) {
    ultimaTentativa = `erro de rede com ${host}: ${e instanceof Error ? `${e.name} ${e.message}` : String(e)}`.slice(0, 200);
    console.warn(`[blobs] ${ultimaTentativa}`);
    throw e;
  }
};

/** Toda store do app passa por aqui — nunca chamar `getStore` direto. */
export function storeBlobs(nome: string, consistency: "strong" | "eventual" = "strong") {
  return getStore({ name: nome, consistency, fetch: fetchParaBlobs });
}

/**
 * Falha de servidor vira um 500 com a causa na mensagem, em vez de derrubar a
 * função. Diz só SE a configuração do Blobs chegou (nunca o conteúdo, que tem token).
 */
export function respostaDeFalha(contexto: string, e: unknown): Response {
  console.error(`[${contexto}] falha:`, e);
  const causa = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  const config =
    (globalThis as { netlifyBlobsContext?: unknown }).netlifyBlobsContext || process.env.NETLIFY_BLOBS_CONTEXT;
  return Response.json(
    {
      erro: `Não foi possível acessar seus dados no servidor (${causa}; config. do Blobs ${config ? "presente" : "ausente"}; última resposta do Blobs: ${ultimaTentativa}).`,
    },
    { status: 500 }
  );
}
