// Formato do estado e o caminho por onde passa tudo que entra (servidor,
// backup importado, localStorage antigo): `normalizar()`. Puro, sem React,
// para ser testado (lib/estado.test.ts) e usado pelo store.
//
// Regra: campo novo no formato entra opcional OU com default aqui. Conta e
// backup antigos têm de abrir iguais — é o que os testes deste módulo cobrem.

import { NOVIDADES } from "./changelog";
import { uuid } from "./helpers";
import { normalizarParceria } from "./parceria";
import {
  ETAPA_CANCELADO,
  type Agendamento,
  type ConfigEmpresa,
  type Empresa,
  type EtapaAgenda,
  type EstadoApp,
  type EstadoImportado,
  type FaixaDeslocamento,
  type Saida,
  type Servico,
} from "./tipos";

/** Sem 0/O/1/I/L, para o código não ser lido errado numa mensagem. */
const ALFABETO_CODIGO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/**
 * Código curto derivado de um id (hash FNV-1a). Determinístico de propósito:
 * conta antiga sem código ganha sempre o MESMO código ao abrir, mesmo antes
 * de a normalização ser gravada — senão a `[ref]` de uma mensagem já enviada
 * deixaria de bater depois de recarregar a página.
 */
export function codigoDeId(id: string, tamanho: number, sal = 0): string {
  let h = (0x811c9dc5 ^ sal) >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let s = "";
  for (let i = 0; i < tamanho; i++) {
    s += ALFABETO_CODIGO[h % ALFABETO_CODIGO.length];
    h = Math.floor(h / ALFABETO_CODIGO.length) ^ Math.imul(h, 0x9e3779b1) >>> 0;
    h >>>= 0;
  }
  return s;
}

const CODIGO_VALIDO = /^[2-9A-HJKMNP-Z]{3,8}$/;

export const SINAL_PADRAO = 40;

export const ETAPAS_PADRAO: EtapaAgenda[] = [
  { id: "recebido", nome: "Recebido", descricao: "Orçamento aprovado, falta confirmar a data" },
  { id: "confirmado", nome: "Confirmado", descricao: "Data combinada com o cliente" },
  { id: "sinal_pago", nome: "Sinal pago", descricao: "Data reservada" },
  { id: "realizado", nome: "Realizado", descricao: "Serviço feito, em finalização" },
  { id: "entregue", nome: "Entregue", descricao: "Entrega concluída" },
];

export function configPadrao(empresaId: string): ConfigEmpresa {
  return {
    sinalPercentual: SINAL_PADRAO,
    validadeDias: 15,
    deslocamentos: [],
    etapasAgenda: ETAPAS_PADRAO.map((e) => ({ ...e })),
    versaoCatalogo: 1,
    codigo: codigoDeId(empresaId, 5),
  };
}

export function defaultEmpresa(id: string = uuid()): Empresa {
  return {
    id,
    nome: "",
    documento: "",
    telefone: "",
    email: "",
    site: "",
    endereco: "",
    logoDataUrl: "",
    corPrimaria: "#2563eb",
    moeda: "BRL",
    dadosBancarios: "",
    condicoesPadrao: "Sinal de 40% na confirmação, restante na entrega.",
    clientes: [],
    orcamentos: [],
    servicos: [],
    config: configPadrao(id),
    agendamentos: [],
    saidas: [],
    proximoNumero: 1,
  };
}

export function defaultState(): EstadoApp {
  const empresa = defaultEmpresa();
  return {
    empresaAtivaId: empresa.id,
    empresas: [empresa],
    novidadesVistoId: NOVIDADES[0]?.id || null,
  };
}

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const numeroOu = (v: unknown, padrao: number) => (typeof v === "number" && Number.isFinite(v) ? v : padrao);
const textoOu = (v: unknown, padrao = "") => (typeof v === "string" ? v : padrao);

