---
name: debug
description: "Caçar a causa raiz de um bug e aplicar um fix cirúrgico — fora da trilha forward do SDD, acionável a qualquer momento. Use sempre que algo QUEBROU: erro no console, stack trace, exception, erro em tela/UI, request falhando, teste vermelho, fluxo errado, valor/estado incorreto, comportamento inesperado, regressão — ou quando o usuário diz \"tá quebrado\", \"tá dando erro\", \"debugar isso\", \"por que isso não funciona\", \"conserta esse bug\", \"investiga esse problema\". Adapta o Debug Mode (estilo Cursor) ao Claude Code: lê docs/codebase/context.md para achar a camada do bug e não violar invariantes no fix, gera VÁRIAS hipóteses de causa raiz ANTES de qualquer correção, instrumenta o código com logs dirigidos por hipótese (prefixo único, removidos no fim) que enviam evidência a um debug server local, coleta runtime real (server + Playwright MCP para browser, ou o humano reproduzindo) em vez de adivinhar, isola a causa, aplica o menor fix possível na raiz (não no sintoma — grep os callers), verifica reproduzindo de novo + um teste de regressão, e LIMPA toda a instrumentação. Após 3 tentativas falhas, para e re-hipotetiza (circuit breaker). Funciona sem o mapa (modo ungrounded), mas é muito mais eficiente com ele. NÃO use para construir feature nova ou refactor amplo — isso é sdd:spec / sdd:plan / sdd:implement."
---

# SDD — Debug (caça à causa raiz + fix cirúrgico)

## O que esta skill faz, e por que ela existe

Um bug é um sintoma. A tentação — a do Claude cru, a do dev às 3am — é editar a primeira linha plausível e torcer. Isso é a pressa que paga caro: o fix mascara o sintoma, o bug volta noutro lugar, e o diff vira lixo. Esta skill troca o palpite por **evidência de runtime**: gera hipóteses, instrumenta o código para testá-las, faz o bug rodar de verdade, lê o que realmente aconteceu, e só então corrige — na raiz, com o menor diff possível, provando o fix antes de declará-lo.

É a **anti-skill** das outras quatro do SDD. Elas são *forward* (ideia → spec → plan → código), exaustivas, com gates. Esta é *backward* (sintoma → causa → fix), rápida, cirúrgica. Mas herda o DNA por inteiro — incluindo o que mais falta no Claude cru: **o orquestrador é puro.** Um subagente fresco por leitura, por instrumentação, por fix, por prova — **obrigatório mesmo para um único fix de uma linha**; o orquestrador **nunca lê source nem edita código no próprio contexto**, só comissiona subagentes, lê os digests e os veredictos, e sintetiza. (`pure orchestrator — one fresh subagent per read, per fix, per proof, mandatory even for a single fix; never coding or analyzing in its own context`, igual a `sdd:implement`/`sdd:plan`.) Lê o mapa da codebase, persiste incremental, e prova o que afirma — nunca declara resolvido sem prova técnica **e** confirmação humana.

**O eixo rápido-vs-rigor resolve-se assim: o rigor É o atalho.** Hipóteses-primeiro não é lentidão — é o que evita três fixes errados em sequência. Causa raiz não é cerimônia — é o diff menor (uma guarda na função compartilhada é menos código que uma guarda em cada caller). A pressa que funciona é hipótese-primeiro; pular pro fix é a pressa que te paga às 3am.

Esta skill lê o mapa e specs como input, e escreve apenas um report leve sob `docs/specs/<feature>/debug-<slug>.md` ou `docs/debug/<slug>.md` (mais o `.jsonl` efêmero de captura, removido no fim). Nunca toca o mapa.

## Antes de tudo — ground e idioma

Leia `docs/codebase/context.md` primeiro (só ele — é leve, ~500 tokens). Ele te dá três coisas que mudam o debug:
- **Invariantes enforced** (tabela invariante → mecanismo com path real): o fix **não pode violar** nenhuma. "Consertar" furando o boundary do lint quebra o build — pior que o bug original.
- **Carregamento por tarefa** + **Catálogo**: mapeiam o sintoma à camada onde ele vive, e dizem qual doc ler para entender o padrão daquela camada (lido depois, via subagente).
- **Stack**: para saber em que runtime você está instrumentando.

