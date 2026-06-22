# Template: `plan.md`

O contrato de **HOW** de uma feature: design + tasks num único arquivo, em `docs/specs/<feature>/plan.md`. É o que o `sdd:implement` executa — então o formato das tasks, da matriz e dos lotes É um contrato, parseado por máquina. Este template é a fonte de verdade desse formato.

## Idioma

Herdado do `spec.md` (`lang:` no frontmatter). Não re-detectar.

## Estrutura

```markdown
---
title: <feature>
lang: pt | en              # herdado da spec
status: draft | ready      # "ready" só com matriz completa E zero [ANALYSIS] aberto
spec: ./spec.md
generated: <data>
---

# Plan: <feature>

> **Para os executores (sdd:implement):** cada task é executada por um subagente fresco que apenas SEGUE os Steps abaixo, em ordem, sem analisar a codebase — toda a análise já foi feita aqui. Steps usam checkbox (`- [ ]`) e seguem TDD: RED → GREEN → REFACTOR → COMMIT.

**Goal:** <o que esta feature entrega, em 1-2 frases. Inclui bug colateral corrigido, se houver.>

**Architecture:** <a abordagem técnica em 1-3 frases: o pipeline/fluxo que a mudança percorre e os padrões reais que segue.>

**Tech Stack:** <stack relevante à feature — ex: NestJS, TypeScript, CQRS, TypeORM, Jest.>

---

## Design

### Visão da solução
<como a spec é satisfeita, em termos técnicos. 3-5 frases.>

### Ancoragem no codebase
<os padrões reais que este design segue, por caminho. Brownfield: conforma, não reinventa.>
- Segue o adapter de [integrations/seru-client.md](../../codebase/integrations/seru-client.md)
- Respeita a regra de camada de [layers/presentation-layer.md](../../codebase/layers/presentation-layer.md)

### Componentes e fluxo
<o que muda/nasce, onde vive, e o caminho ponta a ponta. Cada decisão → REQ-id.>
- `SeruNotificationAdapter.streamStatus()` — assina o stream upstream → REQ-1, REQ-3
- Sem persistência (stream stateless) → REQ-2

### Trade-offs
<as escolhas técnicas e por quê. Herda as "Decisões e restrições" da spec.>
- SSE em vez de WebSocket: unidirecional basta (REQ-1), menos infra. (decisão D-1 da spec)

## Tasks

<cada task é atômica. T-<n> estável. [!] = crítica (lote solo). [P] NÃO se declara aqui —
 é computado da interseção de Arquivos; o plan registra o resultado no campo Lote.

 Os campos de metadados (Origem/Depende de/Arquivos/Verificação/Lote) são o CONTRATO parseável.
 Os Steps abaixo deles são o ROTEIRO de execução: o subagente do implement só os segue, não decide.
 Cada task começa com um teste failing e termina num commit atômico — TDD, sem exceção.

 Regra dos Steps: SEMPRE checkbox + arquivo + comando de verificação. Trecho de código embutido
 SÓ quando o edit é não-óbvio (uma assinatura nova, um spread condicional, um SQL). Edit trivial
 (adicionar um campo a um DTO) descreve-se em uma linha, sem bloco de código.>

### T-1
- Origem: REQ-2
- Depende de: —
- Arquivos: src/modules/notification/domain/ports/notification-gateway.port.ts, src/.../tests/notification-gateway.port.spec.ts
- Verificação: teste `should expose stream contract` cobre o critério de REQ-2
- Lote: L-1

- [ ] **Step 1 (RED):** escrever teste failing `should expose stream contract` no `.spec.ts`, asserindo o contrato observável de REQ-2. Rodar `yarn test notification-gateway.port.spec` → ver FALHAR na asserção (não em import/sintaxe).
- [ ] **Step 2 (GREEN):** definir a port mínima que satisfaz o teste. Rodar o teste → ver PASSAR.
- [ ] **Step 3 (REFACTOR):** limpar com o teste como rede. Rodar de novo → verde.
- [ ] **Step 4 (COMMIT):** `feat(notification): expor contrato de stream na port` (Conventional Commits, inglês).

### T-2  [!]
- Origem: REQ-1, REQ-3
- Depende de: T-1
- Arquivos: src/modules/notification/infrastructure/seru/seru-notification.adapter.ts, src/.../tests/seru-notification.adapter.spec.ts
- Verificação: teste `should emit order.status on change` cobre o critério de REQ-1; `should auto-reconnect on drop` cobre REQ-3
- Lote: L-2

- [ ] **Step 1 (RED):** escrever teste failing `should emit order.status on change`. Rodar → ver FALHAR.
- [ ] **Step 2 (GREEN):** implementar `streamStatus()` no adapter. Trecho não-óbvio (assina upstream e remapeia):
  ```ts
  streamStatus(orderCode: string): Observable<OrderStatusEvent> {
    return this.upstream.subscribe(orderCode).pipe(
      map((raw) => new OrderStatusEvent(raw.code, raw.status)),
    );
  }
  ```
  Rodar o teste → ver PASSAR.
- [ ] **Step 3 (RED):** escrever teste failing `should auto-reconnect on drop` (REQ-3). Rodar → ver FALHAR.
- [ ] **Step 4 (GREEN):** adicionar `retryWhen`/backoff ao pipe. Rodar os dois testes → verde.
- [ ] **Step 5 (REFACTOR):** extrair o backoff se repetir. Rodar → verde.
- [ ] **Step 6 (COMMIT):** `feat(notification): emitir order.status e reconectar no adapter SERU`.

## Lotes

<pré-computados do grafo de dependência + dos dois eixos. O implement usa, não recomputa.>
- **L-1** (serial): T-1
- **L-2** (solo, [!]): T-2 — crítica, roda e valida sozinha
- **L-3** (paralelo): T-4, T-5 — Arquivos sem interseção, nenhuma na lista quente

## Matriz de cobertura (REQ → task → teste)

<a espinha da cadeia de provas. TODO REQ da spec aparece aqui com ≥1 task e ≥1 teste.
 Se algum REQ ficar sem cobertura, o plan FALHA e lista o gap — não prossegue.>

| REQ   | Tasks    | Teste(s) que provam                       |
|-------|----------|-------------------------------------------|
| REQ-1 | T-2      | should emit order.status on change        |
| REQ-2 | T-1      | should expose stream contract             |
| REQ-3 | T-2      | should auto-reconnect on drop             |

## Remediação de concerns (opcional, opt-in)

<só concerns cuja âncora cai nos Arquivos da feature, e que o dev ACEITOU incluir.
 Vazio se nenhum foi aceito. Débito global NÃO entra aqui.>
- T-6 — Origem: CONCERN-007 — trata timeout do stream upstream (src/.../adapter.ts:42)

## Análise pendente

<os [ANALYSIS: ...] abertos do /analyze. Persistidos AQUI no momento em que surgem.
 Enquanto tiver itens, status = draft e sdd:implement RECUSA. Vazia → "Nenhuma." e status = ready.>
- Nenhuma.
```

