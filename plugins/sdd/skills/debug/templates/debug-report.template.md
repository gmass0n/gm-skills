# Template: `report.md` (na pasta da sessão)

O cursor leve de uma caça a bug. Vive na **pasta da sessão** `docs/debug/<slug>/report.md`, com o `session.jsonl` de captura ao lado (mesma pasta — tudo da sessão centralizado). Quando o bug está numa feature especificada, pode viver em `docs/specs/<feature>/debug-<slug>.md` para herdar o contexto da spec; nesse caso o `session.jsonl` ainda fica em `docs/debug/<slug>/`. Não é um contrato eterno como `spec.md`/`plan.md` — é **andaime descartável**: serve para resumir a caça se a sessão morrer e para guardar o manifesto de limpeza. O registro durável de verdade é o teste de regressão no git; este `.md` pode ser arquivado ou apagado depois do fix.

## Idioma

Travado pelo prompt inicial do `sdd:debug` (`lang: pt|en` no frontmatter). Tudo no mesmo idioma.

## Estrutura

```markdown
---
title: debug — <slug>
lang: pt | en
status: investigando | fix-aplicado | resolvido   # fix-aplicado = GREEN do fix-executor; resolvido só com closing-gate verde E confirmacao-humana
debug-tag: DEBUG-a4f2                  # hash único da sessão — o manifesto de limpeza
feature: <feature ou ->               # link à spec se houver; "-" se bug avulso
repos: [<repo-principal>]             # repos tocados na sessão; >1 só em bug multi-repo (cada um precisa de grep-zero no F8)
confirmacao-humana: <- | sim (data)>  # carimbo do AskUserQuestion final; sem ele, status nunca é "resolvido"
generated: <data>
---

# Debug: <sintoma em uma linha>

## Sintoma
<a mensagem/stack/valor errado exato. tipo: a (backend) | b (frontend) | c (fluxo silencioso).
 Para tipo c, escreva "esperado X, obtido Y" — sem isso, fluxo silencioso é invisível.>

## Repro
<como dispara o bug, minimizado ao menor cenário que ainda falha. 1-3 linhas.
 Marque quem dispara: [agente] roteirizável (teste/curl/navigate), [agente-playwright] fluxo
 backend com auth no browser (curl falha sem token), ou [humano] manual (login/estado).>

## Hipóteses
<2-5, cada uma: mecanismo — onde (camada/arquivo) — status + evidência.
 Status: ✅ confirmada | ❌ refutada | ❓ não testada. A evidência é a linha exata do .jsonl.>
- H1: <mecanismo> — <arquivo> — ❓ não testada
- H2: <mecanismo> — <arquivo> — ✅ confirmada (evidência: [DEBUG-a4f2] em foo.ts:42 mostrou user=null)
- H3: <mecanismo> — <arquivo> — ❌ refutada (evidência: branch B nunca foi tomado no .jsonl)

## Subagentes spawnados (manifesto de orquestração)
<cada subagente comissionado, para auditar a pureza do orquestrador e resumir se a sessão cair.
 O orquestrador não aparece aqui — ele só comissiona e sintetiza.>
- Explore (F2/F5): <o que leu>
- instrumentation-executor (F3): <arquivos instrumentados> — ou "—" se colapsado no fix-executor
- fix-executor (F6): <o fix + commit>
- closing-gate (F8): <veredito>

## Instrumentação (manifesto de limpeza)
<tudo que o closing-gate vai remover. Sem isto, instrumentação órfã fica para sempre se a sessão cair.
 Cada sender tem um comentário-âncora `// DEBUG-<hash> (sdd:debug) — remover na limpeza` na linha de cima.
 Multi-repo: nomeie o repo de cada sender — o grep-zero roda em cada um.>
- debug-tag: DEBUG-a4f2
- senders em: <repo-A> src/.../foo.ts:42, <repo-B> src/.../bar.ts:88
- server: porta 9999 → docs/debug/<slug>/session.jsonl  (ou file-write direto, se sem rede)
- serviço(s) reiniciado(s) para instrumentar: <ex: api (Node 24, node dist/main.js)> — restaurar no F8: sim/não

