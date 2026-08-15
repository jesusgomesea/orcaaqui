# Orça Aqui

Gerador de orçamentos sem login. Dados da empresa, clientes e orçamentos ficam salvos só no seu navegador (`localStorage`). Sem servidor, sem mensalidade.

## Rodar localmente

```bash
npm install
npm run dev
```

## Build de produção

```bash
npm run build
```

Gera a pasta `dist/`, pronta pra subir em qualquer hospedagem estática.

## Deploy na Netlify

1. Suba este repositório num Git (GitHub/GitLab/Bitbucket)
2. Na Netlify: **Add new site → Import an existing project**
3. Build command: `npm run build` · Publish directory: `dist` (a Netlify detecta isso sozinha pelo [netlify.toml](netlify.toml))
4. Pronto — a cada push, a Netlify builda e publica automaticamente

Não precisa de variáveis de ambiente nem de nenhum serviço externo.

## Backup dos dados

Como tudo fica no `localStorage` do navegador, use os botões **Exportar/Importar backup** na página "Empresa" para:
- Fazer backup regularmente
- Levar seus dados para outro computador/navegador

Veja [CLAUDE.md](CLAUDE.md) para detalhes de arquitetura.
