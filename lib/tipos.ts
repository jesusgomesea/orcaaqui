export type CodigoMoeda = "BRL" | "USD" | "EUR" | "GBP" | "ARS" | "MXN" | "CLP" | "PYG";

export type StatusOrcamento = "rascunho" | "enviado" | "aprovado" | "recusado";
/** `expirado` nunca é gravado — sai de `statusEfetivo()`, calculado na hora. */
export type StatusEfetivo = StatusOrcamento | "expirado";

export type DescontoTipo = "valor" | "percentual";

export interface Cliente {
  id: string;
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  endereco: string;
  observacoes: string;
}

/** `adicional` entra na lista de adicionais do contrato (com valor); ausente = item principal. */
export type TipoItem = "principal" | "adicional";

export interface ItemOrcamento {
  id: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  tipo?: TipoItem;
  /** Serviço do catálogo de onde o item veio; é o que permite a `[ref]` recalcular. */
  servicoId?: string;
  /** Item de deslocamento: id da faixa em `config.deslocamentos`. */
  deslocamentoId?: string;
}

/**
 * Dados do serviço que alimentam o contrato. Opcional: orçamentos antigos não
 * têm e continuam abrindo — só a geração do contrato fica bloqueada.
 */
export interface ServicoContrato {
  servico: string;
  pacote: string;
  /** YYYY-MM-DD */
  dataServico: string;
  /** HH:MM */
  horarioInicio: string;
  /** HH:MM; vazio = sem fim definido ("—" no contrato) */
  horarioFim: string;
  local: string;
  tempoCampo: string;
  fotosEditadas: string;
  personalizado: boolean;
  personalizadoHoras: number;
  personalizadoFotos: number;
  prazoEntrega: string;
}

/** `outro`: pós-venda (remarcação, reedição…). Não gera recibo — o modelo só tem texto para os três primeiros. */
export type TipoPagamento = "sinal" | "restante" | "integral" | "outro";

export interface Pagamento {
  id: string;
  tipo: TipoPagamento;
  valor: number;
  /** YYYY-MM-DD */
  data: string;
  forma: string;
  /** Texto livre, usado sobretudo em `outro`. */
  descricao?: string;
}

/** De onde o orçamento veio. Ausente = manual (orçamentos anteriores à agenda). */
export type OrigemOrcamento = "manual" | "gerador" | "colado-ej" | "colado-orc";

export interface Orcamento {
  id: string;
  /**
   * Número sequencial por empresa, gravado na criação e imutável depois. Já foi
   * derivado da posição no array, o que renumerava todos os posteriores a cada
   * exclusão — o cliente ficava com um PDF cujo número não existia mais aqui.
   */
  numero: number;
  criadoEm: string;
  clienteId: string;
  data: string;
  validadeDias: number;
  moeda: CodigoMoeda;
  itens: ItemOrcamento[];
  desconto: number;
  descontoTipo: DescontoTipo;
  acrescimo: number;
  condicoes: string;
  observacoes: string;
  status: StatusOrcamento;
  servicoContrato?: ServicoContrato;
  pagamentos?: Pagamento[];
  /**
   * Código que vai na linha `[ref …]` da mensagem: `ORC-0012` (gerado aqui) ou
   * `EJ-XXXXX` (colado do site do EJ Fotografia).
   */
  codigoRef?: string;
  /** Linha `[ref EJ-…]` inteira do orçamento feito pela tabela do EJ: reabre no montador com a mesma escolha. */
  refEj?: string;
  /** % do sinal combinado neste orçamento; ausente = o da empresa (`config.sinalPercentual`). */
  sinalPercentual?: number;
  origem?: OrigemOrcamento;
  /**
   * Presente = é uma PARCERIA: além do que você entrega (os itens), o parceiro
   * "paga" com contrapartidas (divulgação, permuta, indicação…). A parte em
   * dinheiro, se houver, é o total do orçamento (itens − desconto de parceria).
   */
  parceria?: Parceria;
}

export type TipoContrapartida = "divulgacao" | "permuta" | "indicacao" | "outra";

/** Cada vez que o parceiro cumpre um pedaço (um post, uma indicação…). */
export interface RegistroContrapartida {
  id: string;
  /** YYYY-MM-DD */
  data: string;
  /** Link do post, nome de quem foi indicado… */
  detalhe: string;
}

export interface Contrapartida {
  id: string;
  tipo: TipoContrapartida;
  /** "Post no feed marcando @eluan.jesus", "Maquiagem da noiva"… */
  descricao: string;
  /** Quantas vezes (posts, stories, indicações…). Cumprida quando os registros chegam aqui. */
  quantidade: number;
  /** Até quando, YYYY-MM-DD; vazio = sem prazo. */
  prazo: string;
  /** Permuta: quanto vale o que o parceiro dá (moeda do orçamento). */
  valorEstimado: number;
  registros: RegistroContrapartida[];
}

export interface Parceria {
  contrapartidas: Contrapartida[];
}

export type UnidadeServico = "un" | "hora" | "foto" | "dia" | "km";

/**
 * Serviço (o que você faz) ou produto (o que você entrega: álbum, pendrive,
 * quadro). Sem estoque por enquanto — o tipo separa os dois no catálogo e já
 * prepara um controle de estoque futuro. Ausente = serviço.
 */
export type TipoCatalogo = "servico" | "produto";

export interface Servico {
  id: string;
  categoria: string;
  nome: string;
  descricao: string;
  /** Preço por unidade. */
  valor: number;
  /** Código curto, único na empresa, que identifica o serviço na `[ref]` (o uuid deixaria a linha enorme). */
  codigo?: string;
  unidade?: UnidadeServico;
  /**
   * Desconto por volume: a partir de `volumeMin` unidades, TODAS as unidades
   * passam a custar `precoVolume`.
   */
  precoVolume?: number;
  volumeMin?: number;
  /** Prazo de entrega em texto ("Em até 7 dias"). */
  prazo?: string;
  /** false = some do gerador, mas continua lendo orçamentos antigos. Ausente = ativo. */
  ativo?: boolean;
  /** Ausente = serviço. */
  tipo?: TipoCatalogo;
}

