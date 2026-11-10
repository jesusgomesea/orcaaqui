import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { lerEstado } from "@/lib/server/dados";
import { converterParaPdf } from "@/lib/server/pdf";
import { gravarArquivo, listarDocumentos, registrarDocumento, reservarNumero } from "@/lib/server/documentos";
import { montarCamposContrato, montarCamposRecibo, type Resultado } from "@/lib/documentos/campos";
import { ErroMarcadores, preencherModelo } from "@/lib/documentos/preencher";
import { formatarNumeroDocumento, hojeNoFuso, nomeArquivoDocumento } from "@/lib/documentos/formatos";
import { uuid } from "@/lib/helpers";
import { percentualSinal } from "@/lib/agenda";
import { aplicarServicoDosItens, servicoContratoDosItens } from "@/lib/gerador";
import { servicoContratoVazio } from "@/lib/orcamento";
import type { DocumentoGerado, Empresa, Orcamento, TipoDocumento } from "@/lib/tipos";

/**
 * Modelos .docx da pasta templates/ (incluída no pacote da função pelo
 * `outputFileTracingIncludes` do next.config.ts). Trocar o contrato = trocar o
 * arquivo e atualizar a "versão do modelo" em Empresa → Contratos e recibos.
 */
const MODELOS: Record<TipoDocumento, string> = {
  contrato: "contrato-prestacao-servicos.docx",
  recibo: "recibo-pagamento.docx",
};

async function lerModelo(tipo: TipoDocumento): Promise<Uint8Array> {
  return new Uint8Array(await readFile(join(process.cwd(), "templates", MODELOS[tipo])));
}

/** Erro com status HTTP e, quando for o caso, a lista do que falta. */
export class ErroGeracao extends Error {
  status: number;
  faltando: string[];
  constructor(mensagem: string, status: number, faltando: string[] = []) {
    super(mensagem);
    this.status = status;
    this.faltando = faltando;
  }
}

const NUMERO_PROVISORIO = (ano: number) => `000/${ano}`;

async function carregar(uid: string, empresaId: string, orcamentoId: string) {
  const { estado } = await lerEstado(uid);
  const empresa: Empresa | undefined = estado?.empresas.find((e) => e.id === empresaId);
  if (!empresa) throw new ErroGeracao("Empresa não encontrada.", 404);
  if (!empresa.prestador?.habilitado) {
    throw new ErroGeracao("Contratos e recibos não estão habilitados nesta empresa.", 403);
  }
  const salvo: Orcamento | undefined = empresa.orcamentos.find((o) => o.id === orcamentoId);
  if (!salvo) throw new ErroGeracao("Orçamento não encontrado. Aguarde salvar e tente de novo.", 404);
  // Campos vazios do serviço (pacote, prazo, tempo, fotos) saem dos itens do
  // catálogo — cobre orçamentos montados antes de o montador gravá-los.
  const orcamento: Orcamento = {
    ...salvo,
    servicoContrato: aplicarServicoDosItens(
      { ...servicoContratoVazio(), ...salvo.servicoContrato },
      {},
      servicoContratoDosItens(salvo.itens, empresa.servicos)
    ),
  };
  const cliente = empresa.clientes.find((c) => c.id === orcamento.clienteId);
  return { empresa, orcamento, cliente };
}

function barrarSeFaltar({ faltando }: Resultado) {
  if (faltando.length) throw new ErroGeracao("Faltam dados para gerar o documento.", 422, faltando);
}

/** Preenche e converte; marcador sobrando vira 422 com o nome do campo. */
function preencher(modelo: Uint8Array, r: Resultado): Uint8Array {
  try {
    return preencherModelo(modelo, r.campos);
  } catch (e) {
    if (e instanceof ErroMarcadores) {
      throw new ErroGeracao(
        "O documento ficaria com marcadores sem valor.",
        422,
        e.marcadores.map((m) => `Campo do modelo sem valor: {{${m}}}`)
      );
    }
    throw e;
  }
}

