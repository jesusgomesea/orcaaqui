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
- `oxlint` para lint (`npm run lint`), `tsc --noEmit` para tipos (`npm run typecheck`), Vitest para as regras em `lib/` (`npm test`; config em [vitest.config.mts](vitest.config.mts), alias `@/` igual ao do app)
- `docxtemplater` + `pizzip` para preencher os modelos de contrato/recibo; `docx-preview` para desenhar o .docx no navegador e imprimir em PDF (Gotenberg externo é opcional)

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

**Controle de versão (dois aparelhos).** O GET devolve `{ estado, versao }` (o etag do Blobs) e o PUT manda `{ estado, versaoBase }`; o servidor grava com `onlyIfMatch` (ou `onlyIfNew` numa conta nova) e responde **409** se outro aparelho salvou no meio ([lib/server/dados.ts](lib/server/dados.ts), corpo validado em `lerCorpoDoPut`, testado). No 409 o store para de salvar (`statusSincronizacao: "conflito"`) e mostra uma faixa com "Recarregar" — antes o último aparelho a salvar apagava em silêncio o que o outro gravou. O corpo antigo (estado solto, sem versão), de uma aba aberta antes da atualização, também vira 409.
- Os PUTs passam por uma **fila** (`fila` no store): dois salvamentos simultâneos mandariam a mesma versão e o segundo daria falso conflito com o próprio aparelho.
- Ao **voltar para o app** (`visibilitychange`/`focus`), sem nada pendente, o store relê o servidor e, se a versão mudou, troca o estado — o que foi salvo no outro aparelho aparece sozinho e o conflito quase não acontece.

Forma dos dados (as interfaces vivem em [lib/tipos.ts](lib/tipos.ts)):
```ts
{
  empresaAtivaId: string,
  empresas: [{
    id, nome, documento, telefone, email, site, endereco, logoDataUrl, corPrimaria, moeda,
    dadosBancarios, condicoesPadrao,
    clientes: [{ id, nome, documento, telefone, email, endereco, observacoes }],
    orcamentos: [{
      id, numero, criadoEm, clienteId, data, validadeDias, moeda,
      itens: [{ id, descricao, quantidade, valorUnitario, tipo? /* adicional */, servicoId? }],
      desconto, descontoTipo /* "valor" | "percentual" */, acrescimo,
      condicoes, observacoes,
      status /* rascunho | enviado | aprovado | recusado */,
      servicoContrato? /* data, horários e local do serviço moram aqui */,
      pagamentos?: [{ id, tipo /* sinal | restante | integral | outro */, valor, data, forma, descricao? }],
      codigoRef? /* ORC-0012 | EJ-XXXXX */, refEj? /* linha [ref EJ-…] */,
      parceria?: { contrapartidas: [{ id, tipo /* divulgacao | permuta | indicacao | outra */, descricao, quantidade, prazo, valorEstimado, registros: [{ id, data, detalhe }] }] }, sinalPercentual?, origem? /* manual | gerador | colado-ej | colado-orc */,
    }],
    servicos: [{ id, categoria, nome, descricao, valor, codigo, unidade?, precoVolume?, volumeMin?, prazo?, ativo? }],
    prestador?: { habilitado, nome, cpf, endereco, whatsapp, email, pix, modeloVersao },
    config: { sinalPercentual /* 40 */, validadeDias, deslocamentos: [{ id, nome, valor }],
              etapasAgenda: [{ id, nome, descricao? }], urlTabelaEj?, versaoCatalogo, codigo },
    agendamentos: [{ id, criadoEm, atualizadoEm, orcamentoId, clienteId, moeda, etapa, historico,
                     extras: [{ id, descricao, valor }], notas, valorCombinado, sinalPercentual }],
    proximoNumero,
  }],
  novidadesVistoId: string | null,
}
```

Cada empresa é totalmente isolada (clientes/orçamentos/serviços próprios) — pense nela como um "workspace". A empresa ativa é acessada via `useStore().empresaAtiva` (não `state.empresas[0]` — sempre resolver pelo `empresaAtivaId`). Toda mutação de cliente/orçamento/serviço no store (`addCliente`, `addOrcamento`, etc.) escreve na empresa ativa, nunca precisa de `empresaId` como argumento.

**Migrações de formato.** `normalizar()` em [lib/estado.ts](lib/estado.ts) (puro, testado em `lib/estado.test.ts` com um estado e um backup antigos) é o caminho por onde passa tudo que entra (servidor, backup importado, localStorage antigo). Dentro dele, `migrarSeNecessario()` cobre o formato v1, de empresa única (`{ empresa, clientes, orcamentos }` no topo). Ao mexer no formato de novo, manter esse caminho — é o que evita perda de dados de quem já usava. Campo novo entra opcional ou ganha default em `mergeEmpresa`/`normalizarConfig`, e ganha caso no teste.