/** Faixa de deslocamento cobrada à parte (id curto vai na `[ref]` como `ds=`). */
export interface FaixaDeslocamento {
  id: string;
  nome: string;
  valor: number;
}

/** Etapa da agenda. "cancelado" é reservado e fica fora desta lista. */
export interface EtapaAgenda {
  id: string;
  nome: string;
  descricao?: string;
}

export interface ConfigEmpresa {
  /** % do sinal, arredondado para cima em reais inteiros. Padrão 40. */
  sinalPercentual: number;
  /** Validade padrão de orçamentos novos, em dias. */
  validadeDias: number;
  deslocamentos: FaixaDeslocamento[];
  /** Em ordem; a última é a de "concluído" (aba Entregues). */
  etapasAgenda: EtapaAgenda[];
  /** Endereço do site do EJ Fotografia, para recalcular `[ref EJ-…]`. Vazio = sem integração. */
  urlTabelaEj?: string;
  /** Sobe quando um preço do catálogo muda; vai na `[ref]` como `v<n>` para avisar tabela antiga. */
  versaoCatalogo: number;
  /** Código curto da empresa, que vai na `[ref]` como `e=`. */
  codigo: string;
}

export const ETAPA_CANCELADO = "cancelado";

/** Cobrança de pós-venda (remarcação, reedição…), somada ao total do agendamento. */
export interface ExtraAgendamento {
  id: string;
  descricao: string;
  valor: number;
}

/**
 * Agendamento de um orçamento aprovado. Os pagamentos ficam no próprio
 * orçamento (`Orcamento.pagamentos`), e data, horário e local em
 * `Orcamento.servicoContrato` — aqui só o que é da agenda.
 */
export interface Agendamento {
  id: string;
  /** ISO 8601 */
  criadoEm: string;
  atualizadoEm: string;
  orcamentoId: string;
  clienteId: string;
  moeda: CodigoMoeda;
  /** Id de uma `config.etapasAgenda` ou `ETAPA_CANCELADO`. */
  etapa: string;
  historico: { etapa: string; em: string }[];
  extras: ExtraAgendamento[];
  /** Anotações do prestador, que o cliente nunca vê. */
  notas: string;
  /** Valor fechado na conversa; null = vale o total do orçamento. */
  valorCombinado: number | null;
  /** % do sinal gravado na criação: mudar a configuração depois não muda o combinado. */
  sinalPercentual: number;
}

/**
 * Dados civis do prestador para contratos e recibos (podem diferir do nome
 * fantasia da empresa). `habilitado` liga a geração de documentos na empresa.
 */
export interface Prestador {
  habilitado: boolean;
  nome: string;
  cpf: string;
  endereco: string;
  whatsapp: string;
  email: string;
  pix: string;
  modeloVersao: string;
}

/**
 * Saída de dinheiro da empresa (compra de equipamento, deslocamento,
 * assinatura…), na moeda da empresa. `orcamentoId` liga a saída a um trabalho
 * — é o que permite ver o resultado de cada um. As entradas não têm registro
 * próprio: são os pagamentos de `Orcamento.pagamentos`.
 */
export interface Saida {
  id: string;
  /** YYYY-MM-DD */
  data: string;
  descricao: string;
  categoria: string;
  valor: number;
  /** Pix, cartão, dinheiro… */
  forma?: string;
  orcamentoId?: string;
  observacoes?: string;
}

export interface Empresa {
  id: string;
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  site: string;
  endereco: string;
  logoDataUrl: string;
  corPrimaria: string;
  moeda: CodigoMoeda;
  dadosBancarios: string;
  condicoesPadrao: string;
  clientes: Cliente[];
  orcamentos: Orcamento[];
  servicos: Servico[];
  prestador?: Prestador;
  config: ConfigEmpresa;
  agendamentos: Agendamento[];
  saidas: Saida[];
  /** Contador monotônico de `Orcamento.numero`. Nunca reaproveita número de excluído. */
  proximoNumero: number;
}

export type TipoDocumento = "contrato" | "recibo";

/**
 * Registro de um documento gerado. Mora no Netlify Blobs, fora do estado
 * principal (ver lib/server/documentos.ts) — nunca é sobrescrito.
 */
export interface DocumentoGerado {
  id: string;
  tipo: TipoDocumento;
  /** NNN/AAAA */
  numero: string;
  /** Versão dentro do orçamento (contrato) ou do pagamento (recibo). */
  versao: number;
  modeloVersao: string;
  /** ISO 8601 */
  geradoEm: string;
  /** YYYY-MM-DD, no fuso de Teresina */
  dataGeracao: string;
  empresaId: string;
  orcamentoId: string;
  clienteId: string;
  pagamentoId?: string;
  formato: "pdf" | "docx";
  nomeArquivo: string;
}

export interface EstadoApp {
  empresaAtivaId: string;
  empresas: Empresa[];
  novidadesVistoId: string | null;
}

/**
 * Formato aceito na importação de backup: pode ser um estado v2 (multiempresa)
 * ou um v1 antigo, de empresa única. Ver `migrarSeNecessario()` em store.tsx.
 */
export interface EstadoV1Legado {
  empresa?: Partial<Empresa>;
  clientes?: Cliente[];
  orcamentos?: Orcamento[];
  servicos?: Servico[];
}

export type EstadoImportado = Partial<EstadoApp> & EstadoV1Legado;
