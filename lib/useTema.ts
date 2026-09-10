"use client";

import { useSyncExternalStore } from "react";
import { CHAVE_TEMA, type Tema } from "./tema";

// O tema de verdade mora na classe do <html>, escrita pelo SCRIPT_TEMA. Aqui
// só espelhamos isso para o React — via store externa porque no servidor não
// há como saber o que o script decidiu, e chutar causaria erro de hidratação.
const ouvintes = new Set<() => void>();
let cache: Tema | null = null;

function subscrever(aoMudar: () => void) {
  ouvintes.add(aoMudar);
  return () => {
    ouvintes.delete(aoMudar);
  };
}

function lerNoCliente(): Tema {
  if (cache === null) {
    cache = document.documentElement.classList.contains("dark") ? "dark" : "light";
  }
  return cache;
}

function lerNoServidor(): Tema {
  return "light";
}

export function definirTema(tema: Tema) {
  cache = tema;
  document.documentElement.classList.toggle("dark", tema === "dark");
  try {
    localStorage.setItem(CHAVE_TEMA, tema);
  } catch {
    // Navegador com armazenamento bloqueado: o tema vale só nesta aba.
  }
  for (const aoMudar of ouvintes) aoMudar();
}

export function useTema() {
  const tema = useSyncExternalStore(subscrever, lerNoCliente, lerNoServidor);
  return { tema, alternarTema: () => definirTema(tema === "dark" ? "light" : "dark") };
}
