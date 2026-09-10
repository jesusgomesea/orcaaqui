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

  // O header é uma triagem barata, mas quem envia é que o preenche (e pode
  // omitir). O limite que vale é o do corpo já lido.
  const declarado = Number(request.headers.get("content-length") || 0);
  if (declarado > LIMITE_BYTES) {
    return Response.json({ erro: "Dados grandes demais para salvar." }, { status: 413 });
  }

  let corpo: unknown;
  try {
    const texto = await request.text();
    if (texto.length > LIMITE_BYTES) {
      return Response.json({ erro: "Dados grandes demais para salvar." }, { status: 413 });
    }
    corpo = JSON.parse(texto);
  } catch {
    return Response.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  if (!estadoValido(corpo)) {
    return Response.json({ erro: "Formato de dados inesperado." }, { status: 400 });
  }

  await gravarEstado(usuario.id, corpo);
  return Response.json({ ok: true });
}
