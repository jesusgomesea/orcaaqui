import { getUser } from "@netlify/identity";
import { gravarEstadoSeIgual, lerCorpoDoPut, lerEstado } from "@/lib/server/dados";
import { comLimite, respostaDeFalha } from "@/lib/server/blobs";

// A logo vem comprimida (ver lib/imagem.ts), mas backups antigos ainda trazem
// logos grandes em data: URL — por isso o limite folgado.
const LIMITE_BYTES = 8 * 1024 * 1024;

const NAO_AUTENTICADO = { erro: "Não autenticado" };

const CONFLITO = {
  erro: "Seus dados foram alterados em outro aparelho. Recarregue para ver a versão mais nova.",
  conflito: true,
};

// Cada etapa de rede tem limite (lib/server/blobsFetch.ts): uma chamada
// travada vira 500 dizendo qual etapa foi, em vez de 502 mudo do Netlify.
const login = () => comLimite("Login (Netlify Identity)", getUser());

/** GET → `{ estado, versao }`. `estado: null` é conta nova. */
export async function GET() {
  try {
    const usuario = await login();
    if (!usuario) return Response.json(NAO_AUTENTICADO, { status: 401 });

    const { estado, versao } = await lerEstado(usuario.id);
    // `estado: null` é conta nova — o cliente decide se envia o que havia no
    // localStorage deste navegador ou começa do zero.
    return Response.json({ estado, versao }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return respostaDeFalha("dados", e);
  }
}

/**
 * PUT `{ estado, versaoBase }` → `{ ok, versao }`. Controle de versão: grava só
 * se o servidor ainda estiver na versão que este aparelho carregou; senão,
 * 409 e o app pede para recarregar — em vez de um aparelho apagar em silêncio
 * o que o outro salvou.
 */
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

  let bruto: unknown;
  try {
    const texto = await request.text();
    if (texto.length > LIMITE_BYTES) {
      return Response.json({ erro: "Dados grandes demais para salvar." }, { status: 413 });
    }
    bruto = JSON.parse(texto);
  } catch {
    return Response.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const corpo = lerCorpoDoPut(bruto);
  if (!corpo.ok) {
    return Response.json(corpo.status === 409 ? { ...CONFLITO, erro: corpo.erro } : { erro: corpo.erro }, { status: corpo.status });
  }

  try {
    const r = await gravarEstadoSeIgual(usuario.id, corpo.estado, corpo.versaoBase);
    if (!r.ok) return Response.json(CONFLITO, { status: 409 });
    return Response.json({ ok: true, versao: r.versao });
  } catch (e) {
    return respostaDeFalha("dados", e);
  }
}