**Degradação graciosa — debug é emergencial, nunca recuse:**
- Sem `docs/codebase/context.md` → avise: *"Mapa ausente — seria mais eficiente e seguro com ele (rode `sdd:codebase`). Prossigo em modo ungrounded."* e **continue**. Diferente de `sdd:plan`/`sdd:implement` que recusam sem precondição: recusar um debug seria hostil. O risco do modo ungrounded (pode violar uma invariante invisível no fix) você declara no report.
- Sem `docs/codebase/conventions/testing.md` → escreva o teste de regressão pelo padrão que inferir do repo, e anote a inferência.
- Sem `docs/specs/<feature>/` → debugue sem o "esperado" contratual; use o esperado que o humano descrever. É o caso comum — a maioria dos bugs não está numa feature especificada.

**Trave o idioma agora.** Detecte o idioma do prompt inicial do usuário. Português → todo o diálogo e o report em português. Inglês → tudo em inglês. Registre em `lang:` no frontmatter do report. Nunca misture nem troque no meio. (Mesmo padrão de `sdd:spec`.)

## Onde esta skill brilha — e onde ela não é a ferramenta certa

O método (instrumentar → reproduzir → ler runtime) é imbatível quando o bug é **reproduzível e observável em código**: race conditions e bugs de timing assíncrono, inconsistências de UI (hydration SSR, mismatch cliente/servidor), fluxos silenciosos que dão o valor errado, regressões. Nesses casos a evidência de runtime acha o que três code reviews não acharam.

Mas o pré-requisito é **conseguir reproduzir o bug** — é a limitação central do Debug Mode (testemunho unânime das reviews do Cursor: "many bugs are hard to trigger, and those are exactly the bugs Debug Mode cannot solve"). Quando o bug **não reproduz sob instrumentação**, não force o método; diga ao humano e mude de abordagem:
- **Intermitente / só em produção / não reproduzível localmente** → instrumentar não captura o que não roda. Colete o que existe (logs de produção, traces) ou peça ao humano um caminho de reprodução antes de seguir.
- **Memory leak / profiling de memória** → é trabalho de heap snapshot (DevTools, profiler), não de log de fronteira.
- **Causa fora do código** (hardware, adapter defeituoso, config de ambiente, rede) → a instrumentação vai "culpar" o código errado. Se as hipóteses de código se esgotam, levante a possibilidade de causa externa em vez de instrumentar mais fundo.

Reconhecer cedo que o bug está fora do alcance do método é parte da disciplina — evita instrumentar no escuro um bug que nunca vai aparecer no `.jsonl`.

## O fluxo — oito fases, um funil com gate

Cada fase consome o que a anterior produziu; você não avança sem isso. **Sem atalho: até um null check de uma linha passa pelo fluxo completo — os gates SÃO o valor.** Foi exatamente o atalho que falhou nas execuções reais (pulou hipóteses, não criou o report, não fez TDD, declarou resolvido sem provar). Não há fast-path.

**A skill não é cerimônia — é orquestração.** A pureza do orquestrador e o gate de fechamento são o que faltou e o que não negocia; **o número de subagentes intermediários colapsa para o tamanho do bug.** Um bug localizado de uma hipótese pode ser **um único fix-executor** que instrumenta, confirma, corrige e prova num só briefing — não são 8 subagentes para um null check. O que nunca colapsa é o gate de fechamento (closing-gate + confirmação humana).

### F0 — Grounding
Leia `context.md` (acima), trave o idioma, e veja se o bug cai numa `docs/specs/<feature>/` existente (anote para a F5 — saber o comportamento *esperado* muda o fix). Esta é a única leitura de disco que o orquestrador faz no próprio contexto; todo o resto (source, specs, testing.md) vai por subagente.

### F1 — Triagem e captura do sintoma
**Leia a mensagem de erro / stack trace até o fim, ANTES de hipotetizar.** Mensagens de erro frequentemente contêm a solução exata; pular a leitura para teorizar é o erro nº 1. Então:

- **Classifique o bug em um tipo** (isto roteia a captura — ver `references/runtime-capture.md`):
  - **(a) backend / console / terminal** — exception, stack trace, log de erro, teste vermelho, processo que crasha.
  - **(b) frontend / tela** — erro no console do browser, request que falha na UI, render quebrado, tela branca.
  - **(c) fluxo errado / silencioso** — sem erro, mas resultado errado: valor incorreto, branch não tomado, ordem trocada, estado divergente. O mais traiçoeiro — nada grita.
