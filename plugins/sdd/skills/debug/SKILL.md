---
name: debug
description: "Caçar a causa raiz de um bug e aplicar um fix cirúrgico — fora da trilha forward do SDD, acionável a qualquer momento. Use sempre que algo QUEBROU: erro no console, stack trace, exception, erro em tela/UI, request falhando, teste vermelho, fluxo errado, valor/estado incorreto, comportamento inesperado, regressão — ou quando o usuário diz \"tá quebrado\", \"tá dando erro\", \"debugar isso\", \"por que isso não funciona\", \"conserta esse bug\", \"investiga esse problema\". Adapta o Debug Mode (estilo Cursor) ao Claude Code: lê docs/codebase/context.md para achar a camada do bug e não violar invariantes no fix, gera VÁRIAS hipóteses de causa raiz ANTES de qualquer correção, instrumenta o código com logs dirigidos por hipótese (prefixo único, removidos no fim) que enviam evidência a um debug server local, coleta runtime real (server + Playwright MCP para browser, ou o humano reproduzindo) em vez de adivinhar, isola a causa, aplica o menor fix possível na raiz (não no sintoma — grep os callers), verifica reproduzindo de novo + um teste de regressão, e LIMPA toda a instrumentação. Após 3 tentativas falhas, para e re-hipotetiza (circuit breaker). Funciona sem o mapa (modo ungrounded), mas é muito mais eficiente com ele. NÃO use para construir feature nova ou refactor amplo — isso é sdd:spec / sdd:plan / sdd:implement."
---

# SDD — Debug (caça à causa raiz + fix cirúrgico)

## O que esta skill faz, e por que ela existe

Um bug é um sintoma. A tentação — a do Claude cru, a do dev às 3am — é editar a primeira linha plausível e torcer. Isso é a pressa que paga caro: o fix mascara o sintoma, o bug volta noutro lugar, e o diff vira lixo. Esta skill troca o palpite por **evidência de runtime**: gera hipóteses, instrumenta o código para testá-las, faz o bug rodar de verdade, lê o que realmente aconteceu, e só então corrige — na raiz, com o menor diff possível, provando o fix antes de declará-lo.

É a **anti-skill** das outras quatro do SDD. Elas são *forward* (ideia → spec → plan → código), exaustivas, com gates. Esta é *backward* (sintoma → causa → fix), rápida, cirúrgica. Mas herda o DNA: orquestra delegando leitura de código a subagentes, lê o mapa da codebase, persiste incremental, e prova o que afirma.

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

Cada fase consome o que a anterior produziu; você não avança sem isso. Há um **`[FAST-PATH]`** para bugs triviais (o stack trace aponta uma causa óbvia e localizada — um arquivo, um erro de tipo claro, um import faltando): nesse caso pule F2–F4 e vá direto ao fix (F6), depois verifique (F7) e — se houver instrumentação — limpe (F8). O fast-path existe para não burocratizar um typo; o critério é estrito (1 arquivo, causa óbvia no stack), e na dúvida você NÃO está no fast-path.

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
- **Minimize o repro:** encolha ao menor cenário que ainda fica vermelho — mantenha só o que é load-bearing para a falha. Um repro minimizado torna as hipóteses mais nítidas e o `.jsonl` menos ruidoso.
- **Decisão fast-path:** stack aponta causa óbvia e localizada? → `[FAST-PATH]` → F6.

### F2 — Hipóteses múltiplas (o coração)
**Antes de qualquer fix**, gere **2 a 5 hipóteses de causa raiz** distintas. Cada uma:
- uma frase de mecanismo ("`x` é null porque o upstream `Y` não preenche no caso `Z`"),
- a **camada/arquivo** onde provavelmente vive (do mapeamento da F0),
- como você a **distinguiria** das outras (qual evidência a confirma ou refuta).

**Delegue a leitura de código a um subagente `Explore` — nunca leia source no seu próprio contexto.** Para localizar onde cada hipótese vive, despache `Explore` para ler o código ao redor do sintoma e **fazer grep dos callers** da função suspeita (root-cause, não sintoma: quantos chamam isso? todos têm o mesmo bug?). Você recebe o digest — trechos relevantes e a lista de callers — não os bytes. O contexto do orquestrador fica limpo.

**Persista já:** grave as hipóteses no report com status `❓ não testada`. Se a sessão morrer, elas sobrevivem.

