// Cor de destaque vinda da empresa (`Empresa.corPrimaria`). Qualquer cor que a
// pessoa escolher precisa funcionar: aqui sai a cor do texto/ícone que vai em
// cima dela (preto ou branco, o que tiver mais contraste).

export const COR_MARCA = "#c6f432";

export function corHexValida(cor: string | undefined | null): cor is string {
  return /^#[0-9a-f]{6}$/i.test(String(cor ?? ""));
}

/** Luminância relativa (WCAG) de uma cor #rrggbb, de 0 (preto) a 1 (branco). */
export function luminancia(hex: string): number {
  const canal = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
}

/** Preto ou branco em cima da cor — o que der mais contraste. */
export function corSobre(hex: string): "#0a0a0a" | "#ffffff" {
  const l = luminancia(hex);
  const contrastePreto = (l + 0.05) / (0.0 + 0.05);
  const contrasteBranco = 1.05 / (l + 0.05);
  return contrastePreto >= contrasteBranco ? "#0a0a0a" : "#ffffff";
}