- **Capture o "fato 0" exato:** a mensagem literal, o arquivo:linha do topo do stack, o valor errado *vs* o esperado. É o que ancora as hipóteses.
- **Peça ao humano via `AskUserQuestion`:** o repro mínimo (*como eu disparo isso?*) e o artefato que ele já tem (*tem o stack/log/screenshot? cola aqui*) — porque a evidência que o humano já possui é a captura mais barata que existe.
- **Minimize o repro:** encolha ao menor cenário que ainda fica vermelho — mantenha só o que é load-bearing para a falha. Um repro minimizado torna as hipóteses mais nítidas e o `.jsonl` menos ruidoso. **Esse repro minimizado costuma virar, literalmente, o teste RED do fix-executor na F6** — não é trabalho jogado fora, é o teste de regressão nascendo cedo.

### F2 — Hipóteses múltiplas (o coração)
**Antes de qualquer fix**, gere **2 a 5 hipóteses de causa raiz** distintas. Cada uma:
- uma frase de mecanismo ("`x` é null porque o upstream `Y` não preenche no caso `Z`"),
- a **camada/arquivo** onde provavelmente vive (do mapeamento da F0),
- como você a **distinguiria** das outras (qual evidência a confirma ou refuta).

**Delegue a leitura de código a um subagente `Explore` — nunca leia source no seu próprio contexto.** Para localizar onde cada hipótese vive, despache `Explore` para ler o código ao redor do sintoma e **fazer grep dos callers** da função suspeita (root-cause, não sintoma: quantos chamam isso? todos têm o mesmo bug?). Você recebe o digest — trechos relevantes e a lista de callers — não os bytes. O contexto do orquestrador fica limpo.

**Persista já:** grave as hipóteses no report com status `❓ não testada`. Se a sessão morrer, elas sobrevivem.

**Regra anti-pulo (inegociável, sem exceção):** se você está prestes a comissionar um fix-executor e ainda **não tem evidência de runtime que confirme uma hipótese, PARE — você está adivinhando.** O Debug Mode não chuta; coleta. Vá para F3. (As frases-armadilha que sinalizam que você voltou a adivinhar estão em `references/hypothesis-discipline.md` — leia-o quando sentir a tentação do "vou só tentar esse fix rápido".)

### F3 — Instrumentação dirigida + sobe o debug server (comissionada)
**O orquestrador comissiona a instrumentação a um subagente — não injeta senders no próprio contexto** (`the orchestrator commissions the instrumentation; it doesn't inject senders in its own context`). O subagente sobe o debug server (`scripts/debug-server.js`) em background — o canal de captura padrão (o Cursor faz idêntico: "spins up an HTTP server to listen to these logs") — e injeta, nos pontos que o digest da F2 apontou como os que **distinguem as hipóteses**, um *sender* que faz `POST` ao server com payload estruturado: `{tag: "DEBUG-<hash>", hyp: "H2", var: "...", value: ..., file: "...", line: NN}`. Cada inserção leva um **comentário-âncora** na linha de cima — `// DEBUG-<hash> (sdd:debug) — remover na limpeza` — para que a remoção da F8 seja inequívoca. O `<hash>` é um identificador único de 4 caracteres desta sessão (ex: `a4f2`). O subagente devolve o **manifesto preenchido** (hash, arquivos:linha instrumentados, porta, caminho do `.jsonl`); o orquestrador grava no report sem ver os bytes do source.

> **Reuso (ponytail):** o subagente de instrumentação é o **mesmo tipo do fix-executor** — editar arquivos por briefing, marcar com âncoras, devolver manifesto é a mesma operação. Não invente um terceiro papel. Para um bug localizado, instrumentação e fix podem ser **um único fix-executor** num só briefing.

O briefing do subagente é **~500 tokens, self-contained, execution-ready**: os pontos a instrumentar (do digest F2), o hash da sessão, o comando para subir o server. Os logs são **dirigidos por hipótese, não aleatórios** — instrumentação alvo, não spam de `console.log`: cada um imprime exatamente o que confirma ou refuta uma hipótese (o valor da variável suspeita, qual branch foi tomado, o timing, o estado na fronteira entre camadas). Instrumentação **mínima** (3–5 pontos que separam as hipóteses, não dezenas). O sender por linguagem, o lifecycle do server e o fallback de file-write estão em `references/runtime-capture.md`.

