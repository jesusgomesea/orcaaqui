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

export type TipoPagamento = "sinal" | "restante" | "integral";

export interface Pagamento {
  id: string;
  tipo: TipoPagamento;
  valor: number;
  /** YYYY-MM-DD */
  data: string;
  forma: string;
}

export interface Orcamento {
  id: string;
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
}

export interface Servico {
  id: string;
  categoria: string;
  nome: string;
  descricao: string;
  valor: number;
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
