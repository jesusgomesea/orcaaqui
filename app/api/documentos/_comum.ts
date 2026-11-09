import "server-only";

import { ErroGeracao } from "@/lib/server/gerarDocumentos";

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
  console.error("Falha ao gerar documento.", e);
  return Response.json({ erro: "Não foi possível gerar o documento." }, { status: 500 });
}
