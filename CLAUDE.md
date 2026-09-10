# Orça Aqui — CLAUDE.md

## O que é
Site de geração de orçamentos, com conta própria. Cada usuário entra com e-mail/senha (Netlify Identity) e seus dados ficam guardados na conta, acessíveis de qualquer dispositivo. Suporta múltiplas empresas na mesma conta, cada uma com seus próprios dados. Hospedado na Netlify.

## Objetivo
Deixar qualquer prestador de serviço montar um orçamento com a cara da própria empresa (logo, cor, dados) e enviar pro cliente (PDF via impressão do navegador ou texto pronto pro WhatsApp) — sem mensalidade, entrando de onde estiver.

## Stack
- Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 (`@tailwindcss/postcss`)
- Netlify Identity (`@netlify/identity`) para login; Netlify Blobs (`@netlify/blobs`) para os dados
- Radix UI primitives (dialog, select, tabs) + `class-variance-authority` + `lucide-react`
- `sonner` para toasts, `recharts` pro gráfico de faturamento
- `oxlint` para lint (`npm run lint`), `tsc --noEmit` para tipos (`npm run typecheck`)

## Rodar localmente
**Precisa de `netlify dev`, não `next dev`.** O endpoint `/.netlify/identity` vem do runtime da Netlify: com `next dev` puro, `getUser()` devolve `null` e as mutações lançam `MissingIdentityError`. O script `dev:next` existe só pra mexer em layout/CSS sem tocar em auth.

```bash
npm install
npx netlify link      # uma vez, pra apontar pro projeto da Netlify
npm run dev
```

## Autenticação (Netlify Identity)
A divisão é a recomendada para frameworks com SSR — ver [NETLIFY-IDENTITY.md](NETLIFY-IDENTITY.md), o guia que embasou esta migração:

- **Mutações no navegador**: `login()`, `signup()`, `logout()`, `updateUser()` — falam direto com o Identity e escrevem os cookies `nf_jwt`/`nf_refresh`.
- **Leitura no servidor**: `getUser()` em [app/api/dados/route.ts](app/api/dados/route.ts), validando o cookie da requisição. É aí que está a garantia de verdade — o portão do cliente é só UX.

Pontos que custam tempo se forem esquecidos:

- **Depois de qualquer mutação de auth, navegação completa** (`window.location.href`), nunca `router.push()`: a navegação suave não leva o cookie recém-escrito ao servidor. Está assim em [app/entrar/page.tsx](app/entrar/page.tsx), [app/nova-senha/page.tsx](app/nova-senha/page.tsx) e no "Sair" do [Sidebar](components/layout/Sidebar.tsx).
- **`handleAuthCallback()` mora no layout raiz**, dentro de [ProvedorSessao](components/auth/ProvedorSessao.tsx), não numa rota `/callback`: os links de e-mail voltam com o token no hash e podem cair em qualquer página. O estado `processandoLink` já começa `true` quando há token, senão a página pisca por baixo antes do redirecionamento.
- **A sessão é resolvida no cliente**, o que mantém as páginas estáticas (só `/api/dados` é dinâmica). Chamar `getUser()` num Server Component tornaria a página dinâmica.
- **`autoconfirm` desligado (padrão) significa que `signup()` não abre sessão** — a UI trata os dois casos checando `criado.confirmedAt`.
- **Recuperação de senha responde igual para e-mail cadastrado e não cadastrado**, senão o formulário vira um oráculo que revela quem tem conta.

## Persistência
Um único objeto de estado por usuário, gravado como JSON no Netlify Blobs (store `orcaaqui-dados`, chave `usuario/<id do Identity>.json`, consistência `strong`). O acesso passa por [lib/server/dados.ts](lib/server/dados.ts) e pela rota [/api/dados](app/api/dados/route.ts) (GET carrega, PUT salva), sempre atrás de `getUser()`.

No cliente, [lib/store.tsx](lib/store.tsx) (Context API) carrega o estado ao montar e salva com debounce de 700ms — digitar num campo não dispara uma requisição por tecla. Um `pagehide` faz a última gravação pendente com `keepalive`, pra fechar a aba dentro da janela do debounce não perder a alteração. O status aparece no rodapé do Sidebar (`statusSincronizacao`).

Forma dos dados (as interfaces vivem em [lib/tipos.ts](lib/tipos.ts)):
```ts
{
  empresaAtivaId: string,
  empresas: [{
    id, nome, documento, telefone, email, site, endereco, logoDataUrl, corPrimaria, moeda,
    dadosBancarios, condicoesPadrao,
    clientes: [{ id, nome, documento, telefone, email, endereco, observacoes }],
    orcamentos: [{
      id, criadoEm, clienteId, data, validadeDias, moeda,
      itens: [{ id, descricao, quantidade, valorUnitario }],
      desconto, descontoTipo /* "valor" | "percentual" */, acrescimo,
      condicoes, observacoes,
      status /* rascunho | enviado | aprovado | recusado */,
    }],
    servicos: [{ id, categoria, nome, descricao, valor }],
  }],
  novidadesVistoId: string | null,
}
```

