export const CHAVE_TEMA = "orcaaqui-tema";

export type Tema = "light" | "dark";

/**
 * Escuro é o padrão de quem nunca escolheu (visual novo, inspirado no orgfinapp).
 *
 * Roda antes da primeira pintura, injetado no <head> pelo layout raiz: sem ele
 * a página aparece clara por um instante para quem escolheu escuro. Precisa
 * ser uma string porque vai inline no HTML, antes de qualquer JS do React.
 *
 * Quando a hidratação falha (a Netlify injeta um comentário no <head> e o React
 * refaz a página inteira), o React apaga as classes do <html> — o
 * ClassesDoHtml (layout raiz) as devolve antes da pintura.
 *
 * Mora num módulo sem React de propósito — o layout raiz é Server Component e
 * não pode importar de um arquivo que traga hooks junto.
 */
export const SCRIPT_TEMA = `(function(){var s=null;try{s=localStorage.getItem("${CHAVE_TEMA}");}catch(e){}if(s!=="light")document.documentElement.classList.add("dark");})();`;

/** Mesma regra do SCRIPT_TEMA: só "light" salvo dá claro; nada salvo ou erro dá escuro. */
export function temaDe(salvo: string | null): Tema {
  return salvo === "light" ? "light" : "dark";
}

/** Tema escolhido pelo usuário (localStorage bloqueado = padrão escuro). Só no navegador. */
export function lerTemaSalvo(): Tema {
  try {
    return temaDe(localStorage.getItem(CHAVE_TEMA));
  } catch {
    return temaDe(null);
  }
}
