import "server-only";

import { comLimite, storeBlobs } from "@/lib/server/blobs";
import type { EstadoApp } from "@/lib/tipos";

const NOME_DA_STORE = "orcaaqui-dados";

/**
 * Uma chave por usuário do Identity. `strong` porque o app grava e relê o
 * mesmo registro em sequência: com a consistência eventual do edge o usuário
 * poderia recarregar e ver o estado anterior.
 */
function store() {
  return storeBlobs(NOME_DA_STORE);
}

const chave = (usuarioId: string) => `usuario/${usuarioId}.json`;

export interface EstadoLido {
  estado: EstadoApp | null;
  /** Etag do blob lido — a "versão" que o navegador devolve ao salvar. null = conta nova. */
  versao: string | null;
}

export async function lerEstado(usuarioId: string): Promise<EstadoLido> {
  const lido = await comLimite(
    "Leitura dos dados (Netlify Blobs)",
    store().getWithMetadata(chave(usuarioId), { type: "json" })
  );
  if (!lido) return { estado: null, versao: null };
  return { estado: (lido.data as EstadoApp | null) ?? null, versao: lido.etag ?? null };
}

export type ResultadoGravacao = { ok: true; versao: string | null } | { ok: false };

/**
 * Grava só se o blob ainda for a versão que o navegador carregou (`onlyIfMatch`
 * com o etag) — ou, numa conta nova, só se ninguém criou antes (`onlyIfNew`).
 * Sem isso, o celular e o computador abertos ao mesmo tempo se sobrescreviam:
 * quem salvava por último apagava, sem aviso, o que o outro tinha gravado.
 */
export async function gravarEstadoSeIgual(
  usuarioId: string,
  estado: EstadoApp,
  versaoBase: string | null
): Promise<ResultadoGravacao> {
  const s = store();
  const r = await comLimite(
    "Gravação dos dados (Netlify Blobs)",
    versaoBase ? s.setJSON(chave(usuarioId), estado, { onlyIfMatch: versaoBase }) : s.setJSON(chave(usuarioId), estado, { onlyIfNew: true })
  );
  if (!r.modified) return { ok: false };
  if (r.etag) return { ok: true, versao: r.etag };
  // Algumas respostas não trazem o etag novo: pega pelos metadados.
  const meta = await comLimite("Leitura da versão (Netlify Blobs)", s.getMetadata(chave(usuarioId)));
  return { ok: true, versao: meta?.etag ?? null };
}

export { estadoValido, lerCorpoDoPut } from "./dadosValidacao";
