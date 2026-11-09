import { getUser } from "@netlify/identity";
import { gerarRecibo } from "@/lib/server/gerarDocumentos";
import { idValido, lerCorpo, respostaDeErro } from "../_comum";

/** POST { empresaId, orcamentoId, pagamentoId } — gera o recibo de um pagamento. */
export async function POST(request: Request) {
  const usuario = await getUser();
  if (!usuario) return Response.json({ erro: "Não autenticado" }, { status: 401 });

  const corpo = await lerCorpo(request);
  if (!corpo || !idValido(corpo.empresaId) || !idValido(corpo.orcamentoId) || !idValido(corpo.pagamentoId)) {
    return Response.json({ erro: "Requisição inválida." }, { status: 400 });
  }

  try {
    const documento = await gerarRecibo(usuario.id, corpo.empresaId, corpo.orcamentoId, corpo.pagamentoId);
    return Response.json({ documento });
  } catch (e) {
    return respostaDeErro(e);
  }
}
