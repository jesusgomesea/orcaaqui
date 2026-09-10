"use client";

import { useState, type FormEvent } from "react";
import { updateUser } from "@netlify/identity";
import { useSessao } from "@/components/auth/ProvedorSessao";
import MolduraAuth from "@/components/auth/MolduraAuth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

/**
 * Segundo tempo da recuperação: o usuário chega aqui pelo link do e-mail, já
 * autenticado pelo handleAuthCallback, mas ainda com a senha antiga.
 */
export default function NovaSenhaPage() {
  const { usuario, carregando } = useSessao();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErro("");
    if (senha.length < 8) { setErro("A senha precisa ter ao menos 8 caracteres."); return; }
    if (senha !== confirmacao) { setErro("As senhas não conferem."); return; }

    setEnviando(true);
    try {
      await updateUser({ password: senha });
      // Navegação completa: o cookie de sessão precisa chegar ao servidor.
      window.location.href = "/painel";
    } catch (erroDaApi: unknown) {
      setErro(erroDaApi instanceof Error ? erroDaApi.message : "Não foi possível salvar a nova senha.");
      setEnviando(false);
    }
  };

  if (!carregando && !usuario) {
    return (
      <MolduraAuth titulo="Link expirado" descricao="Peça um novo link de recuperação para continuar.">
        <a href="/recuperar-senha" className="text-[13px] font-semibold text-primary hover:underline">
          Pedir novo link
        </a>
      </MolduraAuth>
    );
  }

  return (
    <MolduraAuth titulo="Criar nova senha" descricao="Escolha uma senha nova para a sua conta.">
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <Label>Nova senha</Label>
          <Input type="password" required autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} autoFocus />
        </div>
        <div className="mb-3">
          <Label>Repita a nova senha</Label>
          <Input type="password" required autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
        </div>
        {erro && <p className="mb-3 text-[12.5px] font-medium text-danger">{erro}</p>}
        <Button type="submit" className="w-full" disabled={enviando}>
          {enviando ? "Salvando…" : "Salvar senha"}
        </Button>
      </form>
    </MolduraAuth>
  );
}
