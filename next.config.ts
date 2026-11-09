import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Os modelos .docx são lidos do disco pelas rotas de documentos; sem isto o
  // arquivo não entra no pacote da Netlify Function.
  outputFileTracingIncludes: {
    "/api/documentos/**": ["./templates/**"],
  },
};

export default nextConfig;