- **Códigos curtos são derivados do id** (`codigoDeId`, hash): `config.codigo` da empresa e `Servico.codigo` vão na linha `[ref]` das mensagens. Uma conta antiga ganha sempre os mesmos códigos ao abrir, mesmo antes de gravar — se fossem aleatórios, recarregar a página mudaria a `[ref]` de mensagens já enviadas. `Servico.codigo` nunca muda depois de criado (o store ignora `codigo` em `updateServico`).
- **`config.versaoCatalogo`** sobe sozinho quando valor/preço por volume de um serviço muda ou um serviço é removido (`mudouPreco` + `subirVersaoCatalogo`); quem cola uma `[ref]` com versão antiga recebe aviso de tabela antiga.

**Agenda** ([lib/agenda.ts](lib/agenda.ts)): porte do modelo do painel do EJ. O agendamento guarda só etapas, histórico, extras, notas, `valorCombinado` e o `sinalPercentual` gravado na criação; **pagamentos são os de `Orcamento.pagamentos`** (os mesmos dos recibos) e data/horário/local vêm de `Orcamento.servicoContrato` — não duplicar. `cancelado` é etapa fixa (`ETAPA_CANCELADO`); a última de `config.etapasAgenda` é a de concluído.

**Sinal** = `calcularSinal(total, %)` em [lib/documentos/formatos.ts](lib/documentos/formatos.ts): `ceil(total × % / 100)` em reais inteiros, restante = total − sinal. O % vem de `percentualSinal()`: o do orçamento, senão o da empresa, senão 40. **O contrato só sai com 40%**: o modelo traz "Sinal (40%)" escrito, então outro percentual bloqueia a geração (`SINAL_DO_MODELO`). Pagamento `outro` (pós-venda) não gera recibo.

**Migração do localStorage.** Quem usava a versão sem login tinha tudo em `localStorage["orcaaqui-dados-v1"]`. No primeiro login, se a conta ainda não tem dados no servidor, o store sobe o que houver nessa chave e depois a arquiva em `orcaaqui-dados-migrado-v1`. O arquivamento não é opcional: sem ele, a próxima conta a entrar neste mesmo navegador importaria os dados da primeira.

Status **expirado** não é gravado — é calculado na hora (`statusEfetivo` em [lib/helpers.ts](lib/helpers.ts)) comparando a validade com a data de hoje.

**Numeração de orçamento.** `Orcamento.numero` é gravado na criação, a partir do contador `Empresa.proximoNumero`, e nunca muda. Já foi derivado da posição no array, o que renumerava todos os posteriores a cada exclusão — o cliente ficava com um PDF cujo número não existia mais no sistema. Só `addOrcamento` atribui número (depois do spread, senão duplicar herdaria o do original); `numerarOrcamentosLegados()` em [lib/estado.ts](lib/estado.ts) numera pela ordem atual o que foi gravado antes do campo existir, preservando o que essas pessoas já viam. Para exibir, `formatarNumeroOrcamento(numero)` em helpers.ts.

A logo é salva como `data:` URL direto no state, por isso vai em **todo** salvamento (e o `keepalive` do `pagehide` recusa corpo acima de 64 KB). O upload em [empresa/page.tsx](app/(app)/empresa/page.tsx) comprime com `comprimirLogo` ([lib/imagem.ts](lib/imagem.ts)): no máximo 400px, WebP (PNG onde não houver), SVG passa direto — fica na casa de 10–40 KB. Logos antigas acima de 80 KB são comprimidas uma vez ao abrir a conta. A rota recusa corpo acima de 8MB.

Backup/portabilidade: exportar/importar o JSON inteiro do state (botões em Empresa) — inclui todas as empresas. Serve pra guardar cópia fora do serviço ou levar tudo pra outra conta. Importar **substitui** os dados da conta, por isso pede confirmação.

## Moeda
Cada empresa tem uma `moeda` padrão (ver `MOEDAS` em [helpers.ts](lib/helpers.ts)); cada orçamento pode sobrescrever a própria moeda (útil pra cliente de fora). `formatMoney(v, moeda)` sempre recebe a moeda explicitamente — nunca assumir BRL fixo num componente novo.

## Rotas
Todas as telas do app ficam no route group `app/(app)/`, cujo layout aplica o portão de autenticação, o `StoreProvider` e o Sidebar de uma vez.

