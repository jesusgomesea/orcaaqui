// Compressão da logo da empresa. A logo mora no estado da conta como data: URL,
// então vai junto em TODO salvamento automático (e no `pagehide`, cujo
// `keepalive` recusa corpos acima de 64 KB). Uma foto de celular de 1,5 MB
// virava ~2 MB a cada tecla salva; reduzida, fica em torno de 10–40 KB.

/** Lado maior da logo, em pixels. No orçamento ela aparece com 48px de altura; 400 dá folga para tela retina e impressão. */
export const LADO_MAXIMO_LOGO = 400;

/** Logos já gravadas acima disto são comprimidas ao abrir a conta (data: URL, em caracteres). */
export const LIMITE_LOGO_LEVE = 80_000;

/** Encaixa (largura, altura) dentro de um quadrado de `maximo`, sem aumentar imagem pequena. */
export function dimensoesAjustadas(largura: number, altura: number, maximo = LADO_MAXIMO_LOGO): { largura: number; altura: number } {
  if (largura <= 0 || altura <= 0) return { largura: 0, altura: 0 };
  const escala = Math.min(1, maximo / Math.max(largura, altura));
  return { largura: Math.max(1, Math.round(largura * escala)), altura: Math.max(1, Math.round(altura * escala)) };
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    img.src = src;
  });
}

function lerComoDataUrl(arquivo: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    leitor.readAsDataURL(arquivo);
  });
}

/**
 * Reduz para no máximo 400px e regrava em WebP (mantém transparência); onde o
 * navegador não gera WebP, PNG. Se o resultado não ficar menor, devolve o
 * original. SVG passa direto: já é leve e vetorial. Só roda no navegador.
 */
export async function comprimirLogo(origem: Blob | string): Promise<string> {
  const original = typeof origem === "string" ? origem : await lerComoDataUrl(origem);
  if (original.startsWith("data:image/svg+xml")) return original;

  const img = await carregarImagem(original);
  const { largura, altura } = dimensoesAjustadas(img.naturalWidth, img.naturalHeight);
  if (!largura || !altura) return original;

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) return original;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, largura, altura);

  let comprimida = canvas.toDataURL("image/webp", 0.85);
  // Safari antigo devolve PNG quando não sabe gerar WebP.
  if (!comprimida.startsWith("data:image/webp")) comprimida = canvas.toDataURL("image/png");
  return comprimida.length < original.length ? comprimida : original;
}

/** "38 KB" — tamanho aproximado de uma data: URL em base64. */
export function tamanhoDataUrl(dataUrl: string): string {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bytes = Math.round((base64.length * 3) / 4);
  return bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`;
}
