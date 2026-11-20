"use client";

import { useLayoutEffect } from "react";
import { lerTemaSalvo } from "@/lib/tema";
import { suportaRefracao } from "@/components/layout/CenaVidro";

/**
 * Devolve ao <html> as classes que os scripts do <head> põem antes da pintura
 * (`dark` do SCRIPT_TEMA e `refract` do SCRIPT_REFRACAO).
 *
 * Por quê: a Netlify injeta um comentário ("This site is hosted on Netlify…")
 * no <head> do HTML servido. O React acusa a diferença na hidratação (erro
 * #418), refaz a página inteira no cliente e, ao reaproveitar o <html>, apaga
 * os atributos que não vieram do JSX — o tema voltava para o claro a cada
 * recarregamento. useLayoutEffect roda depois desse commit e antes da pintura,
 * então não pisca.
 */
export function ClassesDoHtml() {
  useLayoutEffect(() => {
    const raiz = document.documentElement;
    raiz.classList.toggle("dark", lerTemaSalvo() === "dark");
    if (suportaRefracao()) raiz.classList.add("refract");
  }, []);
  return null;
}
