import { expect, test } from "vitest";
import { dimensoesAjustadas, tamanhoDataUrl } from "./imagem";

test("logo cabe em 400px sem distorcer e sem aumentar imagem pequena", () => {
  expect(dimensoesAjustadas(4000, 3000)).toEqual({ largura: 400, altura: 300 });
  expect(dimensoesAjustadas(1000, 2000)).toEqual({ largura: 200, altura: 400 });
  expect(dimensoesAjustadas(120, 80)).toEqual({ largura: 120, altura: 80 });
  expect(dimensoesAjustadas(5000, 10)).toEqual({ largura: 400, altura: 1 });
  expect(dimensoesAjustadas(0, 100)).toEqual({ largura: 0, altura: 0 });
});

test("tamanho aproximado da data: URL", () => {
  expect(tamanhoDataUrl("data:image/png;base64," + "A".repeat(4096))).toBe("3 KB");
  expect(tamanhoDataUrl("data:image/png;base64,AAAA")).toBe("3 B");
});
