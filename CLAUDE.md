# Orça Aqui — CLAUDE.md

## O que é
Site de geração de orçamentos. Sem login, sem backend. Cada usuário usa no próprio navegador; todos os dados (empresa, clientes, orçamentos, logo) ficam em `localStorage`. Hospedado na Netlify como build estático.

## Objetivo
Deixar qualquer prestador de serviço montar um orçamento com a cara da própria empresa (logo, cor, dados) e enviar pro cliente (PDF via impressão do navegador ou texto pronto pro WhatsApp) — sem precisar de conta, mensalidade ou servidor.

## Stack
- React 19 + Vite + Tailwind v4 (`@tailwindcss/vite`)
- Radix UI primitives (dialog, select, tabs, label) + `class-variance-authority` + `lucide-react`
- `sonner` para toasts
- `oxlint` para lint (`npm run lint`)
- Sem roteador — navegação é troca de estado local (`active`) em [src/App.jsx](src/App.jsx), igual ao padrão usado em `../gestion-app`

## Persistência
Tudo em um único objeto de estado, salvo em `localStorage["orcaaqui-dados-v1"]`, gerenciado por [src/lib/store.jsx](src/lib/store.jsx) (Context API, sem Redux — não precisa pra este tamanho de app).

Forma dos dados:
```js
{
  empresa: { nome, documento, telefone, email, site, endereco, logoDataUrl, corPrimaria, dadosBancarios, condicoesPadrao },
  clientes: [{ id, nome, documento, telefone, email, endereco, observacoes }],
  orcamentos: [{
    id, criadoEm, clienteId, data, validadeDias,
    itens: [{ id, descricao, quantidade, valorUnitario }],
    desconto, descontoTipo /* "valor" | "percentual" */, acrescimo,
    condicoes, observacoes,
    status /* rascunho | enviado | aprovado | recusado */,
  }],
}
```
Status **expirado** não é gravado — é calculado na hora (`statusEfetivo` em [src/lib/helpers.js](src/lib/helpers.js)) comparando a validade com a data de hoje, pra não precisar de um job/cron pra atualizar status.

A logo é salva como `data:` URL (base64) direto no state — funciona porque `localStorage` aguenta alguns MB; por isso o upload em [ConfigPage](src/pages/ConfigPage.jsx) rejeita arquivos acima de 1.5MB.

Backup/portabilidade: exportar/importar o JSON inteiro do state (botões em Config) — é a única forma de levar dados entre computadores/navegadores, já que não há conta nem sync.

## Páginas
- **Painel** ([PainelPage](src/pages/PainelPage.jsx)) — KPIs (orçado no mês, ativos, taxa de aprovação, total) + tabela de orçamentos "enviados" perto do vencimento
- **Orçamentos** ([OrcamentosPage](src/pages/OrcamentosPage.jsx)) — CRUD completo com itens dinâmicos, desconto em R$/%, acréscimo, geração de PDF (impressão) e texto pronto pro WhatsApp (`wa.me`), duplicar orçamento
- **Clientes** ([ClientesPage](src/pages/ClientesPage.jsx)) — CRUD simples, reutilizado no formulário de orçamento (inclusive criar cliente novo sem sair do modal)
- **Empresa** ([ConfigPage](src/pages/ConfigPage.jsx)) — dados da empresa, logo, cor de destaque, dados bancários/Pix, condições padrão, backup JSON

## Geração de PDF
Não usa lib de PDF (jsPDF/html2canvas) — usa `window.print()` sobre um container escondido (`#orcamento-print` em [App.jsx](src/App.jsx)) com CSS `@media print` em [index.css](src/index.css) que esconde o resto da página. O HTML do orçamento é montado inline (estilos inline, não Tailwind) em `gerarOrcamentoHtml` dentro de `OrcamentosPage.jsx`, porque esse HTML vira o documento impresso/PDF e precisa ser autocontido. Ao mudar o layout do orçamento impresso, editar essa função — não o JSX da página.

## Deploy (Netlify)
Sem variáveis de ambiente, sem backend. [netlify.toml](netlify.toml) já define build (`npm run build` → `dist`) e o redirect SPA (`/* → /index.html`) — necessário mesmo sem router hoje, para não quebrar se um deep link ou refresh vier a ser usado no futuro.

## Convenções
- Nomes de campos/variáveis em português (mesmo padrão do `../gestion-app`), comentários em português quando necessário
- Sem TypeScript — JS puro com Vite
- Componentes de UI em `src/components/ui/*` são genéricos (não sabem nada de orçamento/cliente); lógica de domínio fica nas páginas
- `cn()` ([src/lib/utils.js](src/lib/utils.js)) para merge de classes Tailwind — sempre usar em vez de concatenar strings de classe