**Persista o manifesto de limpeza** no report: o `DEBUG-<hash>`, os arquivos instrumentados, a porta do server e o caminho do `.jsonl`. É o que a F8 vai remover — sem ele, instrumentação órfã fica para sempre se a sessão cair.

### F4 — Reprodução + coleta (humano dispara / agente coleta)
**Se a app precisa reiniciar para carregar a instrumentação** (servidor backend, build de front, processo long-running), peça o restart antes de reproduzir — o Cursor faz esse passo explícito ("restart the application and reproduce the bug"). Então faça o bug rodar e capture a evidência. **Quem dispara depende do repro:**
- **Roteirizável** (um teste, um `curl`, um `browser_navigate`) → o agente dispara sozinho.
- **Manual** (precisa de login real, estado montado à mão, hardware) → o humano dispara na app real; o agente observa. É o "tight back-and-forth": o agente faz o trabalho tedioso, o humano dá os passos que só ele tem.

**A captura é o `.jsonl`:** leia `docs/debug/<slug>.jsonl` (estruturado, parseável, independente de qual processo/terminal emitiu — e unifica backend e frontend num canal só). Para o tipo (b), complemente com Playwright (`browser_console_messages`, `browser_network_requests`, `browser_take_screenshot`) para o que o log não vê — o visual. Detalhes e o ranking de como automatizar o repro em `references/runtime-capture.md`.

**Confronte cada registro com as hipóteses:** atualize no report `✅ confirmada` / `❌ refutada` + a evidência (a linha exata do `.jsonl`). Nenhuma confirmada e os logs não bastam? → volte à F3 com instrumentação mais fina — **isso conta como 1 tentativa do circuit breaker.** Uma confirmada → F5.

### F5 — Análise / isolamento da causa raiz
Com a hipótese confirmada pela evidência, isole a **causa raiz, não o sintoma.** A pergunta-chave: *o sintoma aparece aqui, mas a causa está na função compartilhada acima? quantos callers têm o mesmo bug?* — use o grep de callers da F2. O fix vai na raiz por onde todos passam, não no caller que o ticket nomeou.

- **Se a F0 achou uma spec:** delegue a um `Explore` ler os REQ-IDs e critérios de aceite relevantes — para saber o comportamento que *era* contratado. O bug viola REQ-x, ou é comportamento nunca especificado? Isso muda o fix.
- **Cheque invariantes:** a causa raiz toca uma invariante enforced do `context.md`? O fix terá que respeitá-la.

Causa raiz clara e única → F6. Causa ambígua, ou "conserta num lugar e reaparece noutro" → sinal de hipótese errada → circuit breaker.

### F6 — Fix cirúrgico (na raiz, via fix-executor TDD)
**O orquestrador comissiona um fix-executor por fix — não edita código no próprio contexto.** Um subagente fresco, obrigatório mesmo para um one-liner (`spawn a fix-executor anyway`). O briefing é **~500 tokens, self-contained, execution-ready, concrete enough to follow blind**: a causa raiz (F5), os arquivos a tocar, as invariantes enforced a respeitar (F0), o comando de teste do projeto (`docs/codebase/conventions/testing.md`), e o repro minimizado da F1 como ponto de partida do teste RED.

O fix-executor roda o **loop estrito test-first idêntico ao `sdd:implement`** — `write the failing test, watch it fail, make it pass, refactor, commit`:
1. **RED** — escreve o teste de regressão no seam certo, **RODA, e vê falhar.** O teste asserta **comportamento observável** (o valor certo, o evento emitido), não o mecanismo do fix. Se há spec, cita o REQ-ID violado.
2. **GREEN** — só então o **menor fix que ataca a causa raiz** (duas ou três linhas, não código especulativo; uma guarda na função compartilhada, não em cada caller). **RODA, e vê passar.**
3. **REFACTOR** — limpa, mantendo verde.
4. **COMMIT** — atômico.

O fix-executor **devolve a saída RED e a saída GREEN como prova** — o orquestrador cola ambas na seção "Prova TDD" do report. Sem RED antes do GREEN, o teste passou trivialmente e não prova nada.

**Fronteira honesta:** se o fix exige mudança de arquitetura, é grande, ou cruza várias camadas → **não é um fix rápido, é uma feature/refactor.** Pare e recomende `sdd:spec`/`sdd:plan`. Debug não é a porta dos fundos para mudança grande sem spec.

