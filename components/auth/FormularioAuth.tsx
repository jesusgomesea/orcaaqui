"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { login, signup } from "@netlify/identity";
import { useSessao } from "@/components/auth/ProvedorSessao";
import MolduraAuth from "@/components/auth/MolduraAuth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export type ModoAuth = "entrar" | "cadastrar";

/**
 * Uma rota por modo (/entrar e /criar-conta) em vez de `?modo=` — ler query
 * string exigiria useSearchParams() e um limite de Suspense em volta do
 * formulário, senão o prerender quebra o build.
 */
export default function FormularioAuth({ modo }: { modo: ModoAuth }) {
  const { usuario, carregando } = useSessao();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);

  const cadastrando = modo === "cadastrar";

  // Quem já tem sessão não precisa desta tela.
  useEffect(() => {
    if (!carregando && usuario) window.location.href = "/painel";
  }, [carregando, usuario]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro("");
    setAviso("");

    if (cadastrando && senha.length < 8) {
      setErro("A senha precisa ter ao menos 8 caracteres.");
      return;
    }

    setEnviando(true);
    try {
      if (cadastrando) {
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
      titulo={cadastrando ? "Criar conta" : "Entrar"}
      descricao={
        cadastrando
          ? "Crie sua conta grátis e comece a montar orçamentos."
          : "Acesse seus orçamentos de qualquer dispositivo."
      }
      rodape={
        cadastrando ? (
          <>Já tem conta? <Link href="/entrar" className="font-semibold text-primary hover:underline">Entrar</Link></>
        ) : (
          <>Não tem conta? <Link href="/criar-conta" className="font-semibold text-primary hover:underline">Criar agora</Link></>
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
            autoComplete={cadastrando ? "new-password" : "current-password"}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </div>

        {erro && <p className="mb-3 text-[12.5px] font-medium text-danger">{erro}</p>}
        {aviso && <p className="mb-3 text-[12.5px] font-medium text-success">{aviso}</p>}

        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? "Aguarde…" : cadastrando ? "Criar conta" : "Entrar"}
        </Button>
      </form>

      {!cadastrando && (
        <div className="mt-3 text-center">
          <Link href="/recuperar-senha" className="text-[12.5px] text-text-muted hover:text-text hover:underline">
            Esqueci minha senha
          </Link>
        </div>
      )}
    </MolduraAuth>
  );
}
