# Revisão de código — 10/11/2026

Revisão em três frentes (servidor, regras e estado, telas). Os itens marcados **conferido** foram confirmados no código; os demais vêm do relatório da frente e têm local e cenário, mas não foram reproduzidos à mão.

**Autorização: nada a reportar.** Todas as rotas passam por `getUser()`, os ids são validados e as chaves do Blobs ficam sob o id do usuário.

## Alta prioridade (risco de perder ou corromper dados)

1. **Voltar para o app troca a empresa ativa** — **conferido** — **corrigido (12/11)**
   - **Onde:** `lib/store.tsx:286-306`.
   - **Problema:** a releitura do servidor (`focus`/`visibilitychange`) traz o `empresaAtivaId` escolhido em outro aparelho ou aba.
   - **Efeitos:**
     - Uma edição aberta é salva na empresa errada (`updateOrcamento` não acha o id, e o toast diz "salvo" mesmo assim).
     - `aprovarColagem`/`agendarOrcamento` podem substituir a empresa B inteira por uma cópia da A.
   - **Correção:** preservar o `empresaAtivaId` local na releitura, ou tirá-lo do estado sincronizado. Aplicar o resultado de `aprovarColagem`/`agendarOrcamento` pelo id da empresa.
2. **Excluir orçamento apaga os pagamentos e deixa o agendamento órfão** — **conferido** — **corrigido (12/11)** (`lib/store.tsx:400-403`).
   - **Efeitos:** a Agenda segue mostrando o agendamento, com "a receber" errado e o sinal perdido.
   - **Correção:** avisar no confirm e remover o agendamento junto, ou bloquear a exclusão e sugerir "recusado".
3. **Montador do EJ salva o preço do pacote anterior** — **conferido** — **corrigido (12/11)**
   - **Onde:** `components/gerador/MontadorEj.tsx:129`.
   - **Problema:** `atual` só compara o código. Trocar de pacote e enviar em menos de 350 ms, ou depois de um erro da API, grava os itens e o total de A com a `[ref]` de B.
   - **Correção:** guardar a `linhaRef` junto do recálculo e exigir que seja igual. Limpar o recálculo a cada mudança e quando der erro.
4. **Duplicar orçamento do EJ copia o `codigoRef`** — **corrigido (12/11)** (`orcamentos/page.tsx` `handleDuplicar`, `lib/colar.ts` `acharExistente`).
   - **Problema:** ao colar a aprovação, o sistema sobrescreve o **original**, e a cópia também herda `refEj` e os registros de parceria.
   - **Correção:** retirar `codigoRef`, `refEj` e os registros de parceria ao duplicar.
5. **XSS no PDF pela data** — **conferido** — **corrigido (12/11)** (`lib/orcamento.ts:95-96`).
   - **Problema:** `formatDateBR(o.data)` vai sem escape para o `innerHTML`, e um backup importado pode trazer script na data.
   - **Correção:** `escapeHtml(...)` e validar `AAAA-MM-DD` no `mergeEmpresa`.

## Média prioridade

6. **"Sair" descarta o que está no debounce** — **conferido** — **corrigido (12/11)** (`components/layout/Sidebar.tsx:60`).
   - **Correção:** chamar `garantirSalvo()` antes do `logout()`.
7. **Gravação fora da fila**
   - **Problema:** o `keepalive` só funciona até 64 KB, o que vale para o estado inteiro, e não há gravação ao esconder a aba.
   - **Efeito no celular:** "Enviar pelo WhatsApp" abre outro app; se o sistema matar a aba, o orçamento nunca é gravado, e o próximo repete o número.
   - **Correção:** `garantirSalvo()` no `visibilitychange: hidden` e no montador.
8. **Sem nova tentativa depois de uma falha de rede no salvamento**
   - **Correção:** backoff e reenvio no evento `online`.
9. **Falso conflito (409) disparado pelo próprio aparelho**
   - **Causas:**
     - A gravação estoura o limite de 3 s, mas chega ao Blobs (`comLimite` não cancela).
     - O `pagehide` com bfcache.
10. **Sem prazo total na geração de documentos** — **conferido** (`lib/server/documentos.ts:29-50`, 12 tentativas)
    - **Problema:** os limites por etapa somam mais de 30 s, contra os cerca de 10 s da função.
    - **Correção:** um prazo único (cerca de 8,5 s) repartido entre as etapas.
11. **Formulário livre aceita quantidade, preço e desconto negativos, e desconto acima de 100%**
    - **Problema:** o PDF esconde a diferença, porque um desconto negativo vira acréscimo invisível.
    - **Correção:** `Math.max(0, …)`, limitar o percentual a 100 e calcular em centavos.
12. **Painel soma orçamentos de moedas diferentes** como se fossem a moeda da empresa (`painel/page.tsx`).
13. **CSV de clientes** (`lib/helpers.ts`)
    - **Problemas:**
      - Observação com várias linhas quebra a importação.
      - CSV do Excel em pt-BR, que usa `;`, não é aceito.
    - Não há teste de CSV.
14. **Reenviar pelo WhatsApp um orçamento do EJ** manda a mensagem sem a `[ref]`, e colar a resposta não funciona.
15. **Campos numéricos do Montador do EJ** forçam o mínimo a cada tecla: digitar 120 vira 6020.
16. **Importar um JSON que não é backup** mostra "importado com sucesso" sem ter feito nada — **conferido**.

## Baixa prioridade

- **Valor por extenso em milhões** — **conferido**: "um milhão mil reais", "zero real", e 1e12 vira 500 em vez de 422.
- **Marcadores nos dados:** `{{` digitado pelo usuário (ex.: nome "Ana {{VIP}}") vira falso "marcador sem valor".
- **Arquivo órfão com CPF:** se o registro no índice falha depois de `gravarArquivo`, o arquivo fica gravado e ninguém alcança.
- **Limite do corpo em `/api/dados`:** está em 8 MB e medido em caracteres; a plataforma aceita cerca de 6 MB.
- **Validação rasa do estado no PUT:** uma empresa malformada derruba a geração com 500.
- **Login com limite curto:** o login da rota tem limite de 3 s, menor que os 5 s da biblioteca.
- **`linkWhatsApp`** põe 55 na frente de números estrangeiros.
- **Arredondamento do EJ:** `valor/quantidade` gera total gravado diferente do combinado (R$ 99,99 em vez de R$ 100).
- **Itens sem descrição:** somem do PDF e do WhatsApp, mas entram no total.
- **Diálogo de documentos:**
  - mostra R$ em orçamento de outra moeda;
  - conta pagamento `outro` no saldo;
  - sinal diferente da Agenda quando há `valorCombinado`.
- **Excluir serviço do catálogo** não avisa que orçamentos enviados param de recalcular; o melhor é desativar.
- **Acessibilidade:** botões só com ícone sem `aria-label` (lixeira do item, remover empresa, remover logo).

## Testes que faltam
- `atualizarJson`/`reservarNumero` (corrida e fim das tentativas), extraindo o laço com o store injetado.
- CSV (ida e volta, `;`, aspas com quebra de linha).
- `calcOrcamentoTotais` com valores negativos e percentual acima de 100%.
- `linkWhatsApp` com número internacional.
- Releitura do store preservando `empresaAtivaId`.
- `acharExistente` com `codigoRef` repetido.
