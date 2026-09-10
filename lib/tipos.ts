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

export interface ItemOrcamento {
  id: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
}

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
}

export interface Servico {
  id: string;
  categoria: string;
  nome: string;
  descricao: string;
  valor: number;
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
  /** Contador monotônico de `Orcamento.numero`. Nunca reaproveita número de excluído. */
  proximoNumero: number;
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
