# Orça Aqui — CLAUDE.md

## O que é
Site de geração de orçamentos. Sem login, sem backend. Cada usuário usa no próprio navegador; suporta múltiplas empresas no mesmo navegador, cada uma com seus próprios dados. Tudo em `localStorage`. Hospedado na Netlify como build estático.

## Objetivo
Deixar qualquer prestador de serviço montar um orçamento com a cara da própria empresa (logo, cor, dados) e enviar pro cliente (PDF via impressão do navegador ou texto pronto pro WhatsApp) — sem precisar de conta, mensalidade ou servidor.

## Stack
- React 19 + Vite + Tailwind v4 (`@tailwindcss/vite`)
- Radix UI primitives (dialog, select, tabs, label) + `class-variance-authority` + `lucide-react`
- `sonner` para toasts, `recharts` pro gráfico de faturamento
- `oxlint` para lint (`npm run lint`)
- Sem roteador — navegação é troca de estado local (`active`) em [src/App.jsx](src/App.jsx), igual ao padrão usado em `../gestion-app`

## Persistência e modelo multiempresa
Tudo em um único objeto de estado, salvo em `localStorage["orcaaqui-dados-v1"]`, gerenciado por [src/lib/store.jsx](src/lib/store.jsx) (Context API, sem Redux — não precisa pra este tamanho de app).

Forma dos dados (v2, multiempresa):
```js
{
  empresaAtivaId: "uuid",
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
  novidadesVistoId: "id da última entrada do changelog já vista",
}
```

Cada empresa é totalmente isolada (clientes/orçamentos/serviços próprios) — pense nela como um "workspace". A empresa ativa é acessada via `useStore().empresaAtiva` (não `state.empresas[0]` — sempre resolver pelo `empresaAtivaId`). Toda mutação de cliente/orçamento/serviço no store (`addCliente`, `addOrcamento`, etc.) escreve na empresa ativa, nunca precisa de `empresaId` como argumento.

**Migração v1→v2**: versões antigas salvavam um único `{ empresa, clientes, orcamentos }` no topo do state (sem suporte a múltiplas empresas). `migrarSeNecessario()` em `store.jsx` detecta esse formato antigo na carga e embrulha automaticamente em `empresas: [...]`, preservando tudo. Ao mexer no formato de dados de novo, manter esse caminho de migração — é o que evita perda de dados de quem já estava usando.

Status **expirado** não é gravado — é calculado na hora (`statusEfetivo` em [src/lib/helpers.js](src/lib/helpers.js)) comparando a validade com a data de hoje.

A logo é salva como `data:` URL (base64) direto no state; upload em [ConfigPage](src/pages/ConfigPage.jsx) rejeita arquivos acima de 1.5MB.

Backup/portabilidade: exportar/importar o JSON inteiro do state (botões em Empresa) — inclui todas as empresas. É a única forma de levar dados entre computadores/navegadores.

## Moeda
Cada empresa tem uma `moeda` padrão (ver `MOEDAS` em [helpers.js](src/lib/helpers.js)); cada orçamento pode sobrescrever a própria moeda (útil pra cliente de fora). `formatMoney(v, moeda)` sempre recebe a moeda explicitamente — nunca assumir BRL fixo num componente novo.

## Páginas
- **Painel** ([PainelPage](src/pages/PainelPage.jsx)) — KPIs, gráfico de faturamento (orçado x aprovado, últimos 6 meses, via `recharts`) e tabela de orçamentos "enviados" perto do vencimento
- **Orçamentos** ([OrcamentosPage](src/pages/OrcamentosPage.jsx)) — CRUD completo com itens dinâmicos (com seletor de serviço do catálogo pra autopreencher), desconto em valor/%, acréscimo, moeda por orçamento, PDF (impressão) e texto pronto pro WhatsApp (`wa.me`), duplicar orçamento
- **Clientes** ([ClientesPage](src/pages/ClientesPage.jsx)) — CRUD simples + importar/exportar CSV (`clientesParaCsv`/`csvParaClientes` em helpers.js — parser próprio, sem dependência)
- **Serviços** ([ServicosPage](src/pages/ServicosPage.jsx)) — catálogo de serviços com preço padrão, reaproveitado no formulário de orçamento
- **Empresa** ([ConfigPage](src/pages/ConfigPage.jsx)) — gestão de empresas (criar/trocar/remover), dados da empresa ativa, logo, cor, moeda, dados bancários/Pix, backup JSON
- **Novidades** ([NovidadesPage](src/pages/NovidadesPage.jsx)) — changelog mantido manualmente em [src/lib/changelog.js](src/lib/changelog.js). **Não é automático**: a cada entrega relevante, adicionar uma entrada nova no topo do array `NOVIDADES` com `id` crescente (prefixo de data, ex: `2026-08-20-01`) — o Sidebar mostra um badge com a contagem de entradas mais novas que `state.novidadesVistoId`, zerado ao visitar a página.

## Geração de PDF
Não usa lib de PDF (jsPDF/html2canvas) — usa `window.print()` sobre um container escondido (`#orcamento-print` em [App.jsx](src/App.jsx)) com CSS `@media print` em [index.css](src/index.css) que esconde o resto da página. O HTML do orçamento é montado inline (estilos inline, não Tailwind) em `gerarOrcamentoHtml` dentro de `OrcamentosPage.jsx`, porque esse HTML vira o documento impresso/PDF e precisa ser autocontido. Ao mudar o layout do orçamento impresso, editar essa função — não o JSX da página.

## Diálogos (Radix)
Os componentes `Dialog`/`DialogContent` em [src/components/ui/dialog.jsx](src/components/ui/dialog.jsx) **não têm animação de abrir/fechar de propósito**. Já existiu animação via CSS (`data-state` + `@keyframes`), mas com diálogos aninhados (ex: "+ Novo cliente" dentro do formulário de orçamento) a Presence do Radix não desmontava de forma confiável em StrictMode, deixando o overlay preto travado cobrindo a tela (parecia a página ter travado/ficado em branco). Não reintroduzir animação de fechamento sem testar bem o caso de diálogo aninhado.

## Build (file:// e Netlify)
[vite.config.js](vite.config.js) gera o build como script clássico IIFE (não ES module) com caminhos relativos (`base: './'`), via o plugin local `classic-script-html`. Isso faz o `dist/index.html` funcionar tanto abrindo o arquivo direto do disco (duplo-clique, sem servidor) quanto hospedado na Netlify. Não trocar para o padrão ES module do Vite sem motivo forte — é o que evita a tela em branco ao abrir `dist/index.html` localmente.

## Deploy (Netlify)
Sem variáveis de ambiente, sem backend. [netlify.toml](netlify.toml) já define build (`npm run build` → `dist`) e o redirect SPA (`/* → /index.html`).

## Convenções
- Nomes de campos/variáveis em português (mesmo padrão do `../gestion-app`), comentários em português quando necessário
- Sem TypeScript — JS puro com Vite
- Componentes de UI em `src/components/ui/*` são genéricos (não sabem nada de orçamento/cliente); lógica de domínio fica nas páginas
- `cn()` ([src/lib/utils.js](src/lib/utils.js)) para merge de classes Tailwind — sempre usar em vez de concatenar strings de classe