/**
 * Passos comuns: valida com um número provisório (para não consumir número à
 * toa), reserva o número definitivo, preenche, converte, grava e registra.
 * Se algo falhar depois da reserva, o número fica sem uso — nunca é reaproveitado.
 */
async function gerar(params: {
  uid: string;
  empresa: Empresa;
  orcamento: Orcamento;
  clienteNome: string;
  clienteId: string;
  tipo: TipoDocumento;
  pagamentoId?: string;
  montar: (numero: string, hoje: string) => Resultado;
}): Promise<DocumentoGerado> {
  const { uid, empresa, tipo } = params;
  const hoje = hojeNoFuso();
  const ano = Number(hoje.slice(0, 4));
  const modelo = await lerModelo(tipo);

  const previa = params.montar(NUMERO_PROVISORIO(ano), hoje);
  barrarSeFaltar(previa);
  preencher(modelo, previa);

  const numero = formatarNumeroDocumento(await reservarNumero(uid, empresa.id, tipo, ano), ano);
  const resultado = params.montar(numero, hoje);
  barrarSeFaltar(resultado);
  const docx = preencher(modelo, resultado);

  let pdf: Uint8Array | null;
  try {
    pdf = await converterParaPdf(docx);
  } catch (e) {
    console.error("Falha na conversão para PDF.", e);
    throw new ErroGeracao("Não foi possível converter o documento para PDF. Tente de novo em instantes.", 502);
  }

  const formato = pdf ? "pdf" : "docx";
  const nomeArquivo = nomeArquivoDocumento(tipo, numero, params.clienteNome, formato);
  const id = uuid();
  await gravarArquivo(uid, id, pdf ?? docx, {
    nomeArquivo,
    contentType: pdf
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  return registrarDocumento(uid, empresa.id, {
    id,
    tipo,
    numero,
    modeloVersao: empresa.prestador?.modeloVersao ?? "",
    geradoEm: new Date().toISOString(),
    dataGeracao: hoje,
    empresaId: empresa.id,
    orcamentoId: params.orcamento.id,
    clienteId: params.clienteId,
    ...(params.pagamentoId ? { pagamentoId: params.pagamentoId } : {}),
    formato,
    nomeArquivo,
  });
}

export async function gerarContrato(uid: string, empresaId: string, orcamentoId: string) {
  const { empresa, orcamento, cliente } = await carregar(uid, empresaId, orcamentoId);
  return gerar({
    uid,
    empresa,
    orcamento,
    clienteNome: cliente?.nome ?? "",
    clienteId: cliente?.id ?? orcamento.clienteId,
    tipo: "contrato",
    montar: (numero, hoje) =>
      montarCamposContrato({
        prestador: empresa.prestador,
        cliente,
        orcamento,
        numero,
        dataGeracao: hoje,
        sinalPercentual: percentualSinal(orcamento, empresa),
      }),
  });
}

export async function gerarRecibo(uid: string, empresaId: string, orcamentoId: string, pagamentoId: string) {
  const { empresa, orcamento, cliente } = await carregar(uid, empresaId, orcamentoId);

  // O recibo cita o contrato mais recente do orçamento.
  const contratos = (await listarDocumentos(uid, empresa.id))
    .filter((d) => d.tipo === "contrato" && d.orcamentoId === orcamento.id)
    .sort((a, b) => (a.geradoEm < b.geradoEm ? 1 : -1));
  const contrato = contratos[0] ? { numero: contratos[0].numero, dataGeracao: contratos[0].dataGeracao } : null;

  return gerar({
    uid,
    empresa,
    orcamento,
    clienteNome: cliente?.nome ?? "",
    clienteId: cliente?.id ?? orcamento.clienteId,
    tipo: "recibo",
    pagamentoId,
    montar: (numero) =>
      montarCamposRecibo({ prestador: empresa.prestador, cliente, orcamento, pagamentoId, contrato, numero }),
  });
}
