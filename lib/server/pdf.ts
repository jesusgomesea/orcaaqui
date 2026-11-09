import "server-only";

/**
 * Conversão .docx → PDF via Gotenberg (LibreOffice num contêiner próprio).
 * A Netlify não consegue rodar LibreOffice nas Functions, por isso o serviço
 * fica fora e é chamado por HTTP.
 *
 * Variáveis de ambiente (painel da Netlify → Site configuration → Environment):
 * - GOTENBERG_URL       ex.: https://gotenberg.seudominio.com (sem barra final)
 * - GOTENBERG_USUARIO / GOTENBERG_SENHA  opcionais, se o Gotenberg estiver com
 *   `--api-enable-basic-auth` (recomendado: os documentos levam CPF).
 *
 * Sem GOTENBERG_URL, `converterParaPdf` devolve null e o documento é entregue
 * em .docx — a geração não para, mas a tela avisa.
 */
export function conversorConfigurado(): boolean {
  return Boolean(process.env.GOTENBERG_URL);
}

// Abaixo do corte da função no Netlify (~10 s), somado às etapas do Blobs: assim
// a resposta ainda chega dizendo que a conversão demorou. Normal: 1–3 s.
const TEMPO_LIMITE_MS = 6_000;

export async function converterParaPdf(docx: Uint8Array): Promise<Uint8Array | null> {
  const base = process.env.GOTENBERG_URL?.replace(/\/+$/, "");
  if (!base) return null;

  const form = new FormData();
  // O nome enviado só precisa da extensão certa: nada de CPF nem nome do cliente.
  form.append(
    "files",
    new Blob([docx as BlobPart], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }),
    "documento.docx"
  );

  const headers: Record<string, string> = {};
  const usuario = process.env.GOTENBERG_USUARIO;
  const senha = process.env.GOTENBERG_SENHA;
  if (usuario && senha) headers.Authorization = `Basic ${Buffer.from(`${usuario}:${senha}`).toString("base64")}`;

  const resposta = await fetch(`${base}/forms/libreoffice/convert`, {
    method: "POST",
    body: form,
    headers,
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });
  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => "");
    throw new Error(`Gotenberg respondeu ${resposta.status}: ${detalhe.slice(0, 200)}`);
  }
  return new Uint8Array(await resposta.arrayBuffer());
}