## Causa raiz
<a função/linha real onde o bug nasce + quantos callers compartilham o mesmo bug (do grep da F2).
 Se há spec: o REQ-ID violado, ou "comportamento nunca especificado".>

## Fix
<arquivo:linha + 1 frase do que mudou. Cite a invariante de context.md que o fix respeita
 e o padrão da camada que ele segue.>

### Prova TDD (do fix-executor)
<a prova de R2 — RED antes de GREEN. Sem o RED, o teste passou trivialmente e não prova nada.>
- comando: <yarn test <spec> / pytest ...>
- RED (antes do fix): <saída colada — o teste falhou>
- GREEN (depois do fix): <saída colada — o teste passou>
- Se pulado (escape honesto): "sem teste — <motivo>", registrado como dívida.

## Closing-gate (veredito — o gate duplo da F8)
<o closing-gate prova; status só vira "resolvido" com todos marcados.>
- [ ] re-repro com a MESMA instrumentação viva = delta provado no mesmo `.jsonl` (antes: <ex. `stage:event-fired` ausente / valor errado> → depois: <ex. presente / valor certo>)
- [ ] teste de regressão verde
- [ ] grep-zero `DEBUG-<hash>` no código — **em cada repo de `repos:`** (só depois do delta acima)
- [ ] processo do debug server morto
- [ ] `session.jsonl` apagado (depois de lido o delta, antes do grep-zero)
- [ ] serviço(s) do dev reiniciado(s) na F4 restaurado(s) ao estado original
- [ ] humano confirmou que o sintoma original sumiu (`confirmacao-humana`)

## Tentativas (só se houve circuit breaker)
<as hipóteses que não seguraram, para não repeti-las ao re-hipotetizar. Apague se nunca disparou.>
```

## Regras de preenchimento

- **Persistência incremental, rewrite never append.** As hipóteses entram aqui no momento em que surgem (F2), com status `❓`; viram `✅`/`❌` conforme a evidência da F4. O manifesto de instrumentação entra na F3, antes de qualquer reprodução. **Reescreva o report a cada fase que fecha — nunca faça append; mantenha-o ~300–400 tokens.** É o state.md do debug (não crie outro): um cursor, não um log.
- **`debug-tag` é o manifesto.** O hash único (`DEBUG-<hash>`) aparece no frontmatter e na seção de instrumentação. A F8 faz `grep` por ele para remover toda a instrumentação — um hash esquecido é um `console.log` órfão no diff.
- **Sintoma do tipo c precisa de "esperado vs obtido".** Sem erro que grite, o que define o bug é a divergência. Escreva-a explícita.
- **Causa raiz nomeia callers.** O número de callers que compartilham o bug é o que justifica o fix na função compartilhada em vez de no caller nomeado.
- **A prova TDD é registro durável.** O `.md` é descartável; o teste no git não. O RED colado prova que o teste foi escrito antes do fix. Se o teste foi pulado, a dívida fica escrita aqui — não some no silêncio.
- **`status` é um gate real, em dois saltos.** `investigando` → `fix-aplicado` (o fix-executor fechou o GREEN, mas nada ainda confirmou que resolve o sintoma) → `resolvido` (**só** com todos os checkboxes do closing-gate marcados **e** `confirmacao-humana` preenchida). Pular de `investigando` direto para `resolvido` é exatamente a falha que esta skill existe para impedir.
- **Pasta-por-sessão + multi-repo.** Tudo da sessão mora em `docs/debug/<slug>/` (report + `session.jsonl`), num único repo mesmo quando o bug cruza repos — a captura converge num só `.jsonl`. Se `repos:` tem mais de um, o manifesto nomeia o repo de cada sender e o grep-zero do F8 roda em cada um; qualquer serviço reiniciado para instrumentar volta ao estado original no fechamento.
