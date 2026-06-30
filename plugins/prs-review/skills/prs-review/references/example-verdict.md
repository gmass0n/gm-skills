# Exemplo de veredito consolidado

Referência de tom, granularidade e formato. É o conteúdo exato que deve ir para o arquivo `.txt` (o chat do agente devolve só o caminho do arquivo).

Regras: sem tabela, cada achado em uma única linha, todo identificador de código entre crases, NITs nunca aparecem. Seções Blockers/Warnings/Praise omitidas se vazias. Lista de PRs sempre numerada, sem `Autor:`. Achados numerados, numeração reinicia por PR. Cabeçalho `PR #<id> — <repo>` só aparece com 2+ PRs. Para GitHub o `<id>` é o `pull_number` (sem `#` extra) e `<repo>` é só o nome do repo (use `<owner>/<repo>` se houver colisão dentro do lote).

---

## Exemplo A — lote misto Bitbucket + GitHub (com cabeçalho de PR)

🔴 CODE REVIEW REJEITADO

1. https://bitbucket.org/rssolutions/pra-notas-api/pull-requests/141 - 4 commits - Yan Ernesto - 🔴 REJEITADO
2. https://github.com/acme/payments-svc/pull/872 - 2 commits - Ana Lima - 🔴 REJEITADO
3. https://github.com/acme/notifications-worker/pull/305 - 1 commit - Bruno Couto - 🟢 APROVADO

🔴 BLOCKERS

PR #141 — pra-notas-api

1. `invoices.service.ts:L1321`: após `success=true`, se `returnedStatus` vier preenchido sobrescreve `invoiceData.status = returnedStatus` → anula o `authorized` setado em `L1288`, grava status inválido. Não reaplicar `returnedStatus` quando `success`; validar contra `InvoiceStatusEnum`.

PR #872 — payments-svc

1. `charge.handler.ts:L88`: `idempotencyKey` não é repassado a `gateway.charge()` quando o request vem do retry queue → cobrança duplicada em retentativa. Propagar `idempotencyKey` do envelope do retry para o gateway.

🟡 WARNINGS

PR #141 — pra-notas-api

1. `invoices.service.ts:L78`: job sem lock → execuções concorrentes duplicam `POST /authorize`. Usar `findOneAndUpdate` atômico de claim.

PR #872 — payments-svc

1. `charge.handler.ts:L132`: `catch (err)` engole erro do gateway e responde `200` → cliente vê sucesso mesmo após falha. Re-lançar como `PaymentGatewayError`.

PR #305 — notifications-worker

1. `email.consumer.ts:L41`: `await ack()` antes do `send()` → mensagem confirmada antes do envio efetivo; queda derruba notificação. Ack só depois do `send()` retornar.

✅ PRAISE

PR #305 — notifications-worker

1. Backoff exponencial com jitter no `retry-policy.ts` está alinhado às boas práticas do `aws-sdk`.

---

## Exemplo B — PR único do GitHub (sem cabeçalho de PR)

🔴 CODE REVIEW REJEITADO

1. https://github.com/acme/checkout-web/pull/4421 - 3 commits - Marsel Lima - 🔴 REJEITADO

🔴 BLOCKERS

1. `cart.reducer.ts:L88`: `state.items` é mutado direto via `push` → reducer não-puro, React não re-renderiza após adicionar item. Retornar novo array via spread.

🟡 WARNINGS

1. `checkout-summary.tsx:L62`: cálculo de total não trata `discount=null` → exibe `NaN` no UI quando cupom inválido. Coalescer com `?? 0` antes da soma.

✅ PRAISE

1. Separação `useCartTotals` em hook próprio facilita teste e reuso na página de revisão.

---

## Exemplo C — PR único do Bitbucket (sem cabeçalho de PR)

🟢 CODE REVIEW APROVADO

1. https://bitbucket.org/rssolutions/vitrine-totem-api/pull-requests/156 - 1 commit - Marsel Lima - 🟢 APROVADO

🟡 WARNINGS

1. `format-invoice-to-tax-invoice.util.ts:L66`: `tributes: 0` fixo em todo item → total de tributos (IBPT) da v2 sai zerado na impressão. confirmar: o que a impressão lê para o IBPT; popular `tributes` a partir do retorno do SERU.

✅ PRAISE

1. Roteamento v1/v2 via `versionIssue` na metadata da config é limpo e alinhado ao desenho da task.