### F7 — Verificação (absorvida em F6 e F8)
A verificação não é mais uma fase de ação do orquestrador — ela se **dissolve nos gates delegados**: o **teste RED→GREEN** já foi provado pelo fix-executor na F6 (com a saída colada no report); a **re-reprodução do sintoma** é o primeiro passo do closing-gate na F8. Nada aqui o orquestrador roda no próprio contexto.

- **Escape honesto do teste:** o default é o teste RED→GREEN da F6. Mas se o bug é trivial num seam sem suíte, ou um one-liner óbvio onde o teste seria desproporcional, **o fix-executor registra a ausência como dívida explícita no report** em vez de fingir cobertura — e o closing-gate sinaliza essa dívida no veredito.

### F8 — Fechamento + limpeza (gate duplo, inegociável)
Esta é a fase que **faltou** nas execuções reais — a skill declarava resolvido sem provar que o sintoma sumiu. Agora o fechamento exige **prova técnica delegada E confirmação humana**, nenhuma das duas pulável.

**(1) closing-gate subagent — a prova.** O orquestrador comissiona um subagente que **anda a matriz e devolve um veredito estruturado** (`the orchestrator commissions the proof and reads the verdict; it doesn't run the checks in its own context`). O closing-gate prova, nesta ordem:
1. **Re-repro:** roda o **MESMO repro da F4** com o fix — a evidência que antes mostrava o bug agora mostra o comportamento certo. **Prova por reprodução, não por vibe.**
2. **Teste verde:** o teste de regressão da F6 passa.
3. **Limpeza com grep-zero:** mata o processo do debug server (manifesto F3) → **apaga o `.jsonl`** (`docs/debug/<slug>.jsonl`) *antes* do grep, senão o grep acha o próprio `DEBUG-<hash>` dentro do arquivo de captura → remove cada sender E seu comentário-âncora → `grep -rn "DEBUG-<hash>" .` retorna **zero**. Cheque também branches aninhados que não rodaram — o grep-zero é a rede que pega o sender órfão que o `.jsonl` não viu. (`the closing-gate removes the instrumentation and proves grep-zero; the orchestrator reads the verdict`.)

O veredito volta como checklist: `re-repro OK / teste verde / grep-zero OK / server morto / .jsonl apagado`. Veredito vermelho em qualquer item → **não fecha**; volta à fase correspondente (re-repro falhou = hipótese errada → circuit breaker).

**(2) Confirmação humana — o carimbo.** Com o veredito verde em mãos, o orquestrador pergunta ao humano via `AskUserQuestion`: *"o sintoma original que você reportou sumiu de fato?"*. **É a única pergunta de fechamento** (o humano só é consultado nas pontas: repro inicial na F1, confirmação aqui). Sem o "sim", o status fica `fix-aplicado`, não `resolvido`.

**A skill não declara resolvido enquanto** o veredito do closing-gate estiver vermelho OU o humano não tiver confirmado (`won't declare resolved while the verdict is red or the human hasn't confirmed`). Só com **ambos** o report vira `status: resolvido`.

Feche o report e faça o **handoff**: sintoma → causa raiz (arquivo:linha) → evidência que provou → teste verde (RED→GREEN colado) → closing-gate verde → confirmação humana. Se a F5 viu que N callers compartilham o padrão, sinalize: *"a camada X tem o mesmo risco em N callers — vale `sdd:codebase diff` para registrar?"*

## Divisão humano / agente

O orquestrador **comissiona e sintetiza**; ele nunca lê source nem edita código no próprio contexto. Cada linha "subagente" abaixo é um briefing ~500 tokens, self-contained.

| Trabalho | Quem | Por quê |
|---|---|---|
| Classificar o tipo, gerar hipóteses, escolher onde instrumentar, ler digests/veredictos, sintetizar | **Orquestrador** | é raciocínio sobre o digest — o único papel sem leitura/escrita de source |
| Ler o source ao redor do sintoma, grep dos callers, ler spec/REQ/testing.md | **Subagente `Explore`** | mantém o contexto do orquestrador limpo (DNA SDD) |
| Subir o server + injetar os senders de instrumentação | **Subagente `instrumentation-executor`** (mesmo tipo do fix-executor) | escrita em produção sai do orquestrador (R4) |
| Disparar o repro na app real (login, estado manual, hardware) | **Humano** | o agente não tem as credenciais/o ambiente — o "back-and-forth" do Debug Mode |
| Disparar repro roteirizável (teste, curl, `browser_navigate`) + capturar o `.jsonl`/Playwright | **Agente** | determinístico, "the agent handles the tedious work" |
| Decidir se um comportamento é bug ou intencional | **Humano** (`AskUserQuestion`) | é julgamento de produto, não evidência |
| Escrever o teste RED→GREEN + o fix + commitar | **Subagente `fix-executor`** | execução cirúrgica TDD; um por fix, fora do contexto do orquestrador |
| Re-reproduzir + provar teste verde + limpar instrumentação + grep-zero | **Subagente `closing-gate`** | a prova é comissionada, não auto-executada |
| Confirmar que o sintoma original sumiu | **Humano** (`AskUserQuestion`) | o fechamento não é decidido sozinho — carimbo final |

