# Template: `debug-<slug>.md`

O cursor leve de uma caça a bug. Vive em `docs/specs/<feature>/debug-<slug>.md` quando o bug está numa feature especificada (herda o contexto da spec), ou em `docs/debug/<slug>.md` quando não está. Não é um contrato eterno como `spec.md`/`plan.md` — é **andaime descartável**: serve para resumir a caça se a sessão morrer e para guardar o manifesto de limpeza. O registro durável de verdade é o teste de regressão no git; este `.md` pode ser arquivado ou apagado depois do fix.

## Idioma

Travado pelo prompt inicial do `sdd:debug` (`lang: pt|en` no frontmatter). Tudo no mesmo idioma.

## Estrutura

```markdown
---
title: debug — <slug>
lang: pt | en
status: investigando | resolvido     # "resolvido" só após F8 (grep-zero, server morto, .jsonl apagado)
debug-tag: DEBUG-a4f2                  # hash único da sessão — o manifesto de limpeza
feature: <feature ou ->               # link à spec se houver; "-" se bug avulso
generated: <data>
---

# Debug: <sintoma em uma linha>

## Sintoma
<a mensagem/stack/valor errado exato. tipo: a (backend) | b (frontend) | c (fluxo silencioso).
 Para tipo c, escreva "esperado X, obtido Y" — sem isso, fluxo silencioso é invisível.>

## Repro
<como dispara o bug, minimizado ao menor cenário que ainda falha. 1-3 linhas.
 Marque quem dispara: [agente] roteirizável (teste/curl/navigate) ou [humano] manual (login/estado).>

## Hipóteses
<2-5, cada uma: mecanismo — onde (camada/arquivo) — status + evidência.
 Status: ✅ confirmada | ❌ refutada | ❓ não testada. A evidência é a linha exata do .jsonl.>
- H1: <mecanismo> — <arquivo> — ❓ não testada
- H2: <mecanismo> — <arquivo> — ✅ confirmada (evidência: [DEBUG-a4f2] em foo.ts:42 mostrou user=null)
- H3: <mecanismo> — <arquivo> — ❌ refutada (evidência: branch B nunca foi tomado no .jsonl)

## Instrumentação (manifesto de limpeza)
<tudo que a F8 vai remover. Sem isto, instrumentação órfã fica para sempre se a sessão cair.
 Cada sender tem um comentário-âncora `// DEBUG-<hash> (sdd:debug) — remover na limpeza` na linha de cima.>
- debug-tag: DEBUG-a4f2
- senders em: src/.../foo.ts:42, src/.../bar.ts:88
- server: porta 9999 → docs/debug/<slug>.jsonl  (ou file-write direto, se sem rede)

## Causa raiz
<a função/linha real onde o bug nasce + quantos callers compartilham o mesmo bug (do grep da F2).
 Se há spec: o REQ-ID violado, ou "comportamento nunca especificado".>

## Fix
<arquivo:linha + 1 frase do que mudou. Cite a invariante de context.md que o fix respeita
 e o padrão da camada que ele segue.>

## Regressão
<o teste que falhava antes e passa depois. nome + path (do conventions/testing.md). REQ-x se houver.
 Se foi pulado (escape honesto): "sem teste — <motivo>", registrado como dívida.>

## Tentativas (só se houve circuit breaker)
<as hipóteses que não seguraram, para não repeti-las ao re-hipotetizar. Apague se nunca disparou.>
```

## Regras de preenchimento

- **Persistência incremental.** As hipóteses entram aqui no momento em que surgem (F2), com status `❓`; viram `✅`/`❌` conforme a evidência da F4. O manifesto de instrumentação entra na F3, antes de qualquer reprodução. É o que torna o debug resumível se a sessão morrer.
- **`debug-tag` é o manifesto.** O hash único (`DEBUG-<hash>`) aparece no frontmatter e na seção de instrumentação. A F8 faz `grep` por ele para remover toda a instrumentação — um hash esquecido é um `console.log` órfão no diff.
- **Sintoma do tipo c precisa de "esperado vs obtido".** Sem erro que grite, o que define o bug é a divergência. Escreva-a explícita.
- **Causa raiz nomeia callers.** O número de callers que compartilham o bug é o que justifica o fix na função compartilhada em vez de no caller nomeado.
- **Regressão é o registro durável.** O `.md` é descartável; o teste no git não. Se o teste foi pulado, a dívida fica escrita aqui — não some no silêncio.
- **`status: resolvido` é um gate real.** Só vira `resolvido` depois da F8 completa: grep-zero dos senders, processo do server morto, `.jsonl` apagado. Enquanto `investigando`, há instrumentação viva no código.
