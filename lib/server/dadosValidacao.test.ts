import { describe, expect, test } from "vitest";
import { estadoValido, lerCorpoDoPut } from "./dadosValidacao";

const estado = { empresaAtivaId: "e1", empresas: [{ id: "e1" }], novidadesVistoId: null };

describe("corpo do PUT /api/dados", () => {
  test("formato atual, com e sem versão", () => {
    expect(lerCorpoDoPut({ estado, versaoBase: '"abc"' })).toEqual({ ok: true, estado, versaoBase: '"abc"' });
    expect(lerCorpoDoPut({ estado, versaoBase: null })).toEqual({ ok: true, estado, versaoBase: null });
    expect(lerCorpoDoPut({ estado })).toEqual({ ok: true, estado, versaoBase: null });
  });

  test("estado solto (aba antiga, sem versão) é recusado com 409, não gravado às cegas", () => {
    expect(lerCorpoDoPut(estado)).toMatchObject({ ok: false, status: 409 });
  });

  test("lixo é 400", () => {
    expect(lerCorpoDoPut(null)).toMatchObject({ ok: false, status: 400 });
    expect(lerCorpoDoPut({ estado: { empresas: [] } })).toMatchObject({ ok: false, status: 400 });
    expect(lerCorpoDoPut({ estado, versaoBase: 3 })).toMatchObject({ ok: false, status: 400 });
    expect(lerCorpoDoPut({ algo: 1 })).toMatchObject({ ok: false, status: 400 });
  });

  test("estadoValido", () => {
    expect(estadoValido(estado)).toBe(true);
    expect(estadoValido({ ...estado, empresas: [] })).toBe(false);
    expect(estadoValido({ empresas: [{}] })).toBe(false);
  });
});