## Circuit breaker — pare antes de empilhar fixes

Cada ciclo "instrumentei/corrigi → reproduzi → não confirmou nenhuma hipótese, ou o fix não segurou" conta como **uma tentativa**. **Após 3 tentativas falhas, PARE** — não tente uma 4ª variação na mesma direção. Em vez disso:
1. Declare ao humano: *"3 hipóteses não seguraram — provável erro de premissa, não de implementação."*
2. **Re-hipotetize do zero (volte à F2)** questionando a premissa: *o sintoma é o que eu acho que é? estou no arquivo certo? o repro reproduz mesmo este bug, ou outro?*
3. Se ainda travar → **escale ao humano com o report completo** (as 3 hipóteses refutadas + evidência) em vez de seguir chutando. Honestidade vence thrashing.

Sem o breaker, um agente "conserta" seis vezes, cada fix mascarando o anterior, e o diff vira lixo. O breaker é o que mantém o fix cirúrgico cirúrgico. Detalhe em `references/hypothesis-discipline.md`.

## Artefato — um report leve e descartável

Grave um bug report leve e incremental (~meia página) seguindo `templates/debug-report.template.md`. Local: `docs/specs/<feature>/debug-<slug>.md` se o bug está numa feature especificada (herda o contexto); senão `docs/debug/<slug>.md`. **Crie-o já na F1/F2** (`status: investigando`) — não no fim. Ele percorre três estados: `investigando` → `fix-aplicado` (GREEN do fix-executor, mas closing-gate/humano ainda não confirmaram) → `resolvido` (só com closing-gate verde **e** confirmação humana).

O report **é o state.md do debug** — não crie um arquivo de estado separado, ele já é o cursor de resumibilidade. Por isso: **reescreva-o no instante em que cada fase fecha — never append**, mantenha-o ~300–400 tokens. É um cursor, não um log; um diário que cresce perde a função. Se a sessão morre, o report no disco diz quais hipóteses já caíram, quais `DEBUG-<hash>` estão soltos, e em que estado o fix está — para não re-decidir o já decidido.

**Por que persistir e não ficar só no chat:** o ganho concreto é **resumibilidade + o manifesto de limpeza**. Se a sessão morre na F4, o report no disco diz quais hipóteses já foram testadas e — crítico — quais `DEBUG-<hash>` estão soltos no código. Sem isso, instrumentação órfã fica para sempre.

**Por que leve e descartável:** é um cursor de caça, não uma spec. O registro durável de verdade é o **teste de regressão no git** — o `.md` é andaime. Diferente de spec/plan (contratos eternos), este artefato pode ser arquivado ou apagado após o fix.

## Por que esta skill, e não só pedir para o Claude debugar

1. **Hipóteses múltiplas forçadas antes do fix.** O Claude cru pula pro primeiro fix plausível; a skill proíbe editar produção sem evidência que confirme uma hipótese. Mata o thrashing.
2. **Evidência de runtime, não adivinhação.** Instrumentação dirigida + captura real (server/Playwright/humano) em vez de "provavelmente é isso".
3. **Causa raiz mecânica.** Grep obrigatório dos callers; fix na função compartilhada. O Claude cru conserta o caller nomeado e deixa os irmãos quebrados.
4. **Não viola invariantes no fix.** Lê as invariantes enforced do `context.md`; o Claude cru "conserta" furando o lint e quebra o build.
5. **Prova o fix — e a prova é comissionada, não auto-declarada.** closing-gate (re-repro + teste RED→GREEN + grep-zero) **mais** confirmação humana do sintoma. O Claude cru diz "deve estar resolvido"; aqui a sessão não fecha sem os dois.
6. **Limpa atrás de si.** Grep-zero do `DEBUG-<hash>` + server morto + `.jsonl` removido. O Claude cru deixa `console.log` órfão no diff.
7. **Circuit breaker.** Para e re-pensa em vez de empilhar fixes.
8. **Resumível.** O report leve salva a caça e a limpeza se a sessão morrer.
9. **Conhece o esperado.** Lê spec/REQ-IDs quando o bug está numa feature; sabe se viola um contrato ou é comportamento novo.

