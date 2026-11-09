// Testes de unidade das regras (lib/): contas, textos e leitura de dados.
// Não cobre telas: o que precisa ser exato é a conta, o texto e a migração de formato.
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { include: ["lib/**/*.test.ts"] },
});
