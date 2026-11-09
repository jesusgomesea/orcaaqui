import { lerArquivo } from "@/lib/server/documentos";
import { idValido, respostaDeErro, usuarioLogado } from "../../_comum";

/**
 * GET /api/documentos/arquivo/<id> — baixa o PDF/.docx gerado.
 * Só o dono acessa: a chave do arquivo fica sob o id do usuário logado.
 * A URL leva só o id do documento (nada de CPF ou nome).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let usuario;
  let arquivo;
  try {
    usuario = await usuarioLogado();
    if (!usuario) return Response.json({ erro: "Não autenticado" }, { status: 401 });

    const { id } = await params;
    if (!idValido(id)) return Response.json({ erro: "Documento inválido." }, { status: 400 });

    arquivo = await lerArquivo(usuario.id, id);
  } catch (e) {
    return respostaDeErro(e);
  }
  if (!arquivo) return Response.json({ erro: "Documento não encontrado." }, { status: 404 });

  const ascii = arquivo.nomeArquivo.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/"/g, "");
  return new Response(arquivo.bytes, {
    headers: {
      "Content-Type": arquivo.contentType,
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(arquivo.nomeArquivo)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
