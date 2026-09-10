"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { login, signup } from "@netlify/identity";
import { useSessao } from "@/components/auth/ProvedorSessao";
import MolduraAuth from "@/components/auth/MolduraAuth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

type Modo = "entrar" | "cadastrar";

export default function EntrarPage() {
  const { usuario, carregando } = useSessao();
  const [modo, setModo] = useState<Modo>("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Quem já tem sessão não precisa desta tela.
  useEffect(() => {
    if (!carregando && usuario) window.location.href = "/painel";
  }, [carregando, usuario]);

  const trocarModo = (novo: Modo) => {
    setModo(novo);
    setErro("");
    setAviso("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro("");
    setAviso("");

    if (modo === "cadastrar" && senha.length < 8) {
      setErro("A senha precisa ter ao menos 8 caracteres.");
      return;
    }

    setEnviando(true);
    try {
      if (modo === "cadastrar") {
        const criado = await signup(email, senha);
        // Com a confirmação de e-mail ligada (padrão), o cadastro NÃO abre
        // sessão: o usuário só entra depois de clicar no link.
        if (!criado.confirmedAt) {
          setAviso(`Enviamos um link de confirmação para ${email}. Confirme e volte para entrar.`);
          setEnviando(false);
          return;
        }
      } else {
        await login(email, senha);
      }
      // Navegação completa é obrigatória aqui: router.push() faz navegação
      // suave e o cookie de sessão recém-escrito não chegaria ao servidor.
      window.location.href = "/painel";
    } catch (erroDaApi: unknown) {
      setErro(
        erroDaApi instanceof Error
          ? erroDaApi.message
          : "Não foi possível concluir. Tente de novo em instantes."
      );
      setEnviando(false);
    }
  };

  return (
    <MolduraAuth
      titulo={modo === "entrar" ? "Entrar" : "Criar conta"}
      descricao={
        modo === "entrar"
          ? "Acesse seus orçamentos de qualquer dispositivo."
          : "Crie sua conta grátis e comece a montar orçamentos."
      }
      rodape={
        modo === "entrar" ? (
          <>
            Não tem conta?{" "}
            <button type="button" onClick={() => trocarModo("cadastrar")} className="font-semibold text-primary hover:underline cursor-pointer">
              Criar agora
            </button>
          </>
        ) : (
          <>
            Já tem conta?{" "}
            <button type="button" onClick={() => trocarModo("entrar")} className="font-semibold text-primary hover:underline cursor-pointer">
              Entrar
            </button>
          </>
        )
      }
    >
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <Label>E-mail</Label>
          <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </div>
        <div className="mb-3">
          <Label>Senha</Label>
          <Input
            type="password"
            required
            autoComplete={modo === "entrar" ? "current-password" : "new-password"}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </div>

        {erro && <p className="mb-3 text-[12.5px] font-medium text-danger">{erro}</p>}
        {aviso && <p className="mb-3 text-[12.5px] font-medium text-success">{aviso}</p>}

        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? "Aguarde…" : modo === "entrar" ? "Entrar" : "Criar conta"}
        </Button>
      </form>

      {modo === "entrar" && (
        <div className="mt-3 text-center">
          <Link href="/recuperar-senha" className="text-[12.5px] text-text-muted hover:text-text hover:underline">
            Esqueci minha senha
          </Link>
        </div>
      )}
    </MolduraAuth>
  );
}