**A raiz `/` é pública** ([app/page.tsx](app/page.tsx)) — a landing, fora do route group. O app autenticado começa em `/painel`. Por isso todo destino pós-autenticação aponta para `/painel`, nunca para `/`: `/entrar`, `/nova-senha`, o `handleAuthCallback()` do [ProvedorSessao](components/auth/ProvedorSessao.tsx) e o item "Painel" do [Sidebar](components/layout/Sidebar.tsx). O "Sair" é a exceção — leva de volta para a landing. Quem chega sem sessão numa rota do `(app)` continua caindo em `/entrar` (já queria o app, não a vitrine).

- **`/`** ([app/page.tsx](app/page.tsx)) — Landing pública: hero, recursos, como funciona e CTA para `/entrar`. A página é Server Component só pra poder exportar `metadata` (título/OG, já que o link circula em WhatsApp e redes); o conteúdo é a ilha cliente [components/landing/Landing.tsx](components/landing/Landing.tsx), que lê `useSessao()` apenas pra trocar o CTA por "Ir para o painel" de quem já está logado. Não usa o `StoreProvider`
- **`/painel`** ([page.tsx](app/(app)/painel/page.tsx)) — Painel: KPIs (inclusive "a receber" e serviços dos próximos 30 dias, de `resumoAgenda`), próximos serviços, gráfico de faturamento (orçado x aprovado, últimos 6 meses, via `recharts`) e tabela de orçamentos "enviados" perto do vencimento
- **`/orcamentos`** — "Montar orçamento" (gerador, ver abaixo) e CRUD completo com itens dinâmicos (com seletor de serviço do catálogo pra autopreencher), desconto em valor/%, acréscimo, moeda por orçamento, PDF (impressão), texto pronto pro WhatsApp (`wa.me`), duplicar
- **`/agenda`** ([page.tsx](app/(app)/agenda/page.tsx)) — agendamentos em abas Agenda/Entregues/Cancelados, busca, números (aguardando, próximos 30 dias, a receber), **Colar orçamento** e detalhe (etapas, data/local, valor combinado, extras, pagamentos, notas). Ver "Agenda e colar orçamento"
- **`/clientes`** — CRUD simples + importar/exportar CSV (`clientesParaCsv`/`csvParaClientes` em helpers.ts — parser próprio, sem dependência)
- **`/servicos`** — catálogo de serviços com preço padrão, reaproveitado no formulário de orçamento
- **`/empresa`** — conta (trocar senha), gestão de empresas (criar/trocar/remover), dados da empresa ativa, logo, cor, moeda, dados bancários/Pix, backup JSON
- **`/novidades`** — changelog mantido manualmente em [lib/changelog.ts](lib/changelog.ts). **Não é automático**: a cada entrega relevante, adicionar uma entrada nova no topo do array `NOVIDADES` com `id` crescente (prefixo de data, ex: `2026-09-09-01`) — o Sidebar mostra um badge com a contagem de entradas mais novas que `state.novidadesVistoId`, zerado ao visitar a página.
- **`/entrar`, `/recuperar-senha`, `/nova-senha`** — fora do route group, telas de autenticação acessíveis sem sessão (junto com a landing em `/`)

