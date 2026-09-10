import "server-only";

import { getStore } from "@netlify/blobs";
import type { EstadoApp } from "@/lib/tipos";

const NOME_DA_STORE = "orcaaqui-dados";

/**
 * Uma chave por usuário do Identity. `strong` porque o app grava e relê o
 * mesmo registro em sequência: com a consistência eventual do edge o usuário
 * poderia recarregar e ver o estado anterior.
 */
function store() {
  return getStore({ name: NOME_DA_STORE, consistency: "strong" });
}

export async function lerEstado(usuarioId: string): Promise<EstadoApp | null> {
  const bruto = await store().get(`usuario/${usuarioId}.json`, { type: "json" });
  return (bruto as EstadoApp | null) ?? null;
}

export async function gravarEstado(usuarioId: string, estado: EstadoApp): Promise<void> {
  await store().setJSON(`usuario/${usuarioId}.json`, estado);
}

/**
 * O corpo vem do navegador do próprio dono dos dados, então não há nada a
 * proteger de outro usuário aqui — a checagem existe pra não gravar lixo que
 * quebraria a leitura seguinte (e para barrar payload absurdo).
 */
export function estadoValido(valor: unknown): valor is EstadoApp {
  if (typeof valor !== "object" || valor === null) return false;
  const e = valor as Partial<EstadoApp>;
  return Array.isArray(e.empresas) && e.empresas.length > 0 && typeof e.empresaAtivaId === "string";
}