**Regra anti-pulo (inegociável):** se você está prestes a editar código de produção e ainda **não tem evidência de runtime que confirme uma hipótese, PARE — você está adivinhando.** O Debug Mode não chuta; coleta. Vá para F3. (As frases-armadilha que sinalizam que você voltou a adivinhar estão em `references/hypothesis-discipline.md` — leia-o quando sentir a tentação do "vou só tentar esse fix rápido".) Exceção: `[FAST-PATH]`.

### F3 — Instrumentação dirigida + sobe o debug server
Suba o debug server (`scripts/debug-server.js`) em background — é o canal de captura padrão (o Cursor faz idêntico: "spins up an HTTP server to listen to these logs"). Injete, nos pontos que **distinguem as hipóteses**, um *sender* que faz `POST` ao server com payload estruturado: `{tag: "DEBUG-<hash>", hyp: "H2", var: "...", value: ..., file: "...", line: NN}`. Marque cada inserção com um **comentário-âncora** na linha de cima — `// DEBUG-<hash> (sdd:debug) — remover na limpeza` — para que a remoção da F8 seja inequívoca (o Cursor marca a instrumentação com "clear comments which help the AI clean them up later"; nós fazemos o mesmo). O `<hash>` é um identificador único de 4 caracteres desta sessão (ex: `a4f2`).

Os logs são **dirigidos por hipótese, não aleatórios** — instrumentação alvo, não spam de `console.log`: cada um imprime exatamente o que confirma ou refuta uma hipótese (o valor da variável suspeita, qual branch foi tomado, o timing, o estado na fronteira entre camadas). Mantenha a instrumentação **mínima** (3–5 pontos que separam as hipóteses, não dezenas) — menos ruído no `.jsonl`, menos a limpar. O sender por linguagem, o lifecycle do server e o fallback de file-write (quando não há rede local) estão em `references/runtime-capture.md`.

**Persista o manifesto de limpeza** no report: o `DEBUG-<hash>`, os arquivos instrumentados, a porta do server e o caminho do `.jsonl`. É o que a F8 vai remover — sem ele, instrumentação órfã fica para sempre se a sessão cair.

> Esta é a única fase em que o orquestrador escreve no código de produção (prints efêmeros, não lógica). A *leitura* de source continua delegada à F2; aqui você só insere os senders nos pontos que o digest da F2 já apontou.

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

### F6 — Fix cirúrgico (na raiz)
O **menor fix que ataca a causa raiz** — uma correção precisa de duas ou três linhas, não centenas de linhas de código especulativo. Uma guarda na função compartilhada, não em cada caller. Respeite as invariantes enforced (F0/F5) e siga o padrão da camada, citando o doc do mapa (como `sdd:plan` faz: *"segue o error-handling de patterns/..."*). `[FAST-PATH]` reentra aqui.

**Fronteira honesta:** se o fix exige mudança de arquitetura, é grande, ou cruza várias camadas → **não é um fix rápido, é uma feature/refactor.** Pare e recomende `sdd:spec`/`sdd:plan`. Debug não é a porta dos fundos para mudança grande sem spec.

### F7 — Verificação (reproduzir de novo + teste de regressão)
Dois passos, ambos obrigatórios:
- **(7a) Re-rode o MESMO repro da F4** com o fix. A evidência de runtime que antes mostrava o bug agora mostra o comportamento certo. **Prova por reprodução, não por vibe.**
- **(7b) Teste de regressão no seam certo.** Escreva um teste que **falha ANTES do fix e passa DEPOIS** (RED→GREEN — a mesma disciplina do `sdd:implement`). Local, nome e comando vêm de `docs/codebase/conventions/testing.md` (o contrato do projeto, não o seu gosto). Se há spec, o teste cita o REQ-ID que o bug violava. O teste deve asserir **comportamento observável** (o valor certo, o evento emitido), não o mecanismo do fix.
  - **Escape honesto:** o default é escrever o teste — é o que diferencia "fix que volta semana que vem" de "fix provado". Mas se o bug é trivial num seam sem suíte, ou um one-liner óbvio onde o teste seria desproporcional, **registre a ausência como dívida explícita no report** em vez de fingir cobertura.