## Visual (inspirado no orgfinapp)
Linguagem do [orgfinapp](https://github.com/jesusgomesea/orgfinapp): fundo em tons de zinco, **um** destaque, fonte **Geist** (`@fontsource-variable/geist`), cartões com canto de 24px, campos preenchidos com canto de 16px e botões em pílula. **Escuro é o padrão** (`SCRIPT_TEMA`); o claro continua no botão de tema.

- **O destaque é a cor da empresa.** [CorDaEmpresa](components/layout/CorDaEmpresa.tsx) escreve `--primary` (de `empresa.corPrimaria`) e `--sobre-primary` (preto ou branco, o de maior contraste — `corSobre` em [lib/cor.ts](lib/cor.ts), testado) no `<html>`. Os tons derivados (`--primary-tint`, `--primary-dark`…) saem por `color-mix` em [globals.css](app/globals.css), então qualquer cor funciona. Fora do app (landing, entrar) vale a cor da marca, `#c6f432`.
- **Destaque como texto usa `text-primary-texto`**, nunca `text-primary`: no claro é puxado para o escuro e no escuro para o claro, senão uma cor clara some no fundo branco (e um azul-marinho some no preto). Em cima do destaque, `text-sobre-primary`.
- Tokens: `bg-bg`, `bg-surface` (cartão), `bg-surface-2` (campo, botão secundário), `text-text`, `text-text-muted`, `--radius-cartao`/`--radius-campo`. Componente novo usa os tokens e os primitivos de `components/ui`.
- **Campos com fonte de 16px no celular** (`sm:` volta a 14px): abaixo disso o iPhone dá zoom sozinho ao tocar no campo. Botões e campos com 44px de altura de toque no celular.
- **Marca**: [components/marca/Marca.tsx](components/marca/Marca.tsx) (símbolo SVG inline, segue a cor de destaque) e [public/favicon.svg](public/favicon.svg) (cor da marca fixa).

## Layout no celular
- **Navegação** ([Sidebar](components/layout/Sidebar.tsx)): no desktop (md+), coluna lateral com o botão "Montar orçamento"; no celular, topo leve (marca, empresa, tema) e **barra de abas flutuante em pílula**: Painel, Orçamentos, **+** (montar orçamento), Agenda e "Mais" (Clientes, Serviços, Empresa, Novidades, Sair). O "+" leva a `/orcamentos?montar=1`; já na página de orçamentos ele não navega e dispara o evento `EVENTO_MONTAR`, que a página escuta. O `<main>` tem `pb-32` no celular para a barra não cobrir o fim da página, e os toasts sobem com `mobileOffset`.
- **Listas**: tabela só onde cabe — orçamentos em cartões até `xl` (a linha tem 8 ações); clientes, serviços e as tabelas do painel em cartões abaixo de `md`. As ações de um orçamento são uma função só (`acoes`) usada no cartão e na tabela.
- **Diálogos** ([dialog.tsx](components/ui/dialog.tsx)): no celular ocupam a largura menos 0,75rem de cada lado, altura em `dvh` (desconta a barra do navegador) e `p-4`.

## Tema claro/escuro
A classe `.dark` no `<html>` é escrita por `SCRIPT_TEMA` ([lib/tema.ts](lib/tema.ts)), inline no `<head>` do layout raiz, **antes da primeira pintura** — sem isso a página pisca clara para quem escolheu escuro. Por isso `tema.ts` não importa React: o layout raiz é Server Component.

O React só espelha esse estado, via `useSyncExternalStore` em [lib/useTema.ts](lib/useTema.ts) — no servidor não há como saber o que o script decidiu, e chutar causaria erro de hidratação. A paleta de cada tema é um bloco de variáveis CSS em [app/globals.css](app/globals.css); componente novo usa os tokens (`bg-surface`, `text-text-muted`…), nunca cor fixa.

## Geração de PDF
Não usa lib de PDF (jsPDF/html2canvas) — usa `window.print()` sobre um container escondido (`#orcamento-print` no layout de `(app)`) com CSS `@media print` em [globals.css](app/globals.css) que esconde o resto da página. O HTML do orçamento é montado inline (estilos inline com cores claras fixas, não Tailwind) em `gerarOrcamentoHtml` em [lib/orcamento.ts](lib/orcamento.ts) (junto de `gerarTextoWhatsapp`, ambas com teste em `lib/orcamento.test.ts`), porque esse HTML vira o documento impresso/PDF: precisa ser autocontido e não pode herdar o tema escuro da tela. Ao mudar o layout do orçamento impresso, editar essa função — não o JSX da página.

**Todo valor de dado interpolado ali passa por `escapeHtml()`, e a logo por `logoSegura()`** (ambos em [helpers.ts](lib/helpers.ts)). Isso vira `innerHTML`: sem escape, uma descrição com `<` some do PDF e um nome de cliente vindo de CSV de terceiro (`<img src=x onerror=...>`) roda script na sessão de quem importou, com acesso à `/api/dados`. Campo novo no documento impresso entra escapado.

## Contratos e recibos (.docx → PDF)
Gera o contrato de prestação de serviços fotográficos e o recibo de pagamento a partir dos modelos em [templates/](templates/) (EJ Fotografia). Liga por empresa em Empresa → "Contratos e recibos" (`empresa.prestador.habilitado`); desligado, nenhuma tela mostra nada de contratos.

- **O texto jurídico mora só nos modelos.** Não copiar cláusulas para o código nem editar o texto dos .docx por aqui. Mudou o contrato: trocar o arquivo em `templates/` e atualizar a "versão do modelo" na tela do prestador. Os marcadores são `{{campo}}`, cada um inteiro num único `<w:t>`; o dicionário de campos sai de [lib/documentos/campos.ts](lib/documentos/campos.ts).
- **Anexo I nunca é pré-preenchido**: o modelo só tem nome, CPF e data do serviço como marcadores; as caixas ☐ ficam para o cliente (há teste cobrindo).
- **O que o contrato exige** ([lib/documentos/campos.ts](lib/documentos/campos.ts)): do cliente e do serviço, **só serviço, CPF e e-mail do cliente** (decisão do dono do produto). **CPF basta ter 11 números** (`cpfAceito` em [lib/documentos/formatos.ts](lib/documentos/formatos.ts)): a conferência dos dígitos verificadores só avisa, não bloqueia — um CPF verdadeiro já foi recusado e o dono pediu para liberar. CPF com 9–10 números que confere com zeros à esquerda (perdidos em planilha) é completado; incompleto ou CNPJ continua barrando, com o motivo (`motivoCpfInvalido`). Continuam obrigatórios o status Aprovado, sinal de 40%, moeda em reais e os dados do prestador. O resto em branco sai **"a combinar"** (`A_COMBINAR`; data como "data a combinar", horário "—") e endereço/WhatsApp do cliente como "não informado". **Valor zero é aceito** (só negativo bloqueia) — sinal e restante saem R$ 0,00.
- **Pacote, prazo, tempo e fotos saem dos itens do catálogo** (`servicoContratoDosItens` em [lib/gerador.ts](lib/gerador.ts), testado): serviço = categorias, pacote = os itens, tempo = soma das unidades em hora/dia, fotos = soma das unidades em foto, prazo = prazos dos serviços. `aplicarServicoDosItens` só troca um campo vazio ou ainda igual ao que os itens anteriores davam — o que foi digitado à mão fica. Aplicado no montador, no formulário livre (com contratos habilitados), ao colar `[ref ORC-…]` e, para orçamentos antigos, no servidor ao gerar (só campos vazios).
- **Cliente do contrato** ([ClienteDoContrato](components/documentos/ClienteDoContrato.tsx), no topo do diálogo de contrato): o contrato usa o cadastro ligado ao orçamento (`clienteId`), não "o cliente com esse nome". O montador cria um cadastro novo quando o WhatsApp não bate, então é comum completar o CPF num cadastro repetido e o contrato continuar barrado. O bloco mostra o cadastro ligado e o que falta, edita ali mesmo (o [ClienteForm](components/clientes/ClienteForm.tsx) é o mesmo da tela Clientes), mostra o motivo de um CPF inválido (`motivoCpfInvalido`; `cpfNormalizado` aceita CPF que perdeu os zeros à esquerda numa planilha, se os dígitos conferirem), aponta cadastros parecidos (`clientesParecidos` em [lib/orcamento.ts](lib/orcamento.ts): mesmo nome sem acento/caixa ou mesmo WhatsApp, testado) e troca o cliente do orçamento — junto com o `clienteId` do agendamento. Documentos já gerados mantêm o cliente que tinham.
- **Fluxo**: o navegador chama `garantirSalvo()` do store (fura o debounce) e depois `POST /api/documentos/contrato` ou `/recibo`. O servidor ([lib/server/gerarDocumentos.ts](lib/server/gerarDocumentos.ts)) **lê os dados já gravados**, valida (422 com `faltando: string[]`), faz uma prévia com número provisório, só então reserva o número, preenche com `docxtemplater` ([lib/documentos/preencher.ts](lib/documentos/preencher.ts)), confere que não sobrou `{{` em nenhuma parte do .docx e converte.
- **Armazenamento fora do estado principal** ([lib/server/documentos.ts](lib/server/documentos.ts), store `orcaaqui-documentos`): o navegador regrava o estado inteiro a cada alteração, então qualquer registro do servidor dentro dele seria apagado. Índice e contadores usam gravação condicional do Blobs (`onlyIfMatch`/`onlyIfNew`) em laço de nova tentativa — é o que impede número duplicado com duas gerações simultâneas. Arquivos gravam com `onlyIfNew`: nada é sobrescrito.
- **Numeração**: `NNN/AAAA` por empresa, sequências separadas de contrato e recibo, reinicia no ano (fuso de Teresina, `America/Fortaleza`). Cada geração — inclusive "nova versão" — consome um número novo; número reservado e não usado (falha na conversão) não volta.
- **PDF pelo navegador (padrão, sem custo)** ([lib/documentosImpressao.ts](lib/documentosImpressao.ts)): a Netlify não roda LibreOffice nas Functions, então o servidor guarda o .docx e o navegador o desenha com `docx-preview` dentro do `#orcamento-print` e chama `window.print()` ("Salvar como PDF") — o mesmo caminho do PDF do orçamento. Abre sozinho depois de gerar e pelo botão **PDF** do histórico ([ListaDocumentos](components/documentos/ListaDocumentos.tsx)).
  - O docx-preview não repete cabeçalho/rodapé por página nem calcula `PAGE`/`NUMPAGES`. Por isso ele desenha só o corpo, e margens, cabeçalho (logo + texto + linha) e "Página X de Y" viram uma regra `@page` com caixas de margem, montada **a partir do XML do próprio .docx** ([lib/documentos/paginaDocx.ts](lib/documentos/paginaDocx.ts), testada com os modelos reais). Caixas de margem existem no Chrome/Edge 131+; em Safari/Firefox só cabeçalho e rodapé somem.
  - A regra `@page` é global e **não pode ser limpa no `afterprint`** (no celular ele dispara antes da captura e o PDF sai em branco): quem imprime outra coisa no `#orcamento-print` chama `limparImpressaoDocx()` antes — o `handlePdf` do orçamento já faz isso.
- **PDF via Gotenberg (opcional)** ([lib/server/pdf.ts](lib/server/pdf.ts)): com `GOTENBERG_URL` (e `GOTENBERG_USUARIO`/`GOTENBERG_SENHA` se houver basic auth), o servidor já entrega PDF e o botão PDF do histórico some. A imagem do Gotenberg precisa ter Georgia e Calibri (ou Carlito), senão a paginação muda.
- **LGPD**: CPF nunca em URL nem em nome de arquivo (`Contrato 001-2026 - Ana Souza.pdf`); download só em `GET /api/documentos/arquivo/<id>`, atrás de `getUser()`, com a chave do arquivo sob o id do usuário.
- **Regras puras com teste** em `lib/documentos/` (sinal de 40% arredondado para cima em reais, valor e data por extenso, CPF/telefone, montagem dos campos). Rodar `npm test`.
- Os modelos entram no pacote da função por `outputFileTracingIncludes` em [next.config.ts](next.config.ts).

## Diálogos (Radix)
Os componentes `Dialog`/`DialogContent` em [components/ui/dialog.tsx](components/ui/dialog.tsx) **não têm animação de abrir/fechar de propósito**. Já existiu animação via CSS (`data-state` + `@keyframes`), mas com diálogos aninhados (ex: "+ Novo cliente" dentro do formulário de orçamento) a Presence do Radix não desmontava de forma confiável em StrictMode, deixando o overlay preto travado cobrindo a tela (parecia a página ter travado/ficado em branco). Não reintroduzir animação de fechamento sem testar bem o caso de diálogo aninhado.

## Gerador de orçamento ("Montar orçamento")
O prestador monta pelo catálogo ([components/gerador/MontadorOrcamento.tsx](components/gerador/MontadorOrcamento.tsx), regras em [lib/gerador.ts](lib/gerador.ts), testadas): serviços × quantidade com preço por volume (`precoUnitario`: a partir de `volumeMin`, TODAS as unidades saem por `precoVolume`), faixa de deslocamento (`config.deslocamentos`), desconto e acréscimo em valor. Total, sinal e restante ao vivo. "Enviar pelo WhatsApp" salva com `origem: "gerador"`, `codigoRef: "ORC-0012"` e status **enviado** (o botão de WhatsApp da lista também tira do rascunho).

- **Nunca confiar no total escrito.** A mensagem leva `[ref ORC-0012 e=<config.codigo> v<config.versaoCatalogo> i=<Servico.codigo>:<qtd>,… d=<desconto> a=<acréscimo> ds=<faixa> dt=AAAA-MM-DD hr=HH:MM]` (campos zerados omitidos). Quem cola recalcula pelo catálogo (`recalcularRefOrc`): versão ou empresa diferente vira aviso; serviço que sumiu impede o cálculo. Os rótulos da mensagem (`*Cliente:*`, `*WhatsApp:*`, `*Serviço:*`, `*Data desejada:*`, `*Local:*`, `*Total:*`, `*Observações:*`) são os mesmos do site do EJ. Texto livre passa por `limparLivre` (uma linha, sem `[`, `]`, `*`).
- Orçamento feito pela tabela do EJ grava a linha inteira em `Orcamento.refEj`; `decodificarRefEj` (o inverso de `codificarRefEj`) reabre o montador com a mesma escolha. Colar uma mensagem do EJ também grava `refEj`.
- Os itens gravados levam `servicoId` (e `deslocamentoId` no item de deslocamento, marcado como adicional para o contrato). `selecaoDoOrcamento` reabre no montador; com item livre, só o formulário livre edita. Reenviar usa os preços **gravados** (`calculoDoOrcamento`), não os de hoje.
- O número `ORC-…` é previsto como `empresaAtiva.proximoNumero` no clique — o mesmo que o `addOrcamento` atribui.

**Tabela do EJ** ([lib/ej.ts](lib/ej.ts), [components/gerador/MontadorEj.tsx](components/gerador/MontadorEj.tsx)): com `config.urlTabelaEj` (sugestão `https://ejfotografia.netlify.app`, nunca fixo no código), o montador ganha a aba "Tabela do EJ". Os pacotes vêm de `GET <url>/api/catalogo` e o cálculo de `GET <url>/api/recalcular?ref=…`, chamados direto do navegador (as rotas são públicas, com CORS liberado). **Preço e regra do EJ ficam só lá**; aqui existe apenas o formato da linha `[ref EJ-…]` (`codificarRefEj`, o contrato entre os dois sistemas, ver MANUTENCAO §3 do EJ). **Só a linha `[ref]` é enviada** — `extrairRefEj` garante que nome, telefone e local nunca vão para o EJ. Itens "a combinar" entram com valor zero.

## Agenda e colar orçamento
Fluxo: o prestador envia pelo gerador → o cliente aprova → o prestador **cola a mensagem** (Agenda → "Colar orçamento") ou clica **"Cliente aprovou → agendar"** na lista de orçamentos → orçamento **aprovado** + **agendamento**.

- **Colar** ([lib/colar.ts](lib/colar.ts), testado; tela em [components/agenda/ColarOrcamento.tsx](components/agenda/ColarOrcamento.tsx)): `tipoDeRef` decide pela última `[ref]`. `[ref ORC-…]` → `lerColagemOrc` recalcula pelo catálogo; `[ref EJ-…]` → `lerColagemEj` recalcula por `GET /api/recalcular` do EJ (a função recebe o recálculo injetado — os testes rodam sem rede e conferem que só a linha `[ref]` sai). Nome, WhatsApp, local e observações vêm das linhas com rótulo (`campo()`, com ou sem asteriscos); data e horário da `[ref]`, com a linha legível como plano B. **Total editado e tabela antiga são aviso; mínimo não atingido é pendência — nada disso bloqueia.**
- **`aprovarLeitura`** (pura, devolve a empresa nova): cliente com dedupe por telefone (`acharClientePorTelefone`, ignora máscara e o 55), orçamento de mesmo código atualizado (`ORC-0012` casa pelo número; `EJ-…` pelo `codigoRef`) ou criado com o próximo número, e **um** agendamento por orçamento (colar de novo não duplica). `agendarOrcamento` é o atalho de 1 clique. No store, `aprovarColagem`/`agendarOrcamento` calculam sobre a empresa ativa do momento e gravam de uma vez (quem chama precisa dos ids na hora).
- **Detalhe** ([components/agenda/DetalheAgendamento.tsx](components/agenda/DetalheAgendamento.tsx)): data/horário/local editam o `servicoContrato` do orçamento; pagamentos editam `Orcamento.pagamentos` (o primeiro sugere o sinal; registrar o sinal avança para "Sinal pago" se a etapa existir); `outro` exige descrição. Excluir o agendamento não apaga o orçamento.
- **Números** (`resumoAgenda` em [lib/agenda.ts](lib/agenda.ts)): "a receber" segue o painel do EJ — só o que já passou da primeira etapa e só na moeda da empresa.
- Botão "Colar" do navegador: celulares costumam negar `navigator.clipboard.readText()`; o erro vira aviso para colar à mão, nunca silêncio.

## Parcerias
Uma parceria é um **orçamento com `parceria`** ([lib/parceria.ts](lib/parceria.ts), testado): o que você entrega continua nos itens (e fotos/prazo em `servicoContrato`); o parceiro "paga" com **contrapartidas** — divulgação, permuta (com valor estimado), indicação de clientes ou outra — cada uma com quantidade e prazo. A parte em dinheiro é o total do orçamento: o "desconto de parceria" é o desconto do próprio orçamento (100% = sem dinheiro). Por isso sinal, pagamentos, "a receber" e recibos funcionam sem mudança.

- Liga em "É uma parceria" no formulário livre e no montador ([EditorParceria](components/parceria/EditorParceria.tsx)). PDF e WhatsApp viram "Proposta de parceria", com o bloco `textoParceria`/`blocoParceriaHtml` (texto livre limpo de `[`, `]`, `*` e escapado no HTML). No gerador, o bloco vai antes do total; a `[ref]` não muda (contrapartida não entra no recálculo, e colar de volta preserva a parceria gravada).
- **Acompanhamento** na Agenda ([AcompanharParceria](components/parceria/AcompanharParceria.tsx)): cada vez que o parceiro cumpre um pedaço (um post, uma indicação) vira um `registro` (data + link/nome); cumprida quando os registros chegam à `quantidade` (`progresso`). Pendente com prazo vencido aparece como atrasada.
- `normalizarParceria` (via `mergeEmpresa`) limpa o que vier de backup; parceria inválida vira orçamento comum.
- O contrato .docx é de prestação de serviço: parceria sem valor em dinheiro gera contrato com R$ 0,00 (as contrapartidas não entram nele). Contrato próprio de parceria continua fora do sistema.

## Netlify Blobs: armadilhas (já derrubaram o painel do EJ)
Todo acesso ao Blobs passa por `storeBlobs()` em [lib/server/blobs.ts](lib/server/blobs.ts) — **nunca chamar `getStore` direto**. Ele entrega ao Blobs um `fetch` próprio que resolve três problemas:

- **`res.body.cancel()` nunca termina no Netlify.** O Blobs descarta assim o corpo das respostas que não lê: 404 (chave ainda não existe — o primeiro acesso de um usuário novo), 412 (gravação condicional recusada — a numeração de contratos/recibos depende disso) e toda gravação. A função ficava presa até ser cortada (502). `semCorpoSeDescartavel()` ([lib/server/blobsFetch.ts](lib/server/blobsFetch.ts), testada) devolve essas respostas sem corpo; só GET 200 mantém o corpo.
- **`fetch` do Next ≠ `fetch` do Node.** Usa `globalThis.fetch._nextOriginalFetch ?? globalThis.fetch`, resolvido a cada chamada; com a camada de cache do Next a leitura travava.
- **Repetições silenciosas.** O Blobs repete chamadas com erro (5xx, 429, rede) esperando segundos entre tentativas. Cada etapa de rede das rotas passa por `comLimite()` (3 s; login do Identity incluído), e a falha vira 500 com a etapa que travou e a última resposta do Blobs (`respostaDeFalha`). A tela de carregamento mostra esse detalhe.
- A conversão de PDF tem limite de 6 s: somada às etapas, a resposta precisa sair antes do corte de ~10 s da função.

## Deploy (Netlify)
[netlify.toml](netlify.toml) usa o `@netlify/plugin-nextjs`, que transforma as rotas de servidor em Netlify Functions v2 — formato exigido pelo Identity. Nenhuma variável de ambiente é obrigatória. Opcional: `GOTENBERG_URL` (e `GOTENBERG_USUARIO`/`GOTENBERG_SENHA`), para converter contrato e recibo em PDF no servidor — sem ela o PDF sai pelo navegador, ver "Contratos e recibos".

**O Netlify roda `npm install` puro.** Um conflito de peer dependency derruba o deploy mesmo com o `package-lock.json` commitado; resolver localmente com `--legacy-peer-deps` só esconde o problema e o site fica num build antigo sem ninguém notar. Se `npm install` não passa limpo, não vai ao ar.

No painel, é preciso ter **Identity habilitado** e decidir `Registration preferences` (`Open` / `Invite only`) e o `autoconfirm`. Os modelos de e-mail chegam em inglês por padrão — traduzir. Para conferir o estado sem abrir o painel: `https://SEU-SITE.netlify.app/.netlify/identity/settings` (404 = Identity desligado).

## CI
[.github/workflows/checks.yml](.github/workflows/checks.yml) roda `npm ci`, `typecheck`, `lint`, `test` e `build` em todo push e PR. O `npm ci` é de propósito: falha quando o `package-lock.json` está fora de sincronia com o `package.json` — exatamente o que derruba o build da Netlify e deixa o site num build antigo sem aviso. Preferir abrir PR e esperar o verde a empurrar direto em `main`, já que push em `main` publica em produção.

## Convenções
- Nomes de campos/variáveis em português, comentários em português quando necessário
- TypeScript em todo o projeto; `npm run typecheck` antes de dar por pronto
- Componentes de UI em `components/ui/*` são genéricos (não sabem nada de orçamento/cliente); lógica de domínio fica nas páginas
- Páginas e componentes com estado levam `"use client"`; o que roda no servidor fica em `lib/server/*` (com `import "server-only"`)
- `cn()` ([lib/utils.ts](lib/utils.ts)) para merge de classes Tailwind — sempre usar em vez de concatenar strings de classe