Cada empresa é totalmente isolada (clientes/orçamentos/serviços próprios) — pense nela como um "workspace". A empresa ativa é acessada via `useStore().empresaAtiva` (não `state.empresas[0]` — sempre resolver pelo `empresaAtivaId`). Toda mutação de cliente/orçamento/serviço no store (`addCliente`, `addOrcamento`, etc.) escreve na empresa ativa, nunca precisa de `empresaId` como argumento.

**Migrações de formato.** `normalizar()` em `store.tsx` é o caminho por onde passa tudo que entra (servidor, backup importado, localStorage antigo). Dentro dele, `migrarSeNecessario()` cobre o formato v1, de empresa única (`{ empresa, clientes, orcamentos }` no topo). Ao mexer no formato de novo, manter esse caminho — é o que evita perda de dados de quem já usava.

**Migração do localStorage.** Quem usava a versão sem login tinha tudo em `localStorage["orcaaqui-dados-v1"]`. No primeiro login, se a conta ainda não tem dados no servidor, o store sobe o que houver nessa chave e depois a arquiva em `orcaaqui-dados-migrado-v1`. O arquivamento não é opcional: sem ele, a próxima conta a entrar neste mesmo navegador importaria os dados da primeira.

Status **expirado** não é gravado — é calculado na hora (`statusEfetivo` em [lib/helpers.ts](lib/helpers.ts)) comparando a validade com a data de hoje.

**Numeração de orçamento.** `Orcamento.numero` é gravado na criação, a partir do contador `Empresa.proximoNumero`, e nunca muda. Já foi derivado da posição no array, o que renumerava todos os posteriores a cada exclusão — o cliente ficava com um PDF cujo número não existia mais no sistema. Só `addOrcamento` atribui número (depois do spread, senão duplicar herdaria o do original); `numerarOrcamentosLegados()` em `store.tsx` numera pela ordem atual o que foi gravado antes do campo existir, preservando o que essas pessoas já viam. Para exibir, `formatarNumeroOrcamento(numero)` em helpers.ts.

A logo é salva como `data:` URL (base64) direto no state; o upload em [empresa/page.tsx](app/(app)/empresa/page.tsx) rejeita arquivos acima de 1.5MB, e a rota recusa corpo acima de 8MB.

Backup/portabilidade: exportar/importar o JSON inteiro do state (botões em Empresa) — inclui todas as empresas. Serve pra guardar cópia fora do serviço ou levar tudo pra outra conta. Importar **substitui** os dados da conta, por isso pede confirmação.

## Moeda
Cada empresa tem uma `moeda` padrão (ver `MOEDAS` em [helpers.ts](lib/helpers.ts)); cada orçamento pode sobrescrever a própria moeda (útil pra cliente de fora). `formatMoney(v, moeda)` sempre recebe a moeda explicitamente — nunca assumir BRL fixo num componente novo.

## Rotas
Todas as telas do app ficam no route group `app/(app)/`, cujo layout aplica o portão de autenticação, o `StoreProvider` e o Sidebar de uma vez.

**A raiz `/` é pública** ([app/page.tsx](app/page.tsx)) — a landing, fora do route group. O app autenticado começa em `/painel`. Por isso todo destino pós-autenticação aponta para `/painel`, nunca para `/`: `/entrar`, `/nova-senha`, o `handleAuthCallback()` do [ProvedorSessao](components/auth/ProvedorSessao.tsx) e o item "Painel" do [Sidebar](components/layout/Sidebar.tsx). O "Sair" é a exceção — leva de volta para a landing. Quem chega sem sessão numa rota do `(app)` continua caindo em `/entrar` (já queria o app, não a vitrine).

- **`/`** ([app/page.tsx](app/page.tsx)) — Landing pública: hero, recursos, como funciona e CTA para `/entrar`. A página é Server Component só pra poder exportar `metadata` (título/OG, já que o link circula em WhatsApp e redes); o conteúdo é a ilha cliente [components/landing/Landing.tsx](components/landing/Landing.tsx), que lê `useSessao()` apenas pra trocar o CTA por "Ir para o painel" de quem já está logado. Não usa o `StoreProvider`
- **`/painel`** ([page.tsx](app/(app)/painel/page.tsx)) — Painel: KPIs, gráfico de faturamento (orçado x aprovado, últimos 6 meses, via `recharts`) e tabela de orçamentos "enviados" perto do vencimento
- **`/orcamentos`** — CRUD completo com itens dinâmicos (com seletor de serviço do catálogo pra autopreencher), desconto em valor/%, acréscimo, moeda por orçamento, PDF (impressão), texto pronto pro WhatsApp (`wa.me`), duplicar
- **`/clientes`** — CRUD simples + importar/exportar CSV (`clientesParaCsv`/`csvParaClientes` em helpers.ts — parser próprio, sem dependência)
- **`/servicos`** — catálogo de serviços com preço padrão, reaproveitado no formulário de orçamento
- **`/empresa`** — conta (trocar senha), gestão de empresas (criar/trocar/remover), dados da empresa ativa, logo, cor, moeda, dados bancários/Pix, backup JSON
- **`/novidades`** — changelog mantido manualmente em [lib/changelog.ts](lib/changelog.ts). **Não é automático**: a cada entrega relevante, adicionar uma entrada nova no topo do array `NOVIDADES` com `id` crescente (prefixo de data, ex: `2026-09-09-01`) — o Sidebar mostra um badge com a contagem de entradas mais novas que `state.novidadesVistoId`, zerado ao visitar a página.
- **`/entrar`, `/recuperar-senha`, `/nova-senha`** — fora do route group, telas de autenticação acessíveis sem sessão (junto com a landing em `/`)

