# Login com Netlify Identity — guia de aplicação

> Escrito a partir da migração feita no `my-biblia` (PR #1, 2026-09-09), que
> substituiu Auth.js v5 + Credentials + bcrypt por Netlify Identity. Tudo que
> está aqui foi exercitado em Deploy Preview e em produção.
>
> **Alvo deste guia:** Next.js 16 (App Router) hospedado no Netlify. As seções
> marcadas com *(específico do Next)* são as que mudam em outro framework; o
> resto vale para qualquer um.

## Antes de tudo: isto serve para o seu projeto?

Três pré-requisitos que não têm contorno:

1. **O projeto tem que estar hospedado no Netlify.** O endpoint de auth
   (`/.netlify/identity`) vem do runtime deles. Não dá para usar Identity num
   projeto na Vercel, em VPS ou em container.
2. **As rotas de servidor têm que rodar como Netlify Functions modernas** (v2,
   com `export default`). As funções antigas, no formato Lambda
   (`export { handler }`), não são suportadas. Rotas de Next servidas pelo
   adaptador OpenNext se encaixam — verificado.
3. **Desenvolvimento local exige `netlify dev`.** Com `next dev` puro não
   existe endpoint de Identity: `getUser()` devolve `null` e as mutações
   lançam `MissingIdentityError`.

Se algum desses não vale, pare aqui — o caminho é outro provedor (Auth0,
Clerk, Supabase, Auth.js com adapter próprio).

## O que você ganha, e o que isso substitui

O Identity entrega prontos três itens que costumam virar dívida:

| Recurso | Sem Identity | Com Identity |
|---|---|---|
| Recuperação de senha | Serviço de email (Resend/SendGrid) + tokens próprios | Nativo |
| Confirmação de email | Idem | Nativo, com um checkbox no painel |
| Administração de usuários | Você escreve a tela | Lista no painel do Netlify |
| Guarda das senhas | Você escolhe o hash e o custo | Deles |
| Rate limit do cadastro | Regra sua | Deles |

Custo: você fica preso ao Netlify, e a customização do fluxo é limitada ao que
o painel oferece.

## Passo 1 — Ligar no painel

1. No projeto, aba **Identity** → **Enable Identity**.
2. **Identity → Registration → Registration preferences → Configure**
   - `Open` — qualquer visitante cria conta.
   - `Invite only` — só quem for convidado. Bom para validar antes de abrir.
3. **Identity → Emails → Confirmation template → Configure**
   - Existe uma caixa para *permitir cadastro sem verificar o email*. Marcada,
     o cadastro já entra logado (`autoconfirm: true`). Desmarcada, que é o
     padrão, o usuário recebe um link e **só entra depois de clicar**.
   - **Traduza os modelos.** Confirmação e recuperação chegam em inglês.

Para conferir o estado sem abrir o painel, abra no navegador ou via `curl`:

```
https://SEU-SITE.netlify.app/.netlify/identity/settings
```

Responde algo como:

```json
{"external":{...,"email":true},"disable_signup":false,"autoconfirm":false}
```

`404` aqui significa que o Identity não está ligado.

## Passo 2 — Instalar

```bash
npm install @netlify/identity
```

Use **`@netlify/identity`**, que é headless (sem UI). Existem dois pacotes
antigos que aparecem em tutoriais e estão desaconselhados para projeto novo:
`netlify-identity-widget` (modal pronto) e `gotrue-js` (cliente HTTP de baixo
nível, só browser).

Sem peer dependencies, sem `init()`, sem classe: importa a função e chama.

## Passo 3 — A divisão que importa

Esta é a decisão central, e é o padrão recomendado para frameworks com SSR:

- **Mutações no navegador:** `login()`, `signup()`, `logout()`, `updateUser()`.
  Falam direto com o Identity e escrevem os cookies `nf_jwt` / `nf_refresh`.
- **Leitura no servidor:** `getUser()` nas rotas de API, validando o cookie da
  requisição.

```ts
// Rota de servidor — protege o endpoint
import { getUser } from '@netlify/identity'

export async function GET() {
  const usuario = await getUser()
  if (!usuario) {
    return Response.json({ erro: 'Não autenticado' }, { status: 401 })
  }
  return Response.json(await lerDados(usuario.id))
}
```

`getUser()` nunca lança — devolve `null` em qualquer falha, inclusive se o
Identity estiver desligado. Isso é bom: o app degrada em vez de quebrar.

## Passo 4 — Contexto de sessão no React *(específico do Next)*

O Identity não traz Provider próprio. Este é o equivalente ao `SessionProvider`
do next-auth:

```tsx
'use client'

import { getUser, onAuthChange, type User } from '@netlify/identity'
import { createContext, useContext, useEffect, useState } from 'react'

type Sessao = { usuario: User | null; carregando: boolean }

const ContextoSessao = createContext<Sessao>({ usuario: null, carregando: true })

export function useSessao() {
  return useContext(ContextoSessao)
}

export default function ProvedorSessao({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let vivo = true
    getUser().then((u) => {
      if (!vivo) return
      setUsuario(u)
      setCarregando(false)
    })
    const cancelar = onAuthChange((_evento, u) => setUsuario(u))
    return () => {
      vivo = false
      cancelar()
    }
  }, [])

  return (
    <ContextoSessao.Provider value={{ usuario, carregando }}>
      {children}
    </ContextoSessao.Provider>
  )
}
```

O `carregando` evita o pisca-pisca de mostrar "Entrar" por um instante para
quem já está logado.

**Por que resolver a sessão no cliente e não no servidor:** chamar `getUser()`
num Server Component faz o Next chamar `headers()` internamente, o que torna a
página **dinâmica**. Se o seu projeto depende de páginas estáticas por
performance ou SEO, resolver no cliente preserva isso. Se as páginas já são
dinâmicas, `getUser()` no servidor é mais direto e evita o flash de conteúdo
não autenticado.

## Passo 5 — Os links de email

Confirmação, recuperação e troca de email voltam com o token **no hash da
URL**, e podem cair em qualquer página. Por isso `handleAuthCallback()` mora no
layout raiz, não numa rota `/callback`:

```tsx
const HASH_DE_AUTENTICACAO =
  /^#(confirmation_token|recovery_token|invite_token|email_change_token|access_token)=/

// Dentro do provedor, num segundo useEffect:
useEffect(() => {
  if (!HASH_DE_AUTENTICACAO.test(window.location.hash)) return

  handleAuthCallback()
    .then((resultado) => {
      if (!resultado) return setProcessandoLink(false)
      // Na recuperação o usuário JÁ está logado, mas ainda sem senha nova.
      window.location.href =
        resultado.type === 'recovery' ? '/nova-senha' : '/'
    })
    .catch((erro) => {
      setErroDoLink(erro.message)
      setProcessandoLink(false)
    })
}, [])
```

Inicialize `processandoLink` já no primeiro render (`useState(() => temToken())`)
e renderize um "validando…" enquanto isso — senão a página aparece por baixo do
token antes do redirecionamento.

## Passo 6 — Recuperação de senha

Duas telas, e o fluxo é de dois tempos:

```ts
// Tela 1 — /recuperar-senha
await requestPasswordRecovery(email)
```

Responda **igual** para email cadastrado e não cadastrado, senão o formulário
vira um oráculo que revela quem tem conta:

```ts
try {
  await requestPasswordRecovery(email)
} catch {
  // ignora de propósito
} finally {
  setEnviado(true)
}
```

```ts
// Tela 2 — /nova-senha, alcançada pelo handleAuthCallback
// O usuário já está autenticado neste ponto.
await updateUser({ password: novaSenha })
```

## Armadilhas — a parte que custou tempo

### 1. `window.location.href`, nunca `router.push()` *(específico do Next)*

Depois de qualquer mutação de auth, a navegação precisa ser **completa**. O
`router.push()` faz navegação suave e o cookie recém-escrito não chega ao
servidor, que continua vendo a sessão antiga.

Existe uma regra do ESLint (`@next/next/no-location-assign-relative-destination`)
que reclama exatamente disso. Silencie **com o motivo no comentário**:

```tsx
// Navegacao completa e obrigatoria aqui: router.push() faz navegacao
// suave e o cookie de sessao recem-escrito nao chegaria ao servidor.
// eslint-disable-next-line @next/next/no-location-assign-relative-destination
window.location.href = '/'
```

Atenção: `eslint-disable-next-line` vale só para a **linha imediatamente
seguinte**. Comentário explicativo vai *antes* da diretiva, nunca entre ela e o
código.

### 2. O Netlify roda `npm install` puro

**Esta foi a mais cara.** Um conflito de peer dependency derruba o deploy mesmo
com o `package-lock.json` commitado resolvido — o npm revalida os peers e aborta
com `ERESOLVE`. Resolver localmente com `--legacy-peer-deps` dá a falsa sensação
de que está tudo certo, e o site fica meses num build antigo sem ninguém notar.

No `my-biblia` isso escondeu que **o login nunca tinha ido ao ar**. Se o
`npm install` não passa limpo, não vai ao ar.

### 3. `autoconfirm` muda o que acontece no cadastro

Com `autoconfirm: false` (padrão), `signup()` **não abre sessão**. A UI precisa
tratar os dois casos:

```ts
const criado = await signup(email, senha)
if (!criado.confirmedAt) {
  setAviso(`Enviamos um link de confirmação para ${email}.`)
  return
}
window.location.href = '/'
```

### 4. `useSearchParams()` exige Suspense *(específico do Next)*

Não é do Identity, mas aparece junto porque a tela de login costuma ler
`?callbackUrl=`. Sem um limite de Suspense acima, o prerender da página quebra
o build inteiro. Ponha o formulário dentro de `<Suspense>` com um esqueleto
como fallback.

### 5. Deploy Preview compartilha a instância de Identity

Ótimo para testar de verdade antes do merge — mas a conta criada no preview
**existe em produção**. Limpe depois, se quiser começar zerado.

### 6. Migrar de outro sistema perde as contas

Hashes bcrypt próprios não são importáveis para o Identity. Todo mundo precisa
se recadastrar, e qualquer dado seu chaveado pelo id antigo fica órfão. Planeje
isso **antes**, não depois.

## Checklist

- [ ] Identity ligado no painel
- [ ] `Registration preferences` definido (`Open` / `Invite only`)
- [ ] `autoconfirm` decidido, e a UI tratando os dois casos
- [ ] Modelos de email traduzidos
- [ ] `@netlify/identity` instalado; pacotes antigos fora
- [ ] Mutações no browser, `getUser()` no servidor
- [ ] `handleAuthCallback()` no layout raiz
- [ ] Navegação completa após mutação de auth
- [ ] Telas de recuperação de senha
- [ ] Segredos do auth anterior removidos do painel
- [ ] `npm install` passa **sem** flags
- [ ] Testado em Deploy Preview: cadastro → confirmação → login → rota
      protegida devolvendo 200

## Referência rápida

| Função | Onde roda | Para quê |
|---|---|---|
| `getUser()` | browser + servidor | Usuário atual ou `null`. Nunca lança |
| `isAuthenticated()` | browser + servidor | Booleano |
| `login(email, senha)` | browser + servidor | Autentica, escreve cookies |
| `signup(email, senha, data?)` | browser + servidor | Cria conta |
| `logout()` | browser + servidor | Limpa cookies e sessão |
| `updateUser({...})` | browser | Troca email, senha ou metadados |
| `onAuthChange(cb)` | browser | Assina mudanças; devolve unsubscribe |
| `handleAuthCallback()` | browser | Processa o token do hash |
| `requestPasswordRecovery(email)` | browser | Dispara o email de recuperação |
| `refreshSession()` | browser + servidor | Renova o token; use em middleware |
| `verifyRequestOrigin(req)` | servidor | CSRF, se mutar auth no servidor |
| `admin.listUsers()` etc. | **só servidor** | Administração; exige operator token |

Erros: `AuthError` (com `.status` HTTP) e `MissingIdentityError` (Identity não
configurado).

## Se o outro projeto não for Next.js App Router

O pacote traz seções próprias no README para **Remix, TanStack Start, Astro e
SvelteKit**. O que muda:

- **Remix / SvelteKit / Astro** aceitam bem o padrão de mutação no servidor,
  porque o `redirect()` deles já devolve o `Set-Cookie` aplicado — diferente do
  Next, onde o redirect vira navegação suave.
- **Astro e SvelteKit** têm middleware, então vale chamar `refreshSession()`
  ali para manter o token válido entre requisições.
- **Pages Router do Next**: a parte de cliente é idêntica; o que muda é a
  leitura no servidor, que vai para `getServerSideProps` em vez de Server
  Components.
