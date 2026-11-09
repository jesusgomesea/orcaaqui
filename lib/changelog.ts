// Lista mantida manualmente a cada entrega. Cada item precisa de um `id`
// crescente (serve pra ordenar e pra saber o que o usuário já viu — comparação
// simples de string, por isso o prefixo de data). Adicionar sempre no topo.
export type TipoNovidade = "novidade" | "melhoria" | "correcao" | "lancamento";

export interface Novidade {
  id: string;
  data: string;
  tipo: TipoNovidade;
  titulo: string;
  descricao: string;
}

export const NOVIDADES: Novidade[] = [
  {
    id: "2026-11-08-04",
    data: "2026-11-08",
    tipo: "novidade",
    titulo: "Agenda: do orçamento aprovado à entrega",
    descricao:
      "Nova tela Agenda. Quando o cliente aprovar, cole a mensagem que ele devolveu (do Montar orçamento ou do site do EJ) ou use \"Cliente aprovou → agendar\" na lista de orçamentos: o valor é recalculado pela tabela, o orçamento fica aprovado e o agendamento é criado. Acompanhe etapas (configuráveis em Empresa), pagamentos com o sinal sugerido, extras de pós-venda, valor combinado e notas. O Painel ganhou \"a receber\" e os próximos serviços.",
  },
  {
    id: "2026-11-08-03",
    data: "2026-11-08",
    tipo: "novidade",
    titulo: "Montar orçamento pelo catálogo",
    descricao:
      "Em Orçamentos, \"Montar orçamento\" monta pelo seu catálogo: escolha os serviços e as quantidades (com preço menor por volume, se configurado), a faixa de deslocamento, desconto e acréscimo, e veja total, sinal e restante na hora. O cliente pode ser só nome e WhatsApp. \"Enviar pelo WhatsApp\" salva o orçamento como enviado e abre a conversa com a mensagem pronta. Em Empresa → Orçamento e agenda, configure o percentual do sinal, a validade e as faixas de deslocamento.",
  },
  {
    id: "2026-11-08-02",
    data: "2026-11-08",
    tipo: "correcao",
    titulo: "Mais estabilidade ao carregar e salvar",
    descricao:
      "Corrigimos uma falha do armazenamento que podia deixar a tela em \"Carregando seus dados…\" ou travar a gravação, principalmente no primeiro acesso de uma conta nova e ao gerar contratos e recibos. Se algo falhar, a mensagem agora diz o motivo.",
  },
  {
    id: "2026-11-08-01",
    data: "2026-11-08",
    tipo: "novidade",
    titulo: "Contrato e recibo gerados a partir do orçamento",
    descricao:
      "Em Empresa → Contratos e recibos, ative a geração e preencha seus dados de prestador. No orçamento aprovado, o botão de contrato gera o PDF com os dados do cliente e do serviço, e cada pagamento registrado ganha o seu recibo. Tudo fica no histórico do orçamento e do cliente; gerar de novo cria uma nova versão sem apagar a anterior.",
  },
  {
    id: "2026-09-10-02",
    data: "2026-09-10",
    tipo: "correcao",
    titulo: "O número do orçamento não muda mais",
    descricao:
      "Antes, excluir um orçamento renumerava todos os seguintes — o ORC que o cliente tinha em mãos deixava de bater com o daqui. Agora o número é gravado na criação e não muda mais. Os orçamentos que já existiam mantiveram exatamente os números que você via.",
  },
  {
    id: "2026-09-10-01",
    data: "2026-09-10",
    tipo: "novidade",
    titulo: "Página inicial de apresentação",
    descricao:
      "O endereço principal do Orça Aqui agora abre uma página que apresenta o serviço, em vez de ir direto para a tela de entrada. Quem já está logado é levado ao painel, que passou a ficar em /painel.",
  },
  {
    id: "2026-09-09-01",
    data: "2026-09-09",
    tipo: "novidade",
    titulo: "Conta própria e dados na nuvem",
    descricao:
      "Agora o Orça Aqui tem login. Seus dados ficam salvos na sua conta, não mais só no navegador — dá pra acessar do computador, do celular ou de outro lugar e encontrar tudo igual. Na primeira entrada, os dados que já estavam neste navegador são enviados automaticamente pra sua conta.",
  },
  {
    id: "2026-08-16-06",
    data: "2026-08-16",
    tipo: "novidade",
    titulo: "Página de novidades",
    descricao: "Agora dá pra acompanhar por aqui o que muda no Orça Aqui a cada atualização.",
  },
  {
    id: "2026-08-16-05",
    data: "2026-08-16",
    tipo: "novidade",
    titulo: "Suporte a mais de uma empresa",
    descricao: "Cadastre e alterne entre várias empresas no mesmo navegador, cada uma com seus próprios clientes, orçamentos e serviços.",
  },
  {
    id: "2026-08-16-04",
    data: "2026-08-16",
    tipo: "novidade",
    titulo: "Gráfico de faturamento",
    descricao: "O Painel agora mostra um gráfico com orçado x aprovado nos últimos meses.",
  },
  {
    id: "2026-08-16-03",
    data: "2026-08-16",
    tipo: "novidade",
    titulo: "Importar e exportar clientes em CSV",
    descricao: "Migre sua lista de clientes de uma planilha ou exporte pra levar pra outro lugar.",
  },
  {
    id: "2026-08-16-02",
    data: "2026-08-16",
    tipo: "novidade",
    titulo: "Múltiplas moedas",
    descricao: "Escolha a moeda padrão da empresa e ajuste por orçamento quando o cliente for de fora.",
  },
  {
    id: "2026-08-16-01",
    data: "2026-08-16",
    tipo: "novidade",
    titulo: "Catálogo de serviços",
    descricao: "Cadastre seus serviços com preço padrão e selecione ao montar um orçamento, sem digitar tudo de novo.",
  },
  {
    id: "2026-08-15-02",
    data: "2026-08-15",
    tipo: "correcao",
    titulo: "Corrigido: tela em branco ao abrir o PDF gerado localmente",
    descricao: "O build agora funciona tanto hospedado quanto abrindo o arquivo direto do computador.",
  },
  {
    id: "2026-08-15-01",
    data: "2026-08-15",
    tipo: "lancamento",
    titulo: "Orça Aqui no ar",
    descricao: "Primeira versão: monte orçamentos com sua logo e cor, envie por WhatsApp ou gere PDF, tudo salvo no seu navegador.",
  },
];

export const TIPO_LABEL: Record<TipoNovidade, string> = {
  novidade: "Novidade",
  melhoria: "Melhoria",
  correcao: "Correção",
  lancamento: "Lançamento",
};

export const TIPO_TONE: Record<TipoNovidade, "gray" | "amber" | "green" | "red"> = {
  novidade: "green",
  melhoria: "amber",
  correcao: "red",
  lancamento: "gray",
};
