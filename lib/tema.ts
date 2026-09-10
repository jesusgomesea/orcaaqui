export const CHAVE_TEMA = "orcaaqui-tema";

export type Tema = "light" | "dark";

/**
 * Roda antes da primeira pintura, injetado no <head> pelo layout raiz: sem ele
 * a página aparece clara por um instante para quem escolheu escuro. Precisa
 * ser uma string porque vai inline no HTML, antes de qualquer JS do React.
 *
 * Mora num módulo sem React de propósito — o layout raiz é Server Component e
 * não pode importar de um arquivo que traga hooks junto.
 */
export const SCRIPT_TEMA = `(function(){try{var s=localStorage.getItem("${CHAVE_TEMA}");var t=s||(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");if(t==="dark")document.documentElement.classList.add("dark");}catch(e){}})();`;
