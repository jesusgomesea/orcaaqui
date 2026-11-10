// Validação do corpo do PUT /api/dados. Sem "server-only" de propósito, para
// ser testada no Vitest (lib/server/dadosValidacao.test.ts).
import type { EstadoApp } from "@/lib/tipos";

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

export type CorpoDoPut =
  | { ok: true; estado: EstadoApp; versaoBase: string | null }
  | { ok: false; status: 400 | 409; erro: string };

/**
 * Formato atual: `{ estado, versaoBase }`. O formato antigo (o estado solto,
 * sem versão) vem de uma aba aberta antes da atualização: é recusado com 409,
 * porque gravá-lo seria justamente a sobrescrita às cegas que a versão evita.
 */
export function lerCorpoDoPut(corpo: unknown): CorpoDoPut {
  if (typeof corpo !== "object" || corpo === null) return { ok: false, status: 400, erro: "Corpo inválido." };
  const c = corpo as { estado?: unknown; versaoBase?: unknown };
  if (!("estado" in c)) {
    if (estadoValido(corpo)) {
      return { ok: false, status: 409, erro: "O Orça Aqui foi atualizado. Recarregue a página para continuar." };
    }
    return { ok: false, status: 400, erro: "Formato de dados inesperado." };
  }
  if (!estadoValido(c.estado)) return { ok: false, status: 400, erro: "Formato de dados inesperado." };
  if (c.versaoBase !== null && c.versaoBase !== undefined && typeof c.versaoBase !== "string") {
    return { ok: false, status: 400, erro: "Versão inválida." };
  }
  return { ok: true, estado: c.estado, versaoBase: (c.versaoBase as string | null | undefined) ?? null };
}
