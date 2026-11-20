/**
 * Fundo vivo do Liquid Glass + filtro SVG de refração (#lg-refract). Sem cor
 * atrás, vidro é só cinza: as formas usam a cor da empresa (--primary) e dois
 * tons vizinhos (--cena-2/--cena-3, em app/vidro.css). Server Component estático.
 */
export function CenaVidro() {
  return (
    <>
      <div className="cena-vidro" aria-hidden="true">
        <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
          <defs>
            <filter id="cena-brilho" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="40" />
            </filter>
          </defs>
          <g className="deriva-a" filter="url(#cena-brilho)" fill="none" strokeLinecap="round">
            <path d="M-100 760 C 300 560, 620 900, 1000 640 S 1500 380, 1750 520" style={{ stroke: "var(--cena-1)" }} strokeWidth="130" opacity=".5" />
            <path d="M-120 260 C 260 120, 520 420, 880 300 S 1400 60, 1720 180" style={{ stroke: "var(--cena-2)" }} strokeWidth="110" opacity=".35" />
            <circle cx="1320" cy="820" r="210" style={{ fill: "var(--cena-3)" }} opacity=".28" />
          </g>
          <g className="deriva-b" filter="url(#cena-brilho)" fill="none">
            <path d="M200 1080 C 420 760, 760 820, 980 980" style={{ stroke: "var(--cena-3)" }} strokeWidth="120" opacity=".3" />
            <circle cx="360" cy="140" r="190" style={{ fill: "var(--cena-1)" }} opacity=".3" />
          </g>
        </svg>
      </div>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <filter id="lg-refract" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.009" numOctaves={2} seed={7} result="noise" />
          <feGaussianBlur in="noise" stdDeviation="2" result="map" />
          <feDisplacementMap in="SourceGraphic" in2="map" scale="34" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
    </>
  );
}

/** Liga a refração só em Chromium (único que aceita url() no backdrop-filter). Inline no <head>. */
export const SCRIPT_REFRACAO =
  'try{if(navigator.userAgentData&&navigator.userAgentData.brands.some(function(b){return /Chromium/.test(b.brand)}))document.documentElement.classList.add("refract")}catch(e){}';

/** Mesma detecção do SCRIPT_REFRACAO, para o ClassesDoHtml reaplicar depois da hidratação. */
export function suportaRefracao(): boolean {
  try {
    const ua = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData;
    return Boolean(ua?.brands.some((b) => /Chromium/.test(b.brand)));
  } catch {
    return false;
  }
}
