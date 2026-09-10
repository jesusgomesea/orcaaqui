import type { Metadata } from "next";
import Link from "next/link";
import {
  LayoutDashboard, FileText, Palette, Users, Wrench, Send,
  Coins, Building2, Cloud, type LucideIcon,
} from "lucide-react";
import CabecalhoSite from "@/components/site/CabecalhoSite";
import PreviaOrcamento from "@/components/site/PreviaOrcamento";
import BotaoInstalar from "@/components/pwa/BotaoInstalar";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Orça Aqui — orçamentos profissionais em minutos",
  description:
    "Monte orçamentos com a cara da sua empresa, envie por WhatsApp ou PDF e acompanhe o que foi aprovado. Seus dados ficam na sua conta, acessíveis de qualquer dispositivo.",
};

const FUNCIONALIDADES: { icone: LucideIcon; titulo: string; texto: string }[] = [
  {
    icone: FileText,
    titulo: "Orçamentos completos",
    texto:
      "Itens com quantidade e valor, desconto em reais ou porcentagem, acréscimo, prazo de validade e condições de pagamento. O total se atualiza enquanto você digita.",
  },
  {
    icone: Palette,
    titulo: "Com a sua marca",
    texto:
      "Sua logo, sua cor de destaque e seus dados no cabeçalho do documento. O cliente recebe um orçamento com a cara da sua empresa, não com a cara de um sistema.",
  },
  {
    icone: LayoutDashboard,
    titulo: "Painel de acompanhamento",
    texto:
      "Quanto você orçou no mês, taxa de aprovação, gráfico de orçado x aprovado nos últimos seis meses e a lista do que está perto de vencer sem resposta.",
  },
  {
    icone: Send,
    titulo: "Envio por WhatsApp ou PDF",
    texto:
      "Um clique gera o PDF pronto para anexar, outro abre o WhatsApp do cliente com o resumo já escrito. Sem copiar e colar, sem montar mensagem na mão.",
  },
  {
    icone: Wrench,
    titulo: "Catálogo de serviços",
    texto:
      "Cadastre o que você vende com o preço padrão. Na hora de montar o orçamento, escolha da lista e o item já vem preenchido com descrição e valor.",
  },
  {
    icone: Users,
    titulo: "Seus clientes organizados",
    texto:
      "Cadastro com contato, documento e observações, reaproveitado a cada novo orçamento. Importe sua lista de uma planilha em CSV e exporte quando quiser.",
  },
  {
    icone: Building2,
    titulo: "Mais de uma empresa",
    texto:
      "Toca mais de um negócio? Cada empresa tem clientes, orçamentos e serviços próprios, e você alterna entre elas sem sair da conta.",
  },
  {
    icone: Coins,
    titulo: "Várias moedas",
    texto:
      "Defina a moeda padrão da empresa e troque por orçamento quando o cliente for de fora. Real, dólar, euro, libra e mais.",
  },
  {
    icone: Cloud,
    titulo: "Seus dados na sua conta",
    texto:
      "Tudo salva sozinho enquanto você trabalha. Entre do computador, do celular ou de outro lugar e encontre exatamente o que deixou.",
  },
];

const PASSOS = [
  { numero: "1", titulo: "Crie sua conta", texto: "E-mail e senha, de graça. Nenhum cartão, nenhuma instalação." },
  { numero: "2", titulo: "Configure sua empresa", texto: "Logo, cor, contato e dados de pagamento. Leva um minuto e vale para todos os orçamentos." },
  { numero: "3", titulo: "Envie o primeiro orçamento", texto: "Escolha o cliente, some os itens e mande por WhatsApp ou PDF." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <CabecalhoSite />

      <main>
        <section className="border-b border-border bg-gradient-to-b from-primary-tint to-bg">
          <div className="mx-auto grid w-full max-w-[1080px] items-center gap-10 px-5 py-14 md:grid-cols-2 md:py-20">
            <div>
              <h1 className="text-[32px] font-extrabold leading-[1.15] tracking-tight text-text md:text-[40px]">
                Orçamentos profissionais em minutos, com a sua marca
              </h1>
              <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-text-muted">
                Monte o orçamento, envie por WhatsApp ou PDF e acompanhe o que foi aprovado — sem planilha,
                sem mensalidade e sem perder a proposta que você fez semana passada.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href="/criar-conta"
                  className="inline-flex h-11 items-center rounded-md border border-primary bg-gradient-to-b from-primary-light to-primary px-6 text-[14.5px] font-semibold text-white shadow-sm transition-all hover:from-primary hover:to-primary-dark hover:shadow-md active:translate-y-px"
                >
                  Criar conta grátis
                </Link>
                <Link
                  href="/entrar"
                  className="inline-flex h-11 items-center rounded-md border border-border-strong bg-surface px-6 text-[14.5px] font-semibold text-text transition-colors hover:bg-bg"
                >
                  Já tenho conta
                </Link>
              </div>
              <p className="mt-4 text-[12.5px] text-text-muted">
                Grátis · sem cartão de crédito · seus dados acessíveis de qualquer dispositivo
              </p>
            </div>

            <div className="md:pl-4">
              <PreviaOrcamento />
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1080px] px-5 py-14 md:py-20">
          <h2 className="text-[24px] font-bold tracking-tight text-text md:text-[28px]">
            Tudo que o orçamento precisa, num lugar só
          </h2>
          <p className="mt-2.5 max-w-[60ch] text-[14px] text-text-muted">
            Feito para quem presta serviço e perde tempo remontando a mesma proposta toda semana.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FUNCIONALIDADES.map(({ icone: Icone, titulo, texto }) => (
              <Card key={titulo}>
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary-tint text-primary">
                  <Icone className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </div>
                <h3 className="mb-1.5 text-[14.5px] font-bold text-text">{titulo}</h3>
                <p className="text-[13px] leading-relaxed text-text-muted">{texto}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto w-full max-w-[1080px] px-5 py-14 md:py-16">
            <h2 className="text-[24px] font-bold tracking-tight text-text md:text-[28px]">Como começar</h2>
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {PASSOS.map(({ numero, titulo, texto }) => (
                <div key={numero}>
                  <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[14px] font-bold text-white">
                    {numero}
                  </div>
                  <h3 className="mb-1.5 text-[14.5px] font-bold text-text">{titulo}</h3>
                  <p className="text-[13px] leading-relaxed text-text-muted">{texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1080px] px-5 py-16 text-center md:py-20">
          <h2 className="text-[24px] font-bold tracking-tight text-text md:text-[28px]">
            Pronto para mandar o próximo orçamento?
          </h2>
          <p className="mx-auto mt-2.5 max-w-[50ch] text-[14px] text-text-muted">
            Crie sua conta e monte o primeiro em poucos minutos.
          </p>
          <Link
            href="/criar-conta"
            className="mt-7 inline-flex h-11 items-center rounded-md border border-primary bg-gradient-to-b from-primary-light to-primary px-7 text-[14.5px] font-semibold text-white shadow-sm transition-all hover:from-primary hover:to-primary-dark hover:shadow-md active:translate-y-px"
          >
            Criar conta grátis
          </Link>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-[1080px] flex-wrap items-center justify-between gap-3 px-5 py-6 text-[12.5px] text-text-muted">
          <span>
            Orça <span className="font-semibold text-text">Aqui</span>
          </span>
          <div className="flex items-center gap-4">
            <BotaoInstalar className="px-0 py-0 text-[12.5px] hover:bg-transparent hover:underline" />
            <Link href="/entrar" className="hover:text-text hover:underline">Entrar na minha conta</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
