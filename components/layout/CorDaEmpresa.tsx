"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { corHexValida, corSobre } from "@/lib/cor";

/**
 * Faz da cor da empresa ativa o destaque do app inteiro: escreve `--primary` e
 * `--sobre-primary` no <html> (os tons derivados saem por color-mix em
 * globals.css). Ao sair do app (landing, entrar), volta a cor da marca.
 */
export function CorDaEmpresa() {
  const { empresaAtiva } = useStore();
  const cor = empresaAtiva.corPrimaria;

  useEffect(() => {
    if (!corHexValida(cor)) return;
    const raiz = document.documentElement.style;
    raiz.setProperty("--primary", cor);
    raiz.setProperty("--sobre-primary", corSobre(cor));
    return () => {
      raiz.removeProperty("--primary");
      raiz.removeProperty("--sobre-primary");
    };
  }, [cor]);

  return null;
}