## Regras de preenchimento

- **Steps são o roteiro de execução.** Toda task tem Steps em checkbox que o subagente do implement segue sem analisar nada. A análise da codebase acontece AQUI, no plan; o implement só executa. Steps mal-feitos forçam o implement a analisar — exatamente o que o design quer impedir.
- **Steps seguem TDD.** Ordem fixa por critério de `Verificação`: RED (teste failing + rodar + ver falhar) → GREEN (código mínimo + rodar + ver passar) → REFACTOR → e um COMMIT atômico ao fim da task. Cada Step de teste nomeia o comando real (`yarn test ...`).
- **Trecho de código só quando não-óbvio.** Sempre checkbox + arquivo + comando. Bloco de código embutido apenas para edits não-triviais (assinatura nova, spread condicional, SQL); edit trivial vira uma linha de descrição.
- **Task atômica, ID estável.** `T-<n>` nunca renumerado — é o alvo de `sdd:implement T-n` e a chave da matriz.
- **`Verificação` nomeia o teste** que cobre um critério de aceite da spec. Sem teste nomeado, a task está fora da cadeia de provas.
- **`[!]` é marcado; `[P]`/`Lote` é computado.** Criticidade você decide (heurística + override do dev). Paralelizabilidade vem da interseção de `Arquivos` + lista quente (`*.module.ts`, `env.schema.ts`, contratos) — o resultado vira o `Lote`.
- **Matriz completa é gate.** Todo REQ da spec → linha na matriz com task + teste. Faltou um → plan FALHA, lista o gap, para.
- **`/analyze` loop bloqueante.** Inconsistência achada → `[ANALYSIS: ...]` persistido em "Análise pendente" na hora. `status: ready` só com a seção vazia. `sdd:implement` lê o status e a seção — plan `draft` ou com `[ANALYSIS]` aberto é recusado.
- **Concerns só por escopo e opt-in.** Filtra por âncora nos `Arquivos` da feature, apresenta ao dev, só entra se aceito. Nunca auto-injeta, nunca puxa débito global.
- **Cada decisão de Design → REQ-id.** Decisão órfã (sem REQ) é scope creep.
