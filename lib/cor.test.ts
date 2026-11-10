import { expect, test } from "vitest";
import { COR_MARCA, corHexValida, corSobre, luminancia } from "./cor";

test("texto em cima do destaque: preto em cor clara, branco em cor escura", () => {
  expect(corSobre(COR_MARCA)).toBe("#0a0a0a");
  expect(corSobre("#ffffff")).toBe("#0a0a0a");
  expect(corSobre("#facc15")).toBe("#0a0a0a");
  expect(corSobre("#2563eb")).toBe("#ffffff");
  expect(corSobre("#000000")).toBe("#ffffff");
  expect(corSobre("#7c3aed")).toBe("#ffffff");
});

test("luminância e validação", () => {
  expect(luminancia("#000000")).toBe(0);
  expect(luminancia("#ffffff")).toBeCloseTo(1);
  expect(corHexValida("#2563EB")).toBe(true);
  expect(corHexValida("2563eb")).toBe(false);
  expect(corHexValida("#abc")).toBe(false);
  expect(corHexValida(undefined)).toBe(false);
});
