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
 é computado da interseção de Arquivos; o plan registra o resultado no campo Lote.>

### T-1
- Origem: REQ-2
- Depende de: —
- Arquivos: src/modules/notification/domain/ports/notification-gateway.port.ts
- Verificação: teste `should expose stream contract` cobre o critério de REQ-2
- Lote: L-1

### T-2  [!]
- Origem: REQ-1, REQ-3
- Depende de: T-1
- Arquivos: src/modules/notification/infrastructure/seru/seru-notification.adapter.ts, src/.../tests/seru-notification.adapter.spec.ts
- Verificação: teste `should emit order.status on change` cobre o critério de REQ-1; `should auto-reconnect` cobre REQ-3
- Lote: L-2

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

- **Task atômica, ID estável.** `T-<n>` nunca renumerado — é o alvo de `sdd:implement T-n` e a chave da matriz.
- **`Verificação` nomeia o teste** que cobre um critério de aceite da spec. Sem teste nomeado, a task está fora da cadeia de provas.
- **`[!]` é marcado; `[P]`/`Lote` é computado.** Criticidade você decide (heurística + override do dev). Paralelizabilidade vem da interseção de `Arquivos` + lista quente (`*.module.ts`, `env.schema.ts`, contratos) — o resultado vira o `Lote`.
- **Matriz completa é gate.** Todo REQ da spec → linha na matriz com task + teste. Faltou um → plan FALHA, lista o gap, para.
- **`/analyze` loop bloqueante.** Inconsistência achada → `[ANALYSIS: ...]` persistido em "Análise pendente" na hora. `status: ready` só com a seção vazia. `sdd:implement` lê o status e a seção — plan `draft` ou com `[ANALYSIS]` aberto é recusado.
- **Concerns só por escopo e opt-in.** Filtra por âncora nos `Arquivos` da feature, apresenta ao dev, só entra se aceito. Nunca auto-injeta, nunca puxa débito global.
- **Cada decisão de Design → REQ-id.** Decisão órfã (sem REQ) é scope creep.