### F8 — Limpeza (não-negociável, três gates)
O Debug Mode termina deixando *"a clean, minimal change"*. Instrumentação esquecida é exatamente o lixo que o SDD odeia. Três passos, todos verificáveis, **nesta ordem**:
1. **Mate o processo do debug server** (o do manifesto da F3).
2. **Apague o `.jsonl`** de captura (`docs/debug/<slug>.jsonl`) — é evidência efêmera de runtime, não pertence ao git. (Apague-o *antes* do grep do passo 3, senão o grep acha o próprio `DEBUG-<hash>` dentro do `.jsonl` e o grep-zero nunca fecha.) O report `.md` **permanece** (registro durável da caça).
3. **Remova os senders e prove com grep-zero:** apague cada sender E seu comentário-âncora dos arquivos do manifesto, então `grep -rn "DEBUG-<hash>" . --exclude-dir=docs/debug` (ou após o passo 2, sem o `.jsonl`, um `grep -rn` simples já basta) deve retornar **zero**. O hash único + o comentário-âncora tornam isso mecânico e completo. **Cheque também componentes aninhados** — um sender esquecido num branch que não rodou não aparece no `.jsonl`, mas aparece no grep; o grep-zero é a rede que pega isso. Shipar log de debug para produção é o acidente clássico do Debug Mode — o grep-zero existe para que ele não aconteça (se o projeto tiver um pre-commit hook, vale adicionar um guard contra `DEBUG-` no diff).

Feche o report (`status: resolvido`) e faça o **handoff**: sintoma → causa raiz (arquivo:linha) → evidência que provou → teste de regressão verde → server morto + grep-zero + `.jsonl` removido. Se a F5 viu que N callers compartilham o padrão, sinalize: *"a camada X tem o mesmo risco em N callers — vale `sdd:codebase diff` para registrar?"*

## Divisão humano / agente

| Trabalho | Quem | Por quê |
|---|---|---|
| Classificar o tipo, gerar hipóteses, escolher onde instrumentar | **Agente (orquestrador)** | é raciocínio sobre o digest |
| Ler o source ao redor do sintoma, grep dos callers, ler spec/testing.md | **Subagente `Explore`** | mantém o contexto do orquestrador limpo (DNA SDD) |
| Disparar o repro na app real (login, estado manual, hardware) | **Humano** | o agente não tem as credenciais/o ambiente — o "back-and-forth" do Debug Mode |
| Disparar repro roteirizável (teste, curl, `browser_navigate`) | **Agente** | determinístico, não precisa de humano |
| Capturar o canal (`.jsonl` do server, Playwright) | **Agente** | "the agent handles the tedious work" |
| Decidir se um comportamento é bug ou intencional | **Humano** (`AskUserQuestion`) | é julgamento de produto, não evidência |
| Escrever o fix + o teste de regressão + limpar a instrumentação | **Agente** | é a execução cirúrgica |

## Circuit breaker — pare antes de empilhar fixes

Cada ciclo "instrumentei/corrigi → reproduzi → não confirmou nenhuma hipótese, ou o fix não segurou" conta como **uma tentativa**. **Após 3 tentativas falhas, PARE** — não tente uma 4ª variação na mesma direção. Em vez disso:
1. Declare ao humano: *"3 hipóteses não seguraram — provável erro de premissa, não de implementação."*
2. **Re-hipotetize do zero (volte à F2)** questionando a premissa: *o sintoma é o que eu acho que é? estou no arquivo certo? o repro reproduz mesmo este bug, ou outro?*
3. Se ainda travar → **escale ao humano com o report completo** (as 3 hipóteses refutadas + evidência) em vez de seguir chutando. Honestidade vence thrashing.

Sem o breaker, um agente "conserta" seis vezes, cada fix mascarando o anterior, e o diff vira lixo. O breaker é o que mantém o fix cirúrgico cirúrgico. Detalhe em `references/hypothesis-discipline.md`.

## Artefato — um report leve e descartável

Grave um bug report leve e incremental (~meia página) seguindo `templates/debug-report.template.md`. Local: `docs/specs/<feature>/debug-<slug>.md` se o bug está numa feature especificada (herda o contexto); senão `docs/debug/<slug>.md`. Ele nasce na F1/F2 (`status: investigando`), atualiza a cada fase, e fecha na F8 (`resolvido`).

**Por que persistir e não ficar só no chat:** o ganho concreto é **resumibilidade + o manifesto de limpeza**. Se a sessão morre na F4, o report no disco diz quais hipóteses já foram testadas e — crítico — quais `DEBUG-<hash>` estão soltos no código. Sem isso, instrumentação órfã fica para sempre.

**Por que leve e descartável:** é um cursor de caça, não uma spec. O registro durável de verdade é o **teste de regressão no git** — o `.md` é andaime. Diferente de spec/plan (contratos eternos), este artefato pode ser arquivado ou apagado após o fix.