function normalizarConfig(bruto: unknown, empresaId: string): ConfigEmpresa {
  const padrao = configPadrao(empresaId);
  if (!ehObjeto(bruto)) return padrao;

  const sinal = numeroOu(bruto.sinalPercentual, SINAL_PADRAO);
  const validade = Math.round(numeroOu(bruto.validadeDias, padrao.validadeDias));

  const idsDesl = new Set<string>();
  const deslocamentos: FaixaDeslocamento[] = (Array.isArray(bruto.deslocamentos) ? bruto.deslocamentos : [])
    .filter(ehObjeto)
    .map((d) => ({ id: textoOu(d.id).trim(), nome: textoOu(d.nome), valor: Math.max(0, numeroOu(d.valor, 0)) }))
    .filter((d) => d.id && !idsDesl.has(d.id) && idsDesl.add(d.id));

  const idsEtapa = new Set<string>();
  const etapas: EtapaAgenda[] = (Array.isArray(bruto.etapasAgenda) ? bruto.etapasAgenda : [])
    .filter(ehObjeto)
    .map((e) => ({ id: textoOu(e.id).trim(), nome: textoOu(e.nome).trim(), descricao: textoOu(e.descricao) || undefined }))
    .filter((e) => e.id && e.nome && e.id !== ETAPA_CANCELADO && !idsEtapa.has(e.id) && idsEtapa.add(e.id));

  const url = textoOu(bruto.urlTabelaEj).trim();
  const codigo = textoOu(bruto.codigo);

  return {
    sinalPercentual: Math.min(100, Math.max(0, sinal)),
    validadeDias: validade >= 1 ? validade : padrao.validadeDias,
    deslocamentos,
    etapasAgenda: etapas.length ? etapas : padrao.etapasAgenda,
    ...(url ? { urlTabelaEj: url } : {}),
    versaoCatalogo: Math.max(1, Math.round(numeroOu(bruto.versaoCatalogo, 1))),
    codigo: CODIGO_VALIDO.test(codigo) ? codigo : padrao.codigo,
  };
}

/** Código de serviço que ainda não existe na empresa, derivado do id do serviço. */
export function codigoServicoLivre(servicoId: string, usados: Set<string>): string {
  for (let sal = 0; ; sal++) {
    const c = codigoDeId(servicoId, 3 + Math.floor(sal / 20), sal);
    if (!usados.has(c)) return c;
  }
}

/** Campos que mudam o preço calculado de um serviço (e por isso a versão do catálogo). */
export function mudouPreco(antes: Servico, depois: Servico): boolean {
  return (
    antes.valor !== depois.valor ||
    antes.precoVolume !== depois.precoVolume ||
    antes.volumeMin !== depois.volumeMin
  );
}

export function subirVersaoCatalogo(config: ConfigEmpresa): ConfigEmpresa {
  return { ...config, versaoCatalogo: config.versaoCatalogo + 1 };
}