Nas reviews do Debug Mode do Cursor, esse método pegou race conditions que passaram por três code reviews e resolveu bugs de timezone/hydration em minutos onde o print-debugging manual levava dezenas — porque evidência de runtime acha o que a leitura de código sozinha não acha. Esta skill traz esse loop para o Claude Code, com a conexão à codebase do SDD por cima.

## O que esta skill não deve fazer

- **Não corrigir sem evidência.** Sem hipótese confirmada por runtime, você está adivinhando. Sem exceção — não há fast-path.
- **Não editar código no próprio contexto.** Comissione um fix-executor mesmo para um one-liner. O orquestrador lê digests e veredictos, não bytes de source.
- **Não escrever o fix antes do teste vermelho.** Strict test-first: o fix-executor vê o RED falhar antes do GREEN. Teste escrito depois passa trivialmente e não prova nada.
- **Não declarar resolvido sem o gate duplo.** Closing-gate verde (re-repro + teste + grep-zero) **E** confirmação humana do sintoma. Sem os dois, o status fica `fix-aplicado`.
- **Não corrigir o sintoma.** Grep os callers; vá à raiz onde todos passam.
- **Não virar feature.** Fix que exige arquitetura/cruza camadas → recomende `sdd:spec`/`sdd:plan`.
- **Não deixar instrumentação para trás.** O closing-gate prova grep-zero, server morto, `.jsonl` apagado.
- **Não trocar de idioma** no meio. Trave do prompt inicial.
- **Não empilhar tentativas.** 3 falhas → circuit breaker.

## Common mistakes

| Mistake | Fix |
|---|---|
| Pular pro fix sem reproduzir nem coletar evidência | Hipóteses primeiro (F2), instrumente (F3), faça rodar (F4). Sem runtime que confirme, você adivinha. |
| Ler meia mensagem de erro e teorizar | Leia o stack até o fim antes de hipotetizar — a solução costuma estar ali. |
| Consertar o caller que o ticket nomeou | Grep todos os callers; o fix vai na função compartilhada (causa raiz, não sintoma). |
| Instrumentar com logs genéricos | Cada log é dirigido por hipótese — imprime o que distingue H1 de H2. |
| "É um fix minúsculo, faço eu mesmo no meu contexto" | Spawn a fix-executor anyway — pure orchestrator, sem exceção nem pro one-liner. |
| Orquestrador lê source / injeta sender / edita fix | Comissione: `Explore` lê, `instrumentation-executor` injeta, `fix-executor` edita, `closing-gate` limpa. O orquestrador lê o digest e o veredito. |
| Escrever o fix e depois o teste | Strict test-first: write the failing test, watch it fail (RED), só então o fix, watch it pass (GREEN), refactor, commit. Cole RED e GREEN. |
| Declarar resolvido porque o teste passou | closing-gate prova re-repro + grep-zero, **E** o humano confirma que o sintoma sumiu. Sem os dois, status fica `fix-aplicado`. |
| Esquecer `console.log`/senders no diff | O closing-gate, em ordem: mata o server, apaga o `.jsonl`, então grep-zero do `DEBUG-<hash>` no código. |
| Grep-zero nunca fecha | Apague o `.jsonl` antes do grep — senão ele acha o próprio tag dentro do arquivo de captura. |
| Empilhar um 4º fix na mesma direção | 3 falhas → pare, re-hipotetize a premissa, escale com o report. |
| "Consertar" violando uma invariante enforced | Cheque a tabela do `context.md`; o fix respeita o boundary, não o fura. |
| Recusar porque falta o mapa | Debug é emergencial — degrade para ungrounded, avise, e declare o risco no report. |
| Transformar o debug numa feature sem spec | Fix grande/arquitetural → fronteira honesta: recomende `sdd:spec`/`sdd:plan`. |
| Instrumentar no escuro um bug que não reproduz | Se não reproduz sob instrumentação (intermitente, só-produção, memory leak, hardware), diga ao humano e mude de abordagem — é a limitação central do método. |
