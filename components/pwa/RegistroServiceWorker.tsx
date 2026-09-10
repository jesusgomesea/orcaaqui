"use client";

import { useEffect } from "react";

/**
 * Registra o service worker, que é o que habilita a instalação do app. Só em
 * produção: em desenvolvimento o cache de estáticos atrapalharia o hot reload.
 */
export default function RegistroServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((e) => {
      console.error("Não foi possível registrar o service worker.", e);
    });
  }, []);

  return null;
}
