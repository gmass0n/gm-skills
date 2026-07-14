---
name: help
description: Escolha o comando manual do gm-skills para o objetivo atual.
disable-model-invocation: true
---

# gm-skills help

Identifique o objetivo do usuário e responda somente com o comando explícito mais adequado e uma frase curta de escopo. Não execute outra skill nem inicie trabalho.

| Objetivo | Comando manual |
| --- | --- |
| Mapear ou atualizar convenções do repositório | `$sdd:codebase` |
| Definir requisitos de uma funcionalidade | `$sdd:spec` |
| Transformar uma spec aprovada em tarefas | `$sdd:plan` |
| Executar um plano aprovado | `$sdd:implement` |
| Investigar e corrigir um defeito | `$sdd:debug` |
| Revisar mudanças locais antes de publicar | `$sdd:review` |
| Planejar QA ponta a ponta | `$qa:plan` |
| Executar um plano de QA aprovado | `$qa:test` |
| Triar tarefas do Jira | `$triage:jira` |
| Revisar um ou mais PRs remotos | `$prs-review:prs-review` |
| Preparar ou finalizar uma release GitHub | `$github-release:github-release` |
| Produzir atualização de status | `$status-report:status-report` |

Concluído quando o usuário tiver um único comando explícito para invocar. Se houver mais de um objetivo, peça que escolha o primeiro.