## Tema claro/escuro
A classe `.dark` no `<html>` é escrita por `SCRIPT_TEMA` ([lib/tema.ts](lib/tema.ts)), inline no `<head>` do layout raiz, **antes da primeira pintura** — sem isso a página pisca clara para quem escolheu escuro. Por isso `tema.ts` não importa React: o layout raiz é Server Component.

O React só espelha esse estado, via `useSyncExternalStore` em [lib/useTema.ts](lib/useTema.ts) — no servidor não há como saber o que o script decidiu, e chutar causaria erro de hidratação. A paleta de cada tema é um bloco de variáveis CSS em [app/globals.css](app/globals.css); componente novo usa os tokens (`bg-surface`, `text-text-muted`…), nunca cor fixa.

## Geração de PDF
Não usa lib de PDF (jsPDF/html2canvas) — usa `window.print()` sobre um container escondido (`#orcamento-print` no layout de `(app)`) com CSS `@media print` em [globals.css](app/globals.css) que esconde o resto da página. O HTML do orçamento é montado inline (estilos inline com cores claras fixas, não Tailwind) em `gerarOrcamentoHtml` dentro de `app/(app)/orcamentos/page.tsx`, porque esse HTML vira o documento impresso/PDF: precisa ser autocontido e não pode herdar o tema escuro da tela. Ao mudar o layout do orçamento impresso, editar essa função — não o JSX da página.

**Todo valor de dado interpolado ali passa por `escapeHtml()`, e a logo por `logoSegura()`** (ambos em [helpers.ts](lib/helpers.ts)). Isso vira `innerHTML`: sem escape, uma descrição com `<` some do PDF e um nome de cliente vindo de CSV de terceiro (`<img src=x onerror=...>`) roda script na sessão de quem importou, com acesso à `/api/dados`. Campo novo no documento impresso entra escapado.

## Diálogos (Radix)
Os componentes `Dialog`/`DialogContent` em [components/ui/dialog.tsx](components/ui/dialog.tsx) **não têm animação de abrir/fechar de propósito**. Já existiu animação via CSS (`data-state` + `@keyframes`), mas com diálogos aninhados (ex: "+ Novo cliente" dentro do formulário de orçamento) a Presence do Radix não desmontava de forma confiável em StrictMode, deixando o overlay preto travado cobrindo a tela (parecia a página ter travado/ficado em branco). Não reintroduzir animação de fechamento sem testar bem o caso de diálogo aninhado.

## Deploy (Netlify)
[netlify.toml](netlify.toml) usa o `@netlify/plugin-nextjs`, que transforma as rotas de servidor em Netlify Functions v2 — formato exigido pelo Identity. Sem variáveis de ambiente.

**O Netlify roda `npm install` puro.** Um conflito de peer dependency derruba o deploy mesmo com o `package-lock.json` commitado; resolver localmente com `--legacy-peer-deps` só esconde o problema e o site fica num build antigo sem ninguém notar. Se `npm install` não passa limpo, não vai ao ar.

No painel, é preciso ter **Identity habilitado** e decidir `Registration preferences` (`Open` / `Invite only`) e o `autoconfirm`. Os modelos de e-mail chegam em inglês por padrão — traduzir. Para conferir o estado sem abrir o painel: `https://SEU-SITE.netlify.app/.netlify/identity/settings` (404 = Identity desligado).

## CI
[.github/workflows/checks.yml](.github/workflows/checks.yml) roda `npm ci`, `typecheck`, `lint` e `build` em todo push e PR. O `npm ci` é de propósito: falha quando o `package-lock.json` está fora de sincronia com o `package.json` — exatamente o que derruba o build da Netlify e deixa o site num build antigo sem aviso. Preferir abrir PR e esperar o verde a empurrar direto em `main`, já que push em `main` publica em produção.

## Convenções
- Nomes de campos/variáveis em português, comentários em português quando necessário
- TypeScript em todo o projeto; `npm run typecheck` antes de dar por pronto
- Componentes de UI em `components/ui/*` são genéricos (não sabem nada de orçamento/cliente); lógica de domínio fica nas páginas
- Páginas e componentes com estado levam `"use client"`; o que roda no servidor fica em `lib/server/*` (com `import "server-only"`)
- `cn()` ([lib/utils.ts](lib/utils.ts)) para merge de classes Tailwind — sempre usar em vez de concatenar strings de classe
