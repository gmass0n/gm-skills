# Template: `context.md` (router único otimizado para agente)

Este arquivo é o **ponto de entrada** do mapa e o output mais consumido — `sdd:spec` e `sdd:plan` o carregam em toda execução, e o "briefing de task" de cada subagent implementador é destilado dele. Não é dispatchado: você o monta por último, mecanicamente, a partir da lista de arquivos que realmente existem em `docs/codebase/` **mais** o inventário de enforcers coletado na recon (Step 1).

Duas obrigações que definem este doc:
1. **Núcleo enxuto** — alvo de **~500 tokens** no miolo (invariantes + stack + navegação). Catálogo pode crescer com o repo, mas o topo tem que caber barato num prompt. Se estourar, você está colocando narrativa que pertence ao `overview.md` ou detalhe que pertence aos docs filhos.
2. **Honestidade sobre enforcement** — a seção "Invariantes enforced" só lista regras atadas a um mecanismo real (lint/hook/type/interceptor com caminho). É o contrato que o `/analyze` do `sdd:plan` checa; uma invariante sem mecanismo aqui é uma mentira que vaza para todo plano futuro.

## Idioma e forma

PT-BR. Caminhos, nomes de lib e símbolos verbatim.

## Frontmatter (obrigatório)

```yaml
---
title: Codebase — Contexto Canônico
area: context.md
generated: <data passada por você>
sources:
  - <os arquivos de config/enforcer e a árvore que este router resume; ex.>
  - eslint.config.mjs
  - lefthook.yml
  - src/
---
```

## Estrutura do doc

```markdown
# Codebase — Contexto Canônico

<1 parágrafo: ponto de entrada canônico para arquitetura, camadas, padrões,
convenções e regras enforced do <nome-do-serviço>. Diga o que NÃO está aqui:
comandos operacionais (setup, scripts, run, troubleshooting) ficam no README
raiz — linke para `../../README.md`, nunca o edite. O trace ponta a ponta fica
em `overview.md`.>

## Invariantes enforced
<As regras não-negociáveis do projeto, CADA UMA com o mecanismo que a impõe e seu
caminho real. Geradas lendo os enforcers, não escritas à mão. Uma linha por regra.>

| Invariante | Imposta por |
| --- | --- |
| Domain não importa framework | `eslint-plugin-boundaries` — eslint.config.mjs |
| Cobertura ≥ 80% bloqueia push | lefthook.yml (pre-push) |
| Toda resposta HTTP usa envelope `{ timestamp, data }` | ResponseInterceptor — src/shared/... |

<Se houver regras SEM enforcement, liste-as à parte e rotule como aspiração:>
> Convenções sem enforcement mecânico (não confiar como invariante): <...>

## Stack resumida
<Tabela concern → tech → doc canônico. Uma linha por concern.>

| Concern | Tech | Referência |
| --- | --- | --- |
| HTTP server | NestJS | [presentation-layer.md](layers/presentation-layer.md) |
| Persistência | Mongoose | [mongoose.md](integrations/mongoose.md) |

## Navegação por Intenção
<Tabela "Se você precisa... | Comece por", apontando para diretórios. O atalho humano.>

| Se você precisa...                                       | Comece por                       |
| -------------------------------------------------------- | -------------------------------- |
| Entender o sistema e os fluxos ponta a ponta             | [`overview.md`](overview.md)     |
| Revisar arquitetura macro                                | [`architecture/`](architecture/) |
| Saber a regra de uma camada                              | [`layers/`](layers/)             |
| Aplicar um padrão concreto                               | [`patterns/`](patterns/)         |
| Confirmar como uma lib externa está plugada              | [`integrations/`](integrations/) |
| Confirmar naming, testes, gates ou boundaries            | [`conventions/`](conventions/)   |
| Auditar tech debt e riscos                               | [`concerns/`](concerns/)         |

## Carregamento por tarefa
<Ponteiros explícitos: "task tipo X → carregue estes docs". É a ponte que faz o
carregamento seletivo funcionar sem o consumidor adivinhar. Use o doc set real.>

| Tipo de task | Carregue |
| --- | --- |
| Feature HTTP nova | layers/presentation-layer.md + patterns/mapper-pattern.md + conventions/testing.md |
| Nova integração externa | architecture/ports-adapters.md + integrations/<lib>.md |
| Toca área frágil | o concerns/*.md cuja âncora cai nos arquivos da feature |

## Catálogo
<Um bullet por arquivo real, link relativo + hook de 1 linha. É o antigo papel do README.>

### Overview
- [`overview.md`](overview.md) — <hook>

### Architecture
<um bullet por arquivo real em architecture/>

### Layers
<um bullet por arquivo real em layers/>

### Patterns
<lista plana; agrupe por subtema (### Domain / ### Application / ### Boundaries /
### Presentation / ### Cross-cutting) só se ≳6 padrões>

### Integrations
<um bullet por arquivo real; se vazio: "Sem integrações externas de runtime relevantes.">

### Conventions
<um bullet por arquivo real>

### Concerns
<um bullet por arquivo real, hook com a severidade dominante; se vazio:
"Nenhum achado relevante de risco no código atual.">
```

## Regras de montagem

- **Invariantes enforced é a seção de maior valor.** Cada linha prova a regra com um mecanismo num caminho real. Sem mecanismo → não é invariante, é aspiração: rebaixe para a nota separada ou corte. Esta seção é o que o `/analyze` do `sdd:plan` consome para barrar um plano fora do padrão.
- **Liste exatamente os arquivos que existem.** Sem links mortos, sem omissões. Confirme cada arquivo do doc plan (`test -e`) e que cada um está linkado.
- **Núcleo ≤ ~500 tokens.** Invariantes + stack + navegação + carregamento-por-tarefa cabem barato. O catálogo pode crescer; o miolo, não.
- O hook descreve o conteúdo específico do doc ("regra de dependência"), não o genérico do diretório.
- O trace ponta a ponta **não** vai aqui — vai no `overview.md`. `context.md` é roteamento + invariantes, não narrativa.
- `context.md` não tem `## Regra-de-ouro` — é router. Nunca edita o `README.md` raiz; só o referencia.
