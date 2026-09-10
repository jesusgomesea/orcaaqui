# Orça Aqui

Gerador de orçamentos com conta própria. Você entra com e-mail e senha, e seus dados ficam guardados na sua conta — dá pra acessar do computador, do celular ou de outro lugar e encontrar tudo igual.

## Funcionalidades

- Landing pública apresentando o sistema; o app fica atrás do login
- Conta com e-mail e senha (Netlify Identity), com confirmação de e-mail e recuperação de senha
- Dados salvos automaticamente na sua conta, acessíveis de qualquer dispositivo
- Múltiplas empresas na mesma conta, cada uma com seus próprios clientes/orçamentos/serviços
- Catálogo de serviços com preço padrão, reaproveitável ao montar orçamentos
- Suporte a múltiplas moedas (padrão por empresa, ajustável por orçamento)
- Gráfico de faturamento (orçado x aprovado) no Painel
- Importar/exportar clientes em CSV
- PDF via impressão do navegador (com logo e cor da empresa) e envio por WhatsApp
- Tema claro e escuro
- Página de Novidades com o histórico de atualizações

## Rodar localmente

O login depende do runtime da Netlify, então o desenvolvimento usa `netlify dev` — com `next dev` puro não existe endpoint de Identity e nada de autenticação funciona.

```bash
npm install
npm install -g netlify-cli   # se ainda não tiver
npx netlify link             # uma vez, pra apontar pro projeto na Netlify
npm run dev
```

Para mexer só em layout/CSS, sem tocar em autenticação, `npm run dev:next` serve.

## Build de produção

```bash
npm run build
```

## Deploy na Netlify

1. Suba este repositório num Git (GitHub/GitLab/Bitbucket)
2. Na Netlify: **Add new site → Import an existing project** (o [netlify.toml](netlify.toml) já traz build e o runtime do Next)
3. Aba **Identity → Enable Identity**
4. **Identity → Registration → Registration preferences**: `Open` (qualquer visitante cria conta) ou `Invite only`
5. **Identity → Emails**: traduza os modelos de confirmação e recuperação, que chegam em inglês
6. Pronto — a cada push, a Netlify builda e publica automaticamente

Não precisa de variáveis de ambiente. Para conferir se o Identity está no ar: `https://SEU-SITE.netlify.app/.netlify/identity/settings` (404 significa que ainda não foi habilitado).

## Vindo da versão sem login?

Os dados que estavam no seu navegador sobem sozinhos para a conta no primeiro login, desde que você entre no mesmo navegador onde usava o Orça Aqui antes.

## Backup dos dados

Os botões **Exportar/Importar backup** na página "Empresa" geram um JSON com tudo. Útil para guardar uma cópia fora do serviço ou levar seus dados para outra conta.

Veja [CLAUDE.md](CLAUDE.md) para detalhes de arquitetura e [NETLIFY-IDENTITY.md](NETLIFY-IDENTITY.md) para o guia de autenticação que embasou a migração.
