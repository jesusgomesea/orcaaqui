import { describe, expect, test, vi } from "vitest";
import { comLimite, EtapaTravada, semCorpoSeDescartavel } from "./blobsFetch";

describe("semCorpoSeDescartavel", () => {
  test("mantém o corpo só em GET 200", async () => {
    const r = new Response('{"a":1}', { status: 200 });
    expect(semCorpoSeDescartavel(r, "GET")).toBe(r);
  });

  test.each([
    ["GET", 404],
    ["PUT", 412],
    ["PUT", 200],
    ["DELETE", 200],
  ])("%s %i chega sem corpo, com o mesmo status e cabeçalhos", async (metodo, status) => {
    const original = new Response("corpo", { status, headers: { etag: '"x"' } });
    const cancelar = original.body ? vi.spyOn(original.body, "cancel") : null;
    const r = semCorpoSeDescartavel(original, metodo);
    expect(r).not.toBe(original);
    expect(r.status).toBe(status);
    expect(r.headers.get("etag")).toBe('"x"');
    expect(r.body).toBeNull();
    if (cancelar) expect(cancelar).toHaveBeenCalled();
  });
});

describe("comLimite", () => {
  test("devolve o resultado dentro do prazo", async () => {
    await expect(comLimite("x", Promise.resolve(42), 50)).resolves.toBe(42);
  });

  test("falha com o nome da etapa quando trava", async () => {
    const travada = new Promise(() => {});
    await expect(comLimite("Leitura dos dados", travada, 20)).rejects.toThrow(EtapaTravada);
    await expect(comLimite("Leitura dos dados", travada, 20)).rejects.toThrow(/Leitura dos dados não respondeu/);
  });

  test("repassa o erro original", async () => {
    await expect(comLimite("x", Promise.reject(new Error("boom")), 50)).rejects.toThrow("boom");
  });
});

test("resposta já sem corpo passa direto", () => {
  const r = new Response(null, { status: 204 });
  expect(semCorpoSeDescartavel(r, "DELETE")).toBe(r);
});
