/*
  Service worker do Orça Aqui.

  Existe por dois motivos: é requisito para o navegador oferecer a instalação
  do app, e dá uma tela decente quando a rede cai. NÃO é uma camada de uso
  offline de verdade — os dados vivem na conta e dependem da rede.

  Regra que não pode ser quebrada: nada de `/api/` ou `/.netlify/` entra em
  cache. São dados do usuário e autenticação; servir uma resposta guardada ali
  mostraria orçamento errado ou sessão que já expirou.
*/
const CACHE = "orcaaqui-v1";
const PAGINA_OFFLINE = "/offline";

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(PAGINA_OFFLINE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  const requisicao = evento.request;
  if (requisicao.method !== "GET") return;

  const url = new URL(requisicao.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/.netlify/")) return;

  // Páginas: sempre a rede primeiro, pra nunca servir HTML velho. Sem rede,
  // cai na tela de offline.
  if (requisicao.mode === "navigate") {
    evento.respondWith(
      fetch(requisicao).catch(() => caches.match(PAGINA_OFFLINE).then((r) => r || Response.error()))
    );
    return;
  }

  // Estáticos do Next têm hash no nome, então nunca mudam de conteúdo:
  // cache-first é seguro e deixa a abertura instantânea.
  if (url.pathname.startsWith("/_next/static/")) {
    evento.respondWith(
      caches.match(requisicao).then(
        (guardado) =>
          guardado ||
          fetch(requisicao).then((resposta) => {
            if (resposta.ok) {
              const copia = resposta.clone();
              caches.open(CACHE).then((cache) => cache.put(requisicao, copia));
            }
            return resposta;
          })
      )
    );
  }
});
