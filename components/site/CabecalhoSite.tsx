"use client";

import Link from "next/link";
import { useSessao } from "@/components/auth/ProvedorSessao";
import BotaoTema from "@/components/layout/BotaoTema";

export default function CabecalhoSite() {
  const { usuario, carregando } = useSessao();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-[1080px] items-center justify-between gap-3 px-5">
        <Link href="/" className="text-[17px] font-bold text-text">
          Orça <span className="text-primary">Aqui</span>
        </Link>
        <div className="flex items-center gap-2">
          <BotaoTema />
          {/* Enquanto a sessão não resolve, nada aparece: mostrar "Entrar" e
              trocar por "Abrir painel" logo depois é pior que o vazio. */}
          {!carregando &&
            (usuario ? (
              <Link
                href="/painel"
                className="inline-flex h-9 items-center rounded-md border border-primary bg-gradient-to-b from-primary-light to-primary px-4 text-sm font-semibold text-white shadow-sm hover:from-primary hover:to-primary-dark"
              >
                Abrir painel
              </Link>
            ) : (
              <>
                <Link
                  href="/entrar"
                  className="inline-flex h-9 items-center rounded-md px-3 text-sm font-semibold text-text-muted hover:bg-bg hover:text-text"
                >
                  Entrar
                </Link>
                <Link
                  href="/criar-conta"
                  className="inline-flex h-9 items-center rounded-md border border-primary bg-gradient-to-b from-primary-light to-primary px-4 text-sm font-semibold text-white shadow-sm hover:from-primary hover:to-primary-dark"
                >
                  Criar conta
                </Link>
              </>
            ))}
        </div>
      </div>
    </header>
  );
}
