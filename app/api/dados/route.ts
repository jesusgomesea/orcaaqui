import { getUser } from "@netlify/identity";
import { estadoValido, gravarEstado, lerEstado } from "@/lib/server/dados";

// Logo em data: URL cabe no estado, então o corpo pode passar de 1MB.
const LIMITE_BYTES = 8 * 1024 * 1024;

const NAO_AUTENTICADO = { erro: "Não autenticado" };

export async function GET() {
  const usuario = await getUser();
  if (!usuario) return Response.json(NAO_AUTENTICADO, { status: 401 });

  const estado = await lerEstado(usuario.id);
  // `estado: null` é conta nova — o cliente decide se envia o que havia no
  // localStorage deste navegador ou começa do zero.
  return Response.json({ estado });
}

export async function PUT(request: Request) {
  const usuario = await getUser();
  if (!usuario) return Response.json(NAO_AUTENTICADO, { status: 401 });

  const tamanho = Number(request.headers.get("content-length") || 0);
  if (tamanho > LIMITE_BYTES) {
    return Response.json({ erro: "Dados grandes demais para salvar." }, { status: 413 });
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  if (!estadoValido(corpo)) {
    return Response.json({ erro: "Formato de dados inesperado." }, { status: 400 });
  }

  await gravarEstado(usuario.id, corpo);
  return Response.json({ ok: true });
}
