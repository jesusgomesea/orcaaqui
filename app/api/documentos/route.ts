import { getUser } from "@netlify/identity";
import { listarDocumentos } from "@/lib/server/documentos";
import { conversorConfigurado } from "@/lib/server/pdf";
import { idValido } from "./_comum";

/** GET /api/documentos?empresaId=... — histórico de contratos e recibos da empresa. */
export async function GET(request: Request) {
  const usuario = await getUser();
  if (!usuario) return Response.json({ erro: "Não autenticado" }, { status: 401 });

  const empresaId = new URL(request.url).searchParams.get("empresaId");
  if (!idValido(empresaId)) return Response.json({ erro: "Empresa inválida." }, { status: 400 });

  const documentos = await listarDocumentos(usuario.id, empresaId);
  return Response.json({ documentos, pdfDisponivel: conversorConfigurado() });
}
