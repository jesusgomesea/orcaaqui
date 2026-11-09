// Preenche um modelo .docx com docxtemplater. Recebe e devolve bytes — ler o
// modelo do disco fica em lib/server/modelos.ts. Logo, cabeçalho, rodapé e
// formatação vêm do próprio modelo: nada de layout é recriado aqui.

import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import type { Campos } from "./campos.ts";

export class ErroMarcadores extends Error {
  marcadores: string[];
  constructor(marcadores: string[]) {
    super(`O documento ainda contém marcadores sem valor: ${marcadores.join(", ")}`);
    this.name = "ErroMarcadores";
    this.marcadores = marcadores;
  }
}

/** Texto visível de um XML do Word (sem tags), para procurar `{{` sobrando. */
function textoDoXml(xml: string): string {
  return xml.replace(/<[^>]+>/g, "");
}

/** Marcadores `{{campo}}` que sobraram em qualquer parte do documento. */
export function marcadoresRestantes(docx: Uint8Array): string[] {
  const zip = new PizZip(docx);
  const restantes = new Set<string>();
  for (const nome of Object.keys(zip.files)) {
    if (!/^word\/.*\.xml$/.test(nome)) continue;
    const texto = textoDoXml(zip.file(nome)?.asText() ?? "");
    if (!texto.includes("{{")) continue;
    const achados = texto.match(/\{\{\s*([^}]*?)\s*\}\}/g);
    if (achados) for (const m of achados) restantes.add(m.replace(/[{}\s]/g, ""));
    else restantes.add("{{");
  }
  return [...restantes];
}

/**
 * Preenche o modelo e garante que nenhum `{{` sobrou. Campo ausente do
 * dicionário volta como `{{campo}}` (nullGetter) justamente para ser pego pela
 * checagem final, em vez de virar texto vazio silencioso.
 */
export function preencherModelo(modelo: Uint8Array, campos: Campos): Uint8Array {
  const doc = new Docxtemplater(new PizZip(modelo), {
    delimiters: { start: "{{", end: "}}" },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: (parte) => `{{${parte.value}}}`,
  });
  // Campo vazio também conta como faltando: vira `{{campo}}` e é bloqueado.
  const valores: Campos = {};
  for (const [k, v] of Object.entries(campos)) if (v !== "") valores[k] = v;
  doc.render(valores);

  const saida = doc.getZip().generate({ type: "uint8array", compression: "DEFLATE" }) as Uint8Array;
  const restantes = marcadoresRestantes(saida);
  if (restantes.length) throw new ErroMarcadores(restantes);
  return saida;
}
