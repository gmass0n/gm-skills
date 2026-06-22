# Template: `spec.md`

O contrato de **WHAT/WHY** de uma feature. Vive em `docs/specs/<feature>/spec.md`. É a raiz da cadeia de provas: cada `REQ-ID` aqui será rastreado por `sdd:plan` (matriz REQ→task→teste) e provado verde por `sdd:implement`. Este template É o contrato — `sdd:plan` lê esperando exatamente estas seções e este formato de REQ-ID.

## Idioma

Travado pelo prompt inicial do `sdd:spec` (`lang: pt|en` no frontmatter). Tudo no mesmo idioma. `sdd:plan` herda.

## Estrutura

```markdown
---
title: <feature>
lang: pt | en
status: draft | ready          # "ready" só quando "Clarificações pendentes" está vazia
generated: <data>
---

# Spec: <feature>

## Contexto e objetivo
<por que existe, que problema resolve. 2-3 frases. ZERO código.>

## User stories
- US-1: Como <persona>, quero <capacidade> para <benefício>.
- US-2: ...

## Requisitos (EARS, com REQ-IDs)
<EARS = Easy Approach to Requirements Syntax. Cada REQ é observável e testável.
 Padrões: WHEN <gatilho>, THE sistema SHALL <ação>. / WHILE <estado>, THE sistema
 SHALL <ação>. / IF <condição>, THEN THE sistema SHALL <ação>. REQ-IDs são estáveis
 e sequenciais — uma vez atribuído, um número não é reusado.>
- REQ-1: WHEN um pedido muda de status, THE sistema SHALL emitir uma notificação ao operador conectado em até 2s.
- REQ-2: WHILE o operador está desconectado, THE sistema SHALL descartar notificações (sem backlog).
- REQ-3: IF a conexão SSE cair, THEN o cliente SHALL reconectar automaticamente.

## Critérios de aceite (por requisito)
<um bloco por REQ — é o que vira o teste no plan. Concreto e verificável.>
- REQ-1: dado um pedido em "preparing", quando vira "ready", então o stream do operador recebe um evento `order.status` com o code em ≤2s.
- REQ-2: dado operador desconectado, quando um pedido muda, então nenhuma notificação é enfileirada.

## Fora de escopo
<fecha a porta para scope creep. O que NÃO entra nesta feature.>
- Notificação por push/e-mail.
- Histórico persistido de notificações.

## Decisões e restrições da entrevista
<decision log: o COMO-condicionante decidido no grill. Não é requisito, mas o plan herda.
 Cada linha: decisão + por quê + REQ afetado.>
- D-1: SSE em vez de WebSocket — unidirecional basta para REQ-1 e exige menos infra. Afeta REQ-1, REQ-3.
- D-2: Sem camada de persistência — REQ-2 define stream stateless. Afeta REQ-2.

## Clarificações pendentes
<os [NEEDS CLARIFICATION: ...] ainda abertos. Persistidos AQUI no momento em que surgem.
 Enquanto esta seção tiver itens, status = draft e sdd:plan RECUSA.
 Quando vazia: "Nenhuma." e status = ready.>
- [NEEDS CLARIFICATION: reconexão re-entrega notificações perdidas ou só dali pra frente?]
```

## Regras de preenchimento

- **REQ-IDs estáveis.** Sequenciais, nunca reusados. São a espinha da rastreabilidade — o plan e o implement referenciam por eles.
- **Requisito é observável, não implementação.** "THE sistema SHALL emitir evento" (observável) — não "o SeruNotificationAdapter assina o stream" (isso é design, vai pro plan).
- **Todo REQ tem critério de aceite mensurável.** Sem número/condição verificável → vira `[NEEDS CLARIFICATION]`, não passa.
- **Decisões ≠ Clarificações.** Decisões = o que foi FECHADO no grill (o plan herda). Clarificações = o que está ABERTO (o plan espera). As duas seções são metades opostas do handoff.
- **Persistência incremental das clarificações.** O marcador entra nesta seção no instante em que a ambiguidade surge — não no fim. É o que torna a spec resumível se a sessão morrer.
- **`status: ready` é um gate real.** Só vira `ready` com "Clarificações pendentes" vazia. `sdd:plan` lê isso e o frontmatter — spec `draft` ou com marcador aberto é recusada.
