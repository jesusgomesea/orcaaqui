import { describe, expect, it } from "vitest";
import { SCRIPT_TEMA, temaDe } from "./tema";

describe("temaDe", () => {
  it("escuro é o padrão de quem nunca escolheu", () => {
    expect(temaDe(null)).toBe("dark");
  });
  it("respeita a escolha salva", () => {
    expect(temaDe("light")).toBe("light");
    expect(temaDe("dark")).toBe("dark");
  });
  it("valor estranho no armazenamento cai no padrão", () => {
    expect(temaDe("azul")).toBe("dark");
  });
});

describe("SCRIPT_TEMA", () => {
  function rodar(ler: () => string | null) {
    const classes = new Set<string>();
    const documento = { documentElement: { classList: { add: (c: string) => classes.add(c) } } };
    const armazenamento = { getItem: ler };
    new Function("document", "localStorage", SCRIPT_TEMA)(documento, armazenamento);
    return classes.has("dark") ? "dark" : "light";
  }

  it("segue a mesma regra de temaDe", () => {
    for (const salvo of [null, "light", "dark", "azul"]) expect(rodar(() => salvo)).toBe(temaDe(salvo));
  });
  it("armazenamento bloqueado ainda abre no escuro", () => {
    expect(rodar(() => { throw new Error("bloqueado"); })).toBe("dark");
  });
});
