"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { requestPasswordRecovery } from "@netlify/identity";
import MolduraAuth from "@/components/auth/MolduraAuth";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await requestPasswordRecovery(email);
    } catch {
      // Ignorado de propósito: responder diferente para e-mail cadastrado e
      // não cadastrado transformaria este formulário num oráculo que revela
      // quem tem conta aqui.
    } finally {
      setEnviado(true);
      setEnviando(false);
    }
  };

  return (
    <MolduraAuth
      titulo="Recuperar senha"
      descricao={enviado ? undefined : "Enviamos um link para você criar uma senha nova."}
      rodape={<Link href="/entrar" className="font-semibold text-primary hover:underline">Voltar para entrar</Link>}
    >
      {enviado ? (
        <p className="text-[13px] text-text-muted">
          Se existir uma conta com <span className="font-semibold text-text">{email}</span>, o link de recuperação
          chegou por e-mail. Verifique também a caixa de spam.
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <Label>E-mail</Label>
            <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </div>
          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando ? "Enviando…" : "Enviar link"}
          </Button>
        </form>
      )}
    </MolduraAuth>
  );
}
