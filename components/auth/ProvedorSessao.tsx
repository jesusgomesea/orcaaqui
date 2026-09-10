"use client";

import { getUser, handleAuthCallback, onAuthChange, type User } from "@netlify/identity";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface Sessao {
  usuario: User | null;
  carregando: boolean;
}

const ContextoSessao = createContext<Sessao>({ usuario: null, carregando: true });

export function useSessao() {
  return useContext(ContextoSessao);
}

// Os links de confirmação/recuperação/troca de e-mail voltam com o token no
// hash da URL e podem cair em QUALQUER página — por isso o tratamento mora no
// provedor, montado no layout raiz, e não numa rota /callback dedicada.
const HASH_DE_AUTENTICACAO =
  /^#(confirmation_token|recovery_token|invite_token|email_change_token|access_token)=/;

function temTokenNoHash() {
  return typeof window !== "undefined" && HASH_DE_AUTENTICACAO.test(window.location.hash);
}

export default function ProvedorSessao({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [carregando, setCarregando] = useState(true);
  // Já no primeiro render, senão a página pisca por baixo do token antes do
  // redirecionamento.
  const [processandoLink, setProcessandoLink] = useState(temTokenNoHash);
  const [erroDoLink, setErroDoLink] = useState("");

  useEffect(() => {
    let vivo = true;
    getUser().then((u) => {
      if (!vivo) return;
      setUsuario(u);
      setCarregando(false);
    });
    const cancelar = onAuthChange((_evento, u) => setUsuario(u));
    return () => {
      vivo = false;
      cancelar();
    };
  }, []);

  useEffect(() => {
    if (!temTokenNoHash()) return;

    handleAuthCallback()
      .then((resultado) => {
        if (!resultado) {
          setProcessandoLink(false);
          return;
        }
        // Na recuperação o usuário JÁ está logado, mas ainda sem senha nova.
        // Navegação completa é obrigatória: o cookie de sessão recém-escrito
        // precisa chegar ao servidor na próxima requisição.
        window.location.href = resultado.type === "recovery" ? "/nova-senha" : "/";
      })
      .catch((erro: unknown) => {
        setErroDoLink(erro instanceof Error ? erro.message : "Não foi possível validar o link.");
        setProcessandoLink(false);
      });
  }, []);

  if (processandoLink || erroDoLink) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        {erroDoLink ? (
          <div>
            <p className="mb-2 text-[14px] font-semibold text-danger">Link inválido ou expirado</p>
            <p className="mb-4 text-[13px] text-text-muted">{erroDoLink}</p>
            <a href="/entrar" className="text-[13px] font-semibold text-primary hover:underline">
              Voltar para a tela de entrada
            </a>
          </div>
        ) : (
          <p className="text-[13.5px] text-text-muted">Validando o link…</p>
        )}
      </div>
    );
  }

  return <ContextoSessao.Provider value={{ usuario, carregando }}>{children}</ContextoSessao.Provider>;
}
