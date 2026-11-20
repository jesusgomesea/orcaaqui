# Liquid Glass — o que falta (19/11/2026)

A branch `feature/liquid-glass` tem uma **primeira versão rápida**, feita para testar o visual. Esta lista é o que falta para fechar a aplicação seguindo a skill `liquid-glass` (vidro é moldura, contraste primeiro, refração só no cromo) e o design atual do projeto (CLAUDE.md → "Visual").

## O que já está feito
- Tokens `--vidro`, `--vidro-forte`, `--vidro-borda`, `--vidro-rim1/2`, `--vidro-sombra`, `--cena-opacidade` no claro (`:root`) e no escuro (`.dark`) em [app/globals.css](../app/globals.css).
- Classes `.vidro` (cartões), `.vidro-forte` (navegação, diálogos) com borda especular (`::before` + máscara) e `.vidro-refracao` (só com `html.refract`), em `@layer components`.
- Fundo vivo + filtro `#lg-refract` em [components/layout/CenaVidro.tsx](../components/layout/CenaVidro.tsx), montado no layout raiz; cores da cena saem de `--primary` (cor da empresa) e de dois tons vizinhos via `oklch(from …)`.
- `SCRIPT_REFRACAO` inline no `<head>` liga a refração só em Chromium.
- Aplicado em: `Card`, `DialogContent`, barra lateral (agora flutuante, com margem de 14px), topo e barra de abas do celular, menu "Mais", botão principal em "gel".
- Removido o `bg-bg` sólido do layout do app, da moldura de autenticação e da raiz da landing.
- Fallback `prefers-reduced-transparency` (fundo sólido, sem cena) e `prefers-reduced-motion` (já global).

## Falta fazer
1. **Organizar o CSS**: mover tokens/classes do vidro para um arquivo próprio (ex.: `app/vidro.css`) importado no `globals.css`, e registrar os tokens no `@theme inline` (ex.: `bg-vidro`) se fizer sentido.
2. **Itens de navegação ativos** na barra lateral e no menu "Mais" ainda usam `bg-surface`/`bg-surface-2` sólidos — trocar por um realce de vidro (`--vidro-forte` + linha de luz + anel na cor da empresa, como o `.lg-seg [aria-current]` da skill).
3. **Tabs** ([components/ui/tabs.tsx](../components/ui/tabs.tsx)): virar controle segmentado em cápsula (vidro leve, aba ativa em vidro forte).
4. **Campos e selects**: `--surface-2` ainda é opaco. Avaliar torná-lo translúcido (sem blur, para não aninhar vidro) dentro dos cartões, conferindo contraste no claro. `SelectContent` continua sólido de propósito (popover precisa ser legível).
5. **Botões secundário/ghost** em vidro leve; `danger` revisar.
6. **Landing** ([components/landing/Landing.tsx](../components/landing/Landing.tsx)): seções e cartões ainda em `bg-surface`/`bg-bg` sólidos e o header com `backdrop-blur` próprio — passar para `.vidro`/`.vidro-forte`; considerar um card "hero" com brilho radial na cor de acento.
7. **Blocos `bg-bg` dentro dos montadores** (`MontadorOrcamento`, `MontadorEj`, logo em `empresa/page.tsx`): ficam "buracos" escuros sobre o vidro — trocar por fundo translúcido.
8. **Contraste**: medir texto principal e `text-text-muted` sobre vidro no claro e no escuro (mín. 4.5:1), com cores de empresa claras (ex.: amarelo) e escuras (azul-marinho) — a cena muda com a cor da empresa.
9. **Performance**: listas longas (orçamentos, clientes, agenda) têm muitos `Card` com `backdrop-filter`. Avaliar uma variante sem blur para cartões repetidos.
10. **Testar** em escuro e claro, 1280px e 390px, com `netlify dev` e login: tab bar não cobre conteúdo, nada transborda, impressão do PDF continua igual (a cena tem que sumir no print).
11. **Docs**: atualizar a seção "Visual" do CLAUDE.md com a hierarquia de vidro e as regras (refração só em 2–4 elementos, botão principal é gel, nada de vidro sobre vidro em lista); entrada no changelog quando fechar.