## Por que esta skill, e não só pedir para o Claude debugar

1. **Hipóteses múltiplas forçadas antes do fix.** O Claude cru pula pro primeiro fix plausível; a skill proíbe editar produção sem evidência que confirme uma hipótese. Mata o thrashing.
2. **Evidência de runtime, não adivinhação.** Instrumentação dirigida + captura real (server/Playwright/humano) em vez de "provavelmente é isso".
3. **Causa raiz mecânica.** Grep obrigatório dos callers; fix na função compartilhada. O Claude cru conserta o caller nomeado e deixa os irmãos quebrados.
4. **Não viola invariantes no fix.** Lê as invariantes enforced do `context.md`; o Claude cru "conserta" furando o lint e quebra o build.
5. **Prova o fix.** Re-repro + teste RED→GREEN no seam. O Claude cru diz "deve estar resolvido".
6. **Limpa atrás de si.** Grep-zero do `DEBUG-<hash>` + server morto + `.jsonl` removido. O Claude cru deixa `console.log` órfão no diff.
7. **Circuit breaker.** Para e re-pensa em vez de empilhar fixes.
8. **Resumível.** O report leve salva a caça e a limpeza se a sessão morrer.
9. **Conhece o esperado.** Lê spec/REQ-IDs quando o bug está numa feature; sabe se viola um contrato ou é comportamento novo.

Nas reviews do Debug Mode do Cursor, esse método pegou race conditions que passaram por três code reviews e resolveu bugs de timezone/hydration em minutos onde o print-debugging manual levava dezenas — porque evidência de runtime acha o que a leitura de código sozinha não acha. Esta skill traz esse loop para o Claude Code, com a conexão à codebase do SDD por cima.

## O que esta skill não deve fazer

- **Não corrigir sem evidência.** Sem hipótese confirmada por runtime, você está adivinhando (exceto `[FAST-PATH]`).
- **Não corrigir o sintoma.** Grep os callers; vá à raiz onde todos passam.
- **Não virar feature.** Fix que exige arquitetura/cruza camadas → recomende `sdd:spec`/`sdd:plan`.
- **Não deixar instrumentação para trás.** F8 é gate: grep-zero, server morto, `.jsonl` apagado.
- **Não ler source no próprio contexto.** Delegue a `Explore`; fique com o digest.
- **Não trocar de idioma** no meio. Trave do prompt inicial.
- **Não empilhar tentativas.** 3 falhas → circuit breaker.

## Common mistakes

| Mistake | Fix |
|---|---|
| Pular pro fix sem reproduzir nem coletar evidência | Hipóteses primeiro (F2), instrumente (F3), faça rodar (F4). Sem runtime que confirme, você adivinha. |
| Ler meia mensagem de erro e teorizar | Leia o stack até o fim antes de hipotetizar — a solução costuma estar ali. |
| Consertar o caller que o ticket nomeou | Grep todos os callers; o fix vai na função compartilhada (causa raiz, não sintoma). |
| Instrumentar com logs genéricos | Cada log é dirigido por hipótese — imprime o que distingue H1 de H2. |
| Ler source no contexto do orquestrador | Delegue a `Explore`; fique só com o digest e o grep dos callers. |
| Declarar "deve estar resolvido" | (7a) re-rode o repro + (7b) teste RED→GREEN no seam do testing.md. Prova, não vibe. |
| Esquecer `console.log`/senders no diff | F8 em ordem: mate o server, apague o `.jsonl`, então grep-zero do `DEBUG-<hash>` no código. |
| Grep-zero nunca fecha | Apague o `.jsonl` antes do grep — senão ele acha o próprio tag dentro do arquivo de captura. |
| Empilhar um 4º fix na mesma direção | 3 falhas → pare, re-hipotetize a premissa, escale com o report. |
| "Consertar" violando uma invariante enforced | Cheque a tabela do `context.md`; o fix respeita o boundary, não o fura. |
| Burocratizar um typo com 8 fases | `[FAST-PATH]`: causa óbvia e localizada no stack → direto ao fix + verificação. |
| Recusar porque falta o mapa | Debug é emergencial — degrade para ungrounded, avise, e declare o risco no report. |
| Transformar o debug numa feature sem spec | Fix grande/arquitetural → fronteira honesta: recomende `sdd:spec`/`sdd:plan`. |
| Instrumentar no escuro um bug que não reproduz | Se não reproduz sob instrumentação (intermitente, só-produção, memory leak, hardware), diga ao humano e mude de abordagem — é a limitação central do método. |
