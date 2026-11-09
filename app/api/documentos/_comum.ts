import "server-only";

import { getUser } from "@netlify/identity";
import { comLimite, respostaDeFalha } from "@/lib/server/blobs";
import { ErroGeracao } from "@/lib/server/gerarDocumentos";

/** Login com limite de tempo: se o Identity travar, a resposta diz isso. */
export function usuarioLogado() {
  return comLimite("Login (Netlify Identity)", getUser());
}

/** Ids do app são uuids; recusar qualquer outra coisa evita chave estranha no Blobs. */
export function idValido(v: unknown): v is string {
  return typeof v === "string" && /^[A-Za-z0-9-]{1,64}$/.test(v);
}

export async function lerCorpo(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const corpo = await request.json();
    return typeof corpo === "object" && corpo !== null ? (corpo as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function respostaDeErro(e: unknown): Response {
  if (e instanceof ErroGeracao) {
    return Response.json({ erro: e.message, faltando: e.faltando }, { status: e.status });
  }
  return respostaDeFalha("documentos", e);
}
