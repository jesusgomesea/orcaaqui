import { getUser } from "@netlify/identity";
import { estadoValido, gravarEstado, lerEstado } from "@/lib/server/dados";
import { comLimite, respostaDeFalha } from "@/lib/server/blobs";

// Logo em data: URL cabe no estado, então o corpo pode passar de 1MB.
const LIMITE_BYTES = 8 * 1024 * 1024;

const NAO_AUTENTICADO = { erro: "Não autenticado" };

// Cada etapa de rede tem limite (lib/server/blobsFetch.ts): uma chamada
// travada vira 500 dizendo qual etapa foi, em vez de 502 mudo do Netlify.
const login = () => comLimite("Login (Netlify Identity)", getUser());

export async function GET() {
  try {
    const usuario = await login();
    if (!usuario) return Response.json(NAO_AUTENTICADO, { status: 401 });

    const estado = await lerEstado(usuario.id);
    // `estado: null` é conta nova — o cliente decide se envia o que havia no
    // localStorage deste navegador ou começa do zero.
    return Response.json({ estado }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return respostaDeFalha("dados", e);
  }
}

export async function PUT(request: Request) {
  let usuario;
  try {
    usuario = await login();
  } catch (e) {
    return respostaDeFalha("dados", e);
  }
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

  try {
    await gravarEstado(usuario.id, corpo);
  } catch (e) {
    return respostaDeFalha("dados", e);
  }
  return Response.json({ ok: true });
}
