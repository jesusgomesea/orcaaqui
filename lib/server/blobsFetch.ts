// Peças puras do acesso ao Netlify Blobs, separadas de lib/server/blobs.ts
// (que importa "server-only") para poderem ser testadas no Vitest.
//
// Origem: o painel do EJ Fotografia caiu em produção por estas duas falhas do
// Blobs dentro do Netlify; o Orça Aqui usa o mesmo cliente e tinha a mesma
// falha latente (primeiro acesso de usuário novo = 404, e toda gravação).

/**
 * O Blobs descarta o corpo das respostas que não lê (404 = chave ainda não
 * existe, 412 = gravação condicional recusada, e toda gravação) com
 * `res.body.cancel()` — e no Netlify essa chamada NUNCA termina: a função
 * ficava presa até ser cortada (502). Só GET com 200 usa o corpo; nas outras,
 * entregamos uma resposta sem corpo (mesmo status e cabeçalhos, que é o que o
 * Blobs consulta) e liberamos a original sem esperar.
 */
export function semCorpoSeDescartavel(r: Response, metodo: string): Response {
  const usaCorpo = metodo.toUpperCase() === "GET" && r.status === 200;
  if (usaCorpo || !r.body) return r;
  r.body.cancel().catch(() => {});
  return new Response(null, { status: r.status, statusText: r.statusText, headers: r.headers });
}

export class EtapaTravada extends Error {
  constructor(etapa: string, limiteMs: number) {
    super(`${etapa} não respondeu em ${limiteMs / 1000} s`);
    this.name = "EtapaTravada";
  }
}

/**
 * Limite de tempo para uma etapa de rede. O Blobs repete em silêncio as
 * chamadas que falham (5xx, 429, erro de rede) esperando segundos entre as
 * tentativas: sem limite, a função era cortada pelo Netlify (~10 s, 502 sem
 * explicação). Com ele, a resposta diz QUAL etapa travou.
 */
export async function comLimite<T>(etapa: string, tarefa: Promise<T>, limiteMs = 3_000): Promise<T> {
  let relogio: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      tarefa,
      new Promise<never>((_, rejeitar) => {
        relogio = setTimeout(() => rejeitar(new EtapaTravada(etapa, limiteMs)), limiteMs);
      }),
    ]);
  } finally {
    clearTimeout(relogio);
  }
}