/** Todo serviço ganha um `codigo` único na empresa; os que já tinham ficam com o seu. */
function normalizarServicos(brutos: Servico[]): Servico[] {
  const usados = new Set<string>();
  // Tipo desconhecido (backup estranho) vira serviço, que é o ausente.
  const servicos = brutos.map((s) => {
    if (s.tipo === undefined || s.tipo === "produto") return s;
    const { tipo: _tipo, ...resto } = s;
    return resto;
  });
  const ok = servicos.map((s) => {
    const c = textoOu(s.codigo);
    if (CODIGO_VALIDO.test(c) && !usados.has(c)) {
      usados.add(c);
      return s;
    }
    return { ...s, codigo: "" };
  });
  return ok.map((s) => {
    if (s.codigo) return s;
    const codigo = codigoServicoLivre(s.id, usados);
    usados.add(codigo);
    return { ...s, codigo };
  });
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Saídas de backup ou servidor: descarta o que não tem data válida; valor nunca negativo. */
export function normalizarSaidas(brutos: unknown): Saida[] {
  if (!Array.isArray(brutos)) return [];
  const ids = new Set<string>();
  return brutos.filter(ehObjeto).flatMap((b) => {
    const id = textoOu(b.id).trim() || uuid();
    const data = textoOu(b.data).trim();
    if (!DATA_ISO.test(data) || ids.has(id)) return [];
    ids.add(id);
    const s: Saida = {
      id,
      data,
      descricao: textoOu(b.descricao),
      categoria: textoOu(b.categoria),
      valor: Math.max(0, numeroOu(b.valor, 0)),
    };
    const forma = textoOu(b.forma).trim();
    const orcamentoId = textoOu(b.orcamentoId).trim();
    const observacoes = textoOu(b.observacoes);
    if (forma) s.forma = forma;
    if (orcamentoId) s.orcamentoId = orcamentoId;
    if (observacoes) s.observacoes = observacoes;
    return [s];
  });
}

function normalizarAgendamentos(brutos: unknown): Agendamento[] {
  if (!Array.isArray(brutos)) return [];
  return brutos
    .filter(ehObjeto)
    .filter((a) => typeof a.id === "string" && typeof a.orcamentoId === "string")
    .map((a) => {
      const criadoEm = textoOu(a.criadoEm, new Date().toISOString());
      const etapa = textoOu(a.etapa, ETAPAS_PADRAO[0].id) || ETAPAS_PADRAO[0].id;
      const historico = (Array.isArray(a.historico) ? a.historico : [])
        .filter(ehObjeto)
        .map((h) => ({ etapa: textoOu(h.etapa), em: textoOu(h.em) }))
        .filter((h) => h.etapa && h.em);
      return {
        id: a.id as string,
        criadoEm,
        atualizadoEm: textoOu(a.atualizadoEm, criadoEm),
        orcamentoId: a.orcamentoId as string,
        clienteId: textoOu(a.clienteId),
        moeda: (textoOu(a.moeda) || "BRL") as Agendamento["moeda"],
        etapa,
        historico: historico.length ? historico : [{ etapa, em: criadoEm }],
        extras: (Array.isArray(a.extras) ? a.extras : [])
          .filter(ehObjeto)
          .map((x) => ({ id: textoOu(x.id) || uuid(), descricao: textoOu(x.descricao), valor: numeroOu(x.valor, 0) })),
        notas: textoOu(a.notas),
        valorCombinado: typeof a.valorCombinado === "number" && Number.isFinite(a.valorCombinado) ? a.valorCombinado : null,
        sinalPercentual: Math.min(100, Math.max(0, numeroOu(a.sinalPercentual, SINAL_PADRAO))),
      };
    });
}

/**
 * Dados gravados antes de `Orcamento.numero` existir não têm número nenhum: o
 * ORC-XXXX saía da posição no array na hora de exibir. A numeração pela ordem
 * atual preserva exatamente o que essas pessoas já viam, e `proximoNumero`
 * continua dali — sem isso, todo mundo veria os números mudarem de uma vez.
 */
function numerarOrcamentosLegados(empresa: Empresa): Empresa {
  const semNumero = empresa.orcamentos.some((o) => typeof o.numero !== "number");
  if (!semNumero && typeof empresa.proximoNumero === "number") return empresa;

  let proximo = 0;
  const orcamentos = empresa.orcamentos.map((o, i) => {
    const numero = typeof o.numero === "number" ? o.numero : i + 1;
    if (numero > proximo) proximo = numero;
    return { ...o, numero };
  });
  return { ...empresa, orcamentos, proximoNumero: Math.max(empresa.proximoNumero || 0, proximo + 1) };
}

export function mergeEmpresa(parcial: Partial<Empresa>): Empresa {
  const id = parcial.id || uuid();
  const base = { ...defaultEmpresa(id), ...parcial, id };
  return numerarOrcamentosLegados({
    ...base,
    clientes: Array.isArray(base.clientes) ? base.clientes : [],
    orcamentos: (Array.isArray(base.orcamentos) ? base.orcamentos : []).map((o) => {
      if (!("parceria" in o)) return o;
      // Parceria inválida vira orçamento comum (sem a chave), nunca quebra a tela.
      const { parceria, ...resto } = o;
      const limpa = normalizarParceria(parceria);
      return limpa ? { ...resto, parceria: limpa } : resto;
    }),
    servicos: normalizarServicos(Array.isArray(base.servicos) ? base.servicos : []),
    config: normalizarConfig(parcial.config, id),
    agendamentos: normalizarAgendamentos(parcial.agendamentos),
    saidas: normalizarSaidas(parcial.saidas),
  });
}

// Dados salvos antes do suporte a múltiplas empresas eram um único objeto
// `{ empresa, clientes, orcamentos }` no topo do state. Migra pra dentro de
// `empresas: [...]` pra não perder nada de quem já usava — vale tanto pro que
// vem do localStorage antigo quanto pro backup JSON importado.
function migrarSeNecessario(raw: EstadoImportado): Partial<EstadoApp> | null {
  if (raw.empresas) return raw as Partial<EstadoApp>;
  if (!raw.empresa) return null;
  const empresa = mergeEmpresa({
    ...raw.empresa,
    clientes: raw.clientes || [],
    orcamentos: raw.orcamentos || [],
    servicos: raw.servicos || [],
  });
  return { empresaAtivaId: empresa.id, empresas: [empresa] };
}

/** Normaliza qualquer entrada (servidor, backup, localStorage) num EstadoApp. */
export function normalizar(bruto: EstadoImportado | null | undefined): EstadoApp | null {
  if (!ehObjeto(bruto)) return null;
  const migrado = migrarSeNecessario(bruto);
  if (!migrado?.empresas?.length) return null;
  const empresas = migrado.empresas.map(mergeEmpresa);
  const empresaAtivaId = empresas.some((e) => e.id === migrado.empresaAtivaId)
    ? (migrado.empresaAtivaId as string)
    : empresas[0].id;
  return { empresaAtivaId, empresas, novidadesVistoId: migrado.novidadesVistoId ?? null };
}
