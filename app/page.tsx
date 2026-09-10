"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Check,
  Coins,
  FileText,
  LineChart,
  Moon,
  Printer,
  Users,
  Wrench,
} from "lucide-react";
import { useSessao } from "@/components/auth/ProvedorSessao";
import BotaoTema from "@/components/layout/BotaoTema";
import { Button } from "@/components/ui/button";

/**
 * Vitrine pública — é a tela inicial do site (rota `/`, fora do route group
 * `(app)`, portanto sem o portão do Protegido). O app autenticado começa em
 * `/painel`. Quem já tem sessão vê o CTA apontando direto pro painel, em vez
 * de ser convidado a criar conta de novo.
 */

const RECURSOS = [
  {
    icon: FileText,
    titulo: "Orçamento com a sua cara",
    texto:
      "Logo, cor e dados da sua empresa no documento. Itens, desconto em valor ou percentual, acréscimo e condições de pagamento.",
  },
  {
    icon: Printer,
    titulo: "PDF e WhatsApp",
    texto:
      "Gere o PDF pela impressão do navegador ou mande o texto pronto pro cliente no WhatsApp, sem sair da tela.",
  },
  {
    icon: Building2,
    titulo: "Mais de uma empresa",
    texto:
      "Cada empresa na mesma conta é um espaço próprio, com seus clientes, orçamentos e serviços separados.",
  },
  {
    icon: Wrench,
    titulo: "Catálogo de serviços",
    texto:
      "Cadastre o que você faz com o preço padrão e reaproveite ao montar cada orçamento, sem redigitar.",
  },
  {
    icon: Users,
    titulo: "Clientes em CSV",
    texto:
      "Importe sua lista de uma planilha e exporte quando quiser levar os dados pra outro lugar.",
  },
  {
    icon: LineChart,
    titulo: "Painel de faturamento",
    texto:
      "Acompanhe orçado x aprovado nos últimos meses e veja quais orçamentos enviados estão perto de vencer.",
  },
  {
    icon: Coins,
    titulo: "Várias moedas",
    texto:
      "Defina a moeda padrão da empresa e ajuste por orçamento quando o cliente for de fora.",
  },
  {
    icon: Moon,
    titulo: "Tema claro e escuro",
    texto:
      "A tela acompanha sua preferência, no computador ou no celular, sem piscar ao carregar.",
  },
];

const PASSOS = [
  {
    numero: "1",
    titulo: "Crie sua conta",
    texto: "E-mail e senha. Nada de cartão, nada de mensalidade.",
  },
  {
    numero: "2",
    titulo: "Configure a empresa",
    texto: "Logo, cor, dados de contato, Pix e as condições que você costuma usar.",
  },
  {
    numero: "3",
    titulo: "Monte e envie",
    texto: "Adicione os itens, gere o PDF ou mande pelo WhatsApp. Pronto.",
  },
];

const GARANTIAS = [
  "Sem mensalidade",
  "Dados na sua conta, em qualquer dispositivo",
  "Backup em JSON quando quiser",
];

