import { getUser } from "@netlify/identity";
import { gerarContrato } from "@/lib/server/gerarDocumentos";
import { idValido, lerCorpo, respostaDeErro } from "../_comum";

/** POST { empresaId, orcamentoId } — gera nova versão do contrato (nunca sobrescreve). */
export async function POST(request: Request) {
  const usuario = await getUser();
  if (!usuario) return Response.json({ erro: "Não autenticado" }, { status: 401 });

  const corpo = await lerCorpo(request);
  if (!corpo || !idValido(corpo.empresaId) || !idValido(corpo.orcamentoId)) {
    return Response.json({ erro: "Requisição inválida." }, { status: 400 });
  }

  try {
    const documento = await gerarContrato(usuario.id, corpo.empresaId, corpo.orcamentoId);
    return Response.json({ documento });
  } catch (e) {
    return respostaDeErro(e);
  }
}
