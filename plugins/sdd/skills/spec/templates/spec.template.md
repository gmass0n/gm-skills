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

## Repos envolvidos
<APENAS multi-repo (feature toca >1 repo). Em single-repo OMITA esta seção inteira
 e NÃO tague os REQs — a spec fica byte-idêntica ao formato single-repo.
 Tabela parseável: o plan a lê direto e herda a topologia (não re-descobre raiz/slug/branch/clone).
 Uma linha por repo, ordenadas pela cadeia. Colunas:
   tag         = handle curto (LOC/CUS/BFF/POR) — usado p/ taguear REQ e, depois, task.
   repo (slug) = slug real do repo (pos-facil-api etc.), não nome amigável.
   papel       = produz / transforma / consome (da pergunta de fronteira:
                 produz=cunha o dado, transforma=reshape/encaminha, consome=lê).
   branch base = master / develop (de onde a branch da feature deste repo sai).
   clonado?    = sim / não / <onde> (está clonado localmente e onde — p/ o plan não re-descobrir).
 Célula que você não consegue fixar = ambiguidade → [NEEDS CLARIFICATION], mesmo loop.>
| tag | repo (slug) | papel | branch base | clonado? |
|-----|-------------|-------|-------------|----------|
| LOC | locations-api | produz | master | sim |
| CUS | pos-facil-api | transforma | master | sim |
| BFF | seru-delivery-api | transforma | develop | sim (este repo) |
| POR | seru-delivery-portal | consome | develop | não |

Cadeia: LOC → CUS → BFF → POR

## User stories
- US-1: Como <persona>, quero <capacidade> para <benefício>.
- US-2: ...

## Requisitos (EARS, com REQ-IDs)
<EARS = Easy Approach to Requirements Syntax. Cada REQ é observável e testável.
 Padrões: WHEN <gatilho>, THE sistema SHALL <ação>. / WHILE <estado>, THE sistema
 SHALL <ação>. / IF <condição>, THEN THE sistema SHALL <ação>. REQ-IDs são estáveis
 e sequenciais — uma vez atribuído, um número não é reusado.
 Multi-repo: cada REQ termina com (repo: <tag>) — o plan deriva o campo Repo: da task
 deste mapa, não chuta. Um REQ que cruza 2 repos vira 2 REQs (um por repo), não 1 com 2 tags.
 Single-repo: sem tag.>
- REQ-1: WHEN um pedido muda de status, THE sistema SHALL emitir uma notificação ao operador conectado em até 2s. (repo: BFF)
- REQ-2: WHILE o operador está desconectado, THE sistema SHALL descartar notificações (sem backlog). (repo: BFF)
- REQ-3: IF a conexão SSE cair, THEN o cliente SHALL reconectar automaticamente. (repo: POR)

## Critérios de aceite (por requisito)
<um bloco por REQ — é o que vira o teste no plan. Concreto e verificável.>
- REQ-1: dado um pedido em "preparing", quando vira "ready", então o stream do operador recebe um evento `order.status` com o code em ≤2s.
- REQ-2: dado operador desconectado, quando um pedido muda, então nenhuma notificação é enfileirada.

## Diagrama de validação
<OPCIONAL — só quando ajuda a validar o entendimento (lifecycle/máquina de estado,
 fluxo multi-componente, processo com ramos). Trivial/CRUD linear: OMITA (YAGNI).
 Tipo pelo que a spec é: estado (status que transiciona) / sequência (componentes no
 tempo) / flowchart (processo com decisões). Desenhado COM o usuário antes de "ready".>
```
PENDING ──pagamento──> PAID
   │                    │
   └──expira(grace 5d)──┴──falha──> FAILED ──retry(7d)──> SUSPENDED ──30d──> CANCELLED
```

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
- **Contrato externo não-confirmado = `[UNVERIFIED]`.** Campo/rota/evento de API externa que você não confirmou na doc oficial entra marcado `[UNVERIFIED]` — vale na spec, mas o marcador desce pro plan confirmar antes de codar. Nunca afirme contrato externo como fato sem fonte.
- **Janelas temporais que compõem: some e valide o total.** Retry + grace + expiração — pergunte ao usuário se são paralelos ou sequenciais e confirme o SLA agregado (8d vs 15d). Desenhe no "Diagrama de validação" para o gap aparecer.
- **Decisões ≠ Clarificações.** Decisões = o que foi FECHADO no grill (o plan herda). Clarificações = o que está ABERTO (o plan espera). As duas seções são metades opostas do handoff.
- **Multi-repo: topologia é artefato, não prosa.** `## Repos envolvidos` (tabela + `Cadeia:`) e o `(repo: <tag>)` em cada REQ nascem AQUI, na spec — o plan herda a topologia e deriva o `Repo:` de cada task do mapa REQ→repo, sem re-descobrir raiz/slug/branch/clone. Single-repo: seção omitida e REQs sem tag (spec byte-idêntica ao formato single-repo).
- **Persistência incremental das clarificações.** O marcador entra nesta seção no instante em que a ambiguidade surge — não no fim. É o que torna a spec resumível se a sessão morrer.
- **`status: ready` é um gate real.** Só vira `ready` com "Clarificações pendentes" vazia. `sdd:plan` lê isso e o frontmatter — spec `draft` ou com marcador aberto é recusada.