export default function LandingPage() {
  const { usuario, carregando } = useSessao();
  const logado = !carregando && Boolean(usuario);

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[1100px] items-center justify-between gap-3 px-5">
          <span className="text-[17px] font-bold">
            Orça <span className="text-primary">Aqui</span>
          </span>
          <div className="flex items-center gap-2">
            <BotaoTema />
            {logado ? (
              <Link href="/painel">
                <Button size="sm">Ir para o painel</Button>
              </Link>
            ) : (
              <>
                <Link href="/entrar" className="hidden sm:block">
                  <Button variant="ghost" size="sm">
                    Entrar
                  </Button>
                </Link>
                <Link href="/entrar">
                  <Button size="sm">Criar conta</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto w-full max-w-[1100px] px-5 py-16 text-center md:py-24">
          <span className="inline-block rounded-full border border-border bg-primary-tint px-3 py-1 text-[12px] font-semibold text-primary-dark">
            Grátis, sem mensalidade
          </span>
          <h1 className="mx-auto mt-5 max-w-[720px] text-[32px] font-bold leading-[1.15] tracking-tight md:text-[46px]">
            Orçamentos profissionais em minutos, com a cara da{" "}
            <span className="text-primary">sua empresa</span>
          </h1>
          <p className="mx-auto mt-4 max-w-[560px] text-[15px] leading-relaxed text-text-muted md:text-[16.5px]">
            Monte o orçamento, gere o PDF e envie pro cliente pelo WhatsApp. Seus dados ficam
            salvos na sua conta — abra do computador, do celular ou de onde estiver e encontre
            tudo igual.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href={logado ? "/painel" : "/entrar"}>
              <Button className="h-11 px-6 text-[14.5px]">
                {logado ? "Ir para o painel" : "Começar agora"}
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </Button>
            </Link>
            {!logado && (
              <Link href="/entrar">
                <Button variant="secondary" className="h-11 px-6 text-[14.5px]">
                  Já tenho conta
                </Button>
              </Link>
            )}
          </div>

          <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {GARANTIAS.map((g) => (
              <li key={g} className="flex items-center gap-1.5 text-[12.5px] text-text-muted">
                <Check className="h-3.5 w-3.5 shrink-0 text-success" strokeWidth={2.5} />
                {g}
              </li>
            ))}
          </ul>
        </section>

        {/* Recursos */}
        <section className="border-y border-border bg-surface">
          <div className="mx-auto w-full max-w-[1100px] px-5 py-16 md:py-20">
            <h2 className="text-center text-[24px] font-bold tracking-tight md:text-[30px]">
              Tudo que o orçamento precisa
            </h2>
            <p className="mx-auto mt-3 max-w-[520px] text-center text-[14px] text-text-muted">
              Feito pra quem presta serviço e não quer perder a tarde formatando planilha.
            </p>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {RECURSOS.map(({ icon: Icon, titulo, texto }) => (
                <div
                  key={titulo}
                  className="rounded-lg border border-border bg-bg p-5 transition-shadow hover:shadow-md"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-tint text-primary-dark">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </span>
                  <h3 className="mt-3.5 text-[14.5px] font-bold">{titulo}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">{texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Como funciona */}
        <section className="mx-auto w-full max-w-[1100px] px-5 py-16 md:py-20">
          <h2 className="text-center text-[24px] font-bold tracking-tight md:text-[30px]">
            Como funciona
          </h2>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {PASSOS.map(({ numero, titulo, texto }) => (
              <div key={numero} className="rounded-lg border border-border bg-surface p-6">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[14px] font-bold text-white">
                  {numero}
                </span>
                <h3 className="mt-4 text-[15px] font-bold">{titulo}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-muted">{texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="border-t border-border bg-surface">
          <div className="mx-auto w-full max-w-[1100px] px-5 py-16 text-center md:py-20">
            <h2 className="text-[24px] font-bold tracking-tight md:text-[30px]">
              Pronto pra mandar o primeiro orçamento?
            </h2>
            <p className="mx-auto mt-3 max-w-[480px] text-[14px] text-text-muted">
              Leva menos tempo criar a conta do que formatar o cabeçalho de uma planilha.
            </p>
            <Link href={logado ? "/painel" : "/entrar"} className="mt-7 inline-block">
              <Button className="h-11 px-6 text-[14.5px]">
                {logado ? "Ir para o painel" : "Criar minha conta"}
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-[1100px] flex-wrap items-center justify-between gap-3 px-5 py-6 text-[12.5px] text-text-muted">
          <span>
            Orça <span className="font-semibold text-text">Aqui</span> — gerador de orçamentos
          </span>
          <Link href="/entrar" className="font-semibold text-primary hover:underline">
            Entrar na conta
          </Link>
        </div>
      </footer>
    </div>
  );
}
