---
name: debug
description: "Caçar a causa raiz de um bug e aplicar um fix cirúrgico — fora da trilha forward do SDD, acionável a qualquer momento. Use sempre que algo QUEBROU: erro no console, stack trace, exception, erro em tela/UI, request falhando, teste vermelho, fluxo errado, valor/estado incorreto, comportamento inesperado, regressão — ou quando o usuário diz \"tá quebrado\", \"tá dando erro\", \"debugar isso\", \"por que isso não funciona\", \"conserta esse bug\", \"investiga esse problema\". Adapta o Debug Mode (estilo Cursor) ao Claude Code: lê docs/codebase/context.md para achar a camada do bug e não violar invariantes no fix, gera VÁRIAS hipóteses de causa raiz ANTES de qualquer correção, instrumenta o código com logs dirigidos por hipótese (prefixo único, removidos no fim) que enviam evidência a um debug server local, coleta runtime real (server + Playwright MCP para browser, ou o humano reproduzindo) em vez de adivinhar, isola a causa, aplica o menor fix possível na raiz (não no sintoma — grep os callers), verifica reproduzindo de novo + um teste de regressão, e LIMPA toda a instrumentação. Após 3 tentativas falhas, para e re-hipotetiza (circuit breaker). Funciona sem o mapa (modo ungrounded), mas é muito mais eficiente com ele. NÃO use para construir feature nova ou refactor amplo — isso é sdd:spec / sdd:plan / sdd:implement."
---

# SDD — Debug (caça à causa raiz + fix cirúrgico)

## O que esta skill faz, e por que ela existe

Um bug é um sintoma. A tentação — a do Claude cru, a do dev às 3am — é editar a primeira linha plausível e torcer. Isso é a pressa que paga caro: o fix mascara o sintoma, o bug volta noutro lugar, e o diff vira lixo. Esta skill troca o palpite por **evidência de runtime**: gera hipóteses, instrumenta o código para testá-las, faz o bug rodar de verdade, lê o que realmente aconteceu, e só então corrige — na raiz, com o menor diff possível, provando o fix antes de declará-lo.

É a **anti-skill** das outras quatro do SDD. Elas são *forward* (ideia → spec → plan → código), exaustivas, com gates. Esta é *backward* (sintoma → causa → fix), rápida, cirúrgica. Mas herda o DNA por inteiro — incluindo o que mais falta no Claude cru: **o orquestrador é puro.** Um subagente fresco por leitura, por instrumentação, por fix, por prova — **obrigatório mesmo para um único fix de uma linha**; o orquestrador **nunca lê source nem edita código no próprio contexto**, só comissiona subagentes, lê os digests e os veredictos, e sintetiza. (`pure orchestrator — one fresh subagent per read, per fix, per proof, mandatory even for a single fix; never coding or analyzing in its own context`, igual a `sdd:implement`/`sdd:plan`.) Lê o mapa da codebase, persiste incremental, e prova o que afirma — nunca declara resolvido sem prova técnica **e** confirmação humana.

**O eixo rápido-vs-rigor resolve-se assim: o rigor É o atalho.** Hipóteses-primeiro não é lentidão — é o que evita três fixes errados em sequência. Causa raiz não é cerimônia — é o diff menor (uma guarda na função compartilhada é menos código que uma guarda em cada caller). A pressa que funciona é hipótese-primeiro; pular pro fix é a pressa que te paga às 3am.

Esta skill lê o mapa e specs como input, e escreve apenas um report leve dentro da pasta da sessão `docs/debug/<slug>/report.md` (ou, se o bug está numa feature especificada, `docs/specs/<feature>/debug-<slug>.md`) — junto com o `session.jsonl` efêmero de captura, removido no fim. Nunca toca o mapa.

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

## O fluxo — oito fases lineares (F0–F8) + uma de re-entrada (F9), um funil com gate

Cada fase consome o que a anterior produziu; você não avança sem isso. **Sem atalho: até um null check de uma linha passa pelo fluxo completo — os gates SÃO o valor.** Foi exatamente o atalho que falhou nas execuções reais (pulou hipóteses, não criou o report, não fez TDD, declarou resolvido sem provar). Não há fast-path. **F9 não é um fim linear: é a porta de re-entrada quando o humano diz "não funcionou" — ela te joga de volta na F2, não te deixa virar Claude cru.** O colapso típico não é pular fases na 1ª execução (essa costuma sair certa); é **abandonar o fluxo inteiro na 2ª rodada**, depois do feedback "ainda quebrado". A F9 existe para impedir exatamente isso.

**A skill não é cerimônia — é orquestração.** A pureza do orquestrador e o gate de fechamento são o que faltou e o que não negocia; **o número de subagentes intermediários colapsa para o tamanho do bug.** Um bug localizado de uma hipótese pode ser **um único fix-executor** que instrumenta, confirma, corrige e prova num só briefing — não são 8 subagentes para um null check. O que nunca colapsa é o gate de fechamento (closing-gate + confirmação humana).

### F0 — Grounding
Leia `context.md` (acima), trave o idioma, e veja se o bug cai numa `docs/specs/<feature>/` existente (anote para a F5 — saber o comportamento *esperado* muda o fix). Esta é a única leitura de disco que o orquestrador faz no próprio contexto; todo o resto (source, specs, testing.md) vai por subagente.

**Crie a pasta da sessão agora:** `docs/debug/<slug>/` — tudo da sessão mora aqui (o report `report.md` E a captura `session.jsonl`), centralizado num só lugar. Em multi-repo, **a pasta fica no repo onde a sessão começou**; a captura dos dois repos converge para o mesmo `session.jsonl` (o debug server é um só). Nada de `.md`/`.jsonl` soltos na raiz de `docs/debug/`.

**Multi-repo — grounding no 2º repo (regra inegociável).** Se o bug cruzar para outro repositório (ex.: o frontend chama um backend que vive noutro repo), **antes de instrumentar esse 2º repo faça um mini-F0 nele**: leia o `docs/codebase/context.md` *dele* (as invariantes enforced são outras), e se houver `docs/specs/<feature>/` correspondente, anote o REQ. **Nunca instrumente um repo cujo mapa você não leu** — você pode violar uma invariante invisível no fix, e o gate de lint/typecheck *daquele* repo quebra o build. (Caso real: um bug que nasceu no portal seguiu para a API; a API tinha o próprio `context.md`, `CLAUDE.md` e specs — ignorá-los é instrumentar às cegas.)

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
**O orquestrador comissiona a instrumentação a um subagente — não injeta senders no próprio contexto** (`the orchestrator commissions the instrumentation; it doesn't inject senders in its own context`).

**Passo 0 da F3 — detecte a stack do repo-alvo ANTES de escolher o sender.** O sender é um `fetch`/POST direto ao debug server, mas a forma certa depende da linguagem e do runtime daquele repo — escolher o sender errado é instrumentar e o `.jsonl` sair vazio. O `context.md` da F0 já te deu a stack; confirme o detalhe que muda o sender: a linguagem (TS/JS, Python, Go, …), o runtime e versão (Node 18+ tem `fetch` nativo; Node antigo não — usa `http.request`), e se o ponto instrumentado roda no **browser** ou no **servidor** (ambos têm `fetch`, mas o browser pode esbarrar em CORS/CSP — aponte o POST para o `localhost:<porta>` do server, que responde a qualquer origem). Em **multi-repo, detecte a stack de CADA repo** — o 2º pode ser outra linguagem/versão. O catálogo de senders por stack (TS/JS com `fetch`, Node antigo, Python, Go, shell) está em `references/runtime-capture.md`; o briefing do `instrumentation-executor` carrega o sender **já escolhido para a stack daquele ponto**, não um genérico. Regra: o sender é sempre um POST estruturado ao server (a metade "server HTTP + fetch direto" do mecanismo), **nunca** `console.log`/stdout solto.

**O que a regra do debug server realmente proíbe é `console.log` solto no stdout** — frágil, some no worker/SSR/container, e fica órfão no diff. O que ela exige é **captura estruturada e rastreável num `.jsonl`**. O debug server (`scripts/debug-server.js`) é o canal default e **obrigatório quando a evidência precisa ser *injetada* no código** (uma variável interna, qual branch foi tomado, timing entre camadas) — aí o sender com `// DEBUG-<hash>` é a forma certa, e há grep-zero para limpar.

**Captura por inspeção direta é canal legítimo — registre-a, não a trate como atalho proibido.** Quando o sintoma é observável *de fora* sem injetar nada no código, prefira inspeção e **anexe a evidência ao `.jsonl`/report**:
- **Frontend / request / render** → Playwright (`browser_network_requests`, `browser_console_messages`, `browser_evaluate`) é a fonte natural — o request/response real, o status, o console. Não instrumente o que a aba Network já mostra.
- **Persistência / "salvou de verdade?"** → consulta direta ao DB (o registro existe? com que valor? `updatedAt` mudou?) é a prova mais forte de que o fluxo chegou ao fim — mais forte que um log no meio do caminho.
- **Estado de runtime já exposto** (um campo no `window`, um header, um arquivo de log que o serviço já escreve) → leia direto.

A regra: **se você precisa CRIAR um ponto de observação dentro do código → debug server + sender** (e a captura vai pro `.jsonl`). **Se o ponto de observação já existe fora do código → inspecione direto e anexe ao report.** Os dois acabam no `.jsonl`/report como evidência citável. O pecado não é "não usei o server"; é "minha 'prova' foi dedução da leitura do código, sem nenhum runtime". Para o caso `console.log`/stdout solto e o fallback de file-write, ver `references/runtime-capture.md`. Quando o sender É necessário, ele aponta para `docs/debug/<slug>/session.jsonl` (a pasta da sessão criada na F0). O subagente injeta, nos pontos que o digest da F2 apontou como os que **distinguem as hipóteses**, um *sender* que faz `POST` ao server com payload estruturado: `{tag: "DEBUG-<hash>", hyp: "H2", var: "...", value: ..., file: "...", line: NN}`. Cada inserção leva um **comentário-âncora** na linha de cima — `// DEBUG-<hash> (sdd:debug) — remover na limpeza` — para que a remoção da F8 seja inequívoca. O `<hash>` é um identificador único de 4 caracteres desta sessão (ex: `a4f2`). O subagente devolve o **manifesto preenchido** (hash, arquivos:linha instrumentados, porta, caminho do `.jsonl`); o orquestrador grava no report sem ver os bytes do source.

> **Reuso (ponytail):** o subagente de instrumentação é o **mesmo tipo do fix-executor** — editar arquivos por briefing, marcar com âncoras, devolver manifesto é a mesma operação. Não invente um terceiro papel. Para um bug localizado, instrumentação e fix podem ser **um único fix-executor** num só briefing.

O briefing do subagente é **~500 tokens, self-contained, execution-ready**: os pontos a instrumentar (do digest F2), o hash da sessão, o comando para subir o server. Os logs são **dirigidos por hipótese, não aleatórios** — instrumentação alvo, não spam de `console.log`: cada um imprime exatamente o que confirma ou refuta uma hipótese (o valor da variável suspeita, qual branch foi tomado, o timing, o estado na fronteira entre camadas). Instrumentação **mínima** (3–5 pontos que separam as hipóteses, não dezenas). O sender por linguagem, o lifecycle do server e o fallback de file-write estão em `references/runtime-capture.md`.

**Persista o manifesto de limpeza** no report: o `DEBUG-<hash>`, os arquivos instrumentados (**com o repo de cada um**, se multi-repo), a porta do server e o caminho do `.jsonl` (`docs/debug/<slug>/session.jsonl`). É o que a F8 vai remover — sem ele, instrumentação órfã fica para sempre se a sessão cair.

### F4 — Reprodução + coleta (humano dispara / agente coleta)
**Reiniciar o serviço-alvo é obrigatório quando ele é long-running** (servidor backend, build de front, watcher). Os senders só passam a postar no debug server **depois do restart** — instrumentar sem reiniciar não captura nada, e o agente fica olhando um `.jsonl` vazio achando que o repro não disparou. O Cursor faz esse passo explícito ("restart the application and reproduce the bug"). Ao reiniciar:
- **Use o runtime que o repo exige.** Cheque `engines`/`.nvmrc`/`package.json` *daquele* repo; um mismatch de Node ou gerenciador barra o boot (ex. real: o gate `engines.node>=24` do pnpm impediu o start — foi preciso o Node certo via nvm e rodar o entrypoint compilado direto). Confirme no stdout do boot que o serviço subiu ("listening on ...").
- **Se você derrubou o processo do dev para reiniciar, anote isso no manifesto e RESTAURE-o ao estado original na F8.** Não deixe o ambiente do humano diferente de como estava.

Então faça o bug rodar e capture a evidência. **Quem dispara depende do repro:**
- **Roteirizável** (um teste, um `curl`, um `browser_navigate`) → o agente dispara sozinho.
- **Repro backend cuja auth vive no browser** (cookie httpOnly, sessão server-side) → **o agente dispara via Playwright**: o browser logado aciona o request que o `curl` não consegue (sem token). Playwright não é só captura visual — é o disparador do fluxo backend quando a sessão está no navegador.
- **Manual** (precisa de login real, estado montado à mão, hardware) → o humano dispara na app real; o agente observa. É o "tight back-and-forth": o agente faz o trabalho tedioso, o humano dá os passos que só ele tem.

**A captura é o `.jsonl`:** leia `docs/debug/<slug>/session.jsonl` (estruturado, parseável, independente de qual processo/terminal emitiu — e unifica backend e frontend num canal só, mesmo em multi-repo). Para o tipo (b), complemente com Playwright (`browser_console_messages`, `browser_network_requests`, `browser_take_screenshot`, e `browser_run_code_unsafe`/`browser_evaluate` para prova de hit-testing) para o que o log não vê — o visual e a geometria. Detalhes e o ranking de como automatizar o repro em `references/runtime-capture.md`.

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
1. **Re-repro:** roda o **MESMO repro da F4** com o fix — a evidência que antes mostrava o bug agora mostra o comportamento certo. **Prova por reprodução, não por vibe.** Esta prova é de **runtime real** (o `.jsonl`/Playwright/o humano disparando o fluxo de verdade), **não** o teste unitário do passo 2. Um teste verde prova que a unidade faz o que o teste afirma; só o re-repro prova que o *sintoma do humano* sumiu no app rodando. Os dois são exigidos e **não se substituem**: declarar resolvido só com teste unitário verde, sem re-repro de runtime, é o erro que reabre o bug. Se o repro depende de um componente difícil de automatizar (ex.: player de vídeo, mapa, canvas, terceiro), **o humano dispara e você observa o `.jsonl`/a UI** — não troque o re-repro por um teste unitário "equivalente".
2. **Teste verde:** o teste de regressão da F6 passa.
3. **Limpeza com grep-zero (por repo):** mata o processo do debug server (manifesto F3) → **apaga o `.jsonl`** (`docs/debug/<slug>/session.jsonl`) *antes* do grep, senão o grep acha o próprio `DEBUG-<hash>` dentro do arquivo de captura → remove cada sender E seu comentário-âncora → `grep -rn "DEBUG-<hash>" .` retorna **zero**. **Multi-repo: o grep-zero roda em CADA repo instrumentado** (o manifesto nomeia o repo de cada sender) — um sender esquecido no 2º repo é um `console.log` órfão que vai para o PR daquele repo. Cheque também branches aninhados que não rodaram — o grep-zero é a rede que pega o sender órfão que o `.jsonl` não viu.
4. **Restaurar o ambiente:** qualquer serviço do dev que você reiniciou/derrubou na F4 volta ao estado original (mesmo runtime, mesmo modo — watch/dev). (`the closing-gate removes the instrumentation and proves grep-zero; the orchestrator reads the verdict`.)

O veredito volta como checklist: `re-repro OK / teste verde / grep-zero OK em cada repo / server morto / .jsonl apagado / serviço(s) do dev restaurado(s)`. Veredito vermelho em qualquer item → **não fecha**; volta à fase correspondente (re-repro falhou = hipótese errada → circuit breaker).

**(2) Confirmação humana — o carimbo.** Com o veredito verde em mãos, o orquestrador pergunta ao humano via `AskUserQuestion`: *"o sintoma original que você reportou sumiu de fato?"*. **É a única pergunta de fechamento** (o humano só é consultado nas pontas: repro inicial na F1, confirmação aqui). Sem o "sim", o status fica `fix-aplicado`, não `resolvido`.

**A skill não declara resolvido enquanto** o veredito do closing-gate estiver vermelho OU o humano não tiver confirmado (`won't declare resolved while the verdict is red or the human hasn't confirmed`). Só com **ambos** o report vira `status: resolvido`.

Feche o report e faça o **handoff**: sintoma → causa raiz (arquivo:linha) → evidência que provou → teste verde (RED→GREEN colado) → closing-gate verde → confirmação humana. Se a F5 viu que N callers compartilham o padrão, sinalize: *"a camada X tem o mesmo risco em N callers — vale `sdd:codebase diff` para registrar?"*

### F9 — Reabertura ("não funcionou", o bug voltou) — RE-ENTRE no fluxo, não vire Claude cru

**Esta é a fase onde a skill mais falha na prática.** O padrão observado: na 1ª execução tudo é seguido à risca; o humano volta e diz *"ainda não funciona"* / *"o progresso não salva"*; e o orquestrador **abandona o fluxo** — passa a editar código no próprio contexto, para de fazer TDD, para de instrumentar, e empilha tentativas de reprodução até o contexto estourar. Isso é o anti-padrão nº 1 desta skill. **Quando o humano reabre, você NÃO está num bug novo nem num modo livre: você re-entra no MESMO fluxo, com o report existente como state.md.**

Gatilho: o humano diz qualquer variação de *"não funcionou / continua quebrado / o bug voltou / ainda dá erro"* **depois** de um `fix-aplicado` ou `resolvido`. No instante em que isso acontece:

1. **PARE de editar.** Não toque em código ainda. A tentação de "só mais um ajuste rápido" é exatamente o colapso. O fix anterior foi baseado numa hipótese que o runtime agora **refutou** — você não tem hipótese confirmada para o novo estado.
2. **A reabertura conta como tentativa do circuit breaker** (ver seção dedicada) — some-a às tentativas da sessão. Se isto leva o total a 3, dispare o circuit breaker AGORA: re-hipotetize a premissa do zero antes de qualquer fix.
3. **Re-entre na F2 com o report como state.md.** Releia as hipóteses já marcadas `✅/❌`. O fato de o fix não ter segurado é **evidência nova**: ou a hipótese confirmada estava incompleta (havia uma 2ª causa em série), ou a "confirmação" da F4 era fraca (você nunca viu o runtime real — ver R-runtime abaixo). Gere hipóteses para o **novo** estado observado.
4. **Volte a instrumentar (F3) com o debug server** para o ponto exato que o humano descreve — não adivinhe pela leitura. Se o sintoma é "X não dispara", instrumente o caminho de X e prove com runtime ANTES de propor o fix. O humano relata o sintoma; o `.jsonl` diz a causa.
5. **O novo fix é um novo fix-executor com TDD** (F6) — o teste de regressão da rodada anterior claramente não cobria o caso real, então o RED da nova rodada é o caso que o humano acabou de descrever.
6. **O closing-gate (F8) roda de novo, inteiro.** Reabertura invalida o veredito verde anterior. Sem novo closing-gate verde + nova confirmação humana, o status volta a `fix-aplicado`.

**Regra dura de fechamento sob reabertura:** enquanto o humano disser que não funciona, o status do report é `fix-aplicado` (ou `investigando` se você voltou à F2), **nunca `resolvido`** — e você **não commita um fix cujo sintoma o humano acabou de dizer que persiste**, a menos que ele peça explicitamente para commitar mesmo assim (aí o commit registra no report que o sintoma segue aberto). Commitar "resolvido" por cima de um "não funcionou" não confirmado é o pior desfecho possível: mascara o bug no git.

## Divisão humano / agente

O orquestrador **comissiona e sintetiza**; ele nunca lê source nem edita código no próprio contexto. Cada linha "subagente" abaixo é um briefing ~500 tokens, self-contained.

| Trabalho | Quem | Por quê |
|---|---|---|
| Classificar o tipo, gerar hipóteses, escolher onde instrumentar, ler digests/veredictos, sintetizar | **Orquestrador** | é raciocínio sobre o digest — o único papel sem leitura/escrita de source |
| Ler o source ao redor do sintoma, grep dos callers, ler spec/REQ/testing.md | **Subagente `Explore`** | mantém o contexto do orquestrador limpo (DNA SDD) |
| Subir o server + injetar os senders de instrumentação | **Subagente `instrumentation-executor`** (mesmo tipo do fix-executor) | escrita em produção sai do orquestrador (R4) |
| Disparar o repro na app real (login, estado manual, hardware) | **Humano** | o agente não tem as credenciais/o ambiente — o "back-and-forth" do Debug Mode |
| Disparar repro roteirizável (teste, curl, `browser_navigate`) + capturar o `.jsonl`/Playwright | **Agente** | determinístico, "the agent handles the tedious work" |
| Disparar repro backend cuja auth vive no browser (cookie httpOnly/sessão) | **Agente via Playwright** | o browser logado dispara o request; `curl` falha sem token |
| Decidir se um comportamento é bug ou intencional | **Humano** (`AskUserQuestion`) | é julgamento de produto, não evidência |
| Escrever o teste RED→GREEN + o fix + commitar | **Subagente `fix-executor`** | execução cirúrgica TDD; um por fix, fora do contexto do orquestrador |
| Re-reproduzir + provar teste verde + limpar instrumentação + grep-zero | **Subagente `closing-gate`** | a prova é comissionada, não auto-executada |
| Confirmar que o sintoma original sumiu | **Humano** (`AskUserQuestion`) | o fechamento não é decidido sozinho — carimbo final |

## Circuit breaker — pare antes de empilhar fixes

Cada ciclo "instrumentei/corrigi → reproduzi → não confirmou nenhuma hipótese, ou o fix não segurou" conta como **uma tentativa**. **Após 3 tentativas falhas, PARE** — não tente uma 4ª variação na mesma direção. Em vez disso:
1. Declare ao humano: *"3 hipóteses não seguraram — provável erro de premissa, não de implementação."*
2. **Re-hipotetize do zero (volte à F2)** questionando a premissa: *o sintoma é o que eu acho que é? estou no arquivo certo? o repro reproduz mesmo este bug, ou outro?*
3. Se ainda travar → **escale ao humano com o report completo** (as 3 hipóteses refutadas + evidência) em vez de seguir chutando. Honestidade vence thrashing.

**O breaker conta tentativas da SESSÃO inteira, não só da investigação inicial.** Uma reabertura do humano ("não funcionou") **é uma tentativa falha** e soma ao contador — mesmo que o fix anterior tenha passado no closing-gate e na confirmação. Cenário real que esgota o breaker: fix 1 commitado → humano reabre (tentativa 1) → fix 2 sem TDD → humano reabre (tentativa 2) → fix 3 → humano reabre (tentativa 3) → **PARE**. Três fixes que não seguraram quase nunca pedem um 4º parecido; pedem questionar a premissa: *eu realmente vi o runtime do sintoma, ou só li o código e deduzi? a "confirmação" da F4 foi um `.jsonl` real ou um teste unitário que eu mesmo escrevi?* Um teste unitário verde **não é** confirmação de runtime — é a F6, não a F4.

Sem o breaker, um agente "conserta" seis vezes, cada fix mascarando o anterior, e o diff vira lixo. O breaker é o que mantém o fix cirúrgico cirúrgico. Detalhe em `references/hypothesis-discipline.md`.

## Artefato — um report leve e descartável

Grave um bug report leve e incremental (~meia página) seguindo `templates/debug-report.template.md`. Local: `docs/debug/<slug>/report.md` (a pasta da sessão criada na F0, com o `session.jsonl` ao lado); ou `docs/specs/<feature>/debug-<slug>.md` se o bug está numa feature especificada (herda o contexto da spec). **Crie-o já na F1/F2** (`status: investigando`) — não no fim. Ele percorre três estados: `investigando` → `fix-aplicado` (GREEN do fix-executor, mas closing-gate/humano ainda não confirmaram) → `resolvido` (só com closing-gate verde **e** confirmação humana).

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
| Instrumentar o 2º repo sem ler o mapa dele | Multi-repo: mini-F0 no repo-alvo (o `context.md` dele) antes de tocar — as invariantes são outras. |
| Instrumentar serviço long-running sem reiniciar | Os senders só postam após o restart; reinicie com o runtime que o repo exige (`engines`/`.nvmrc`) e confirme "listening". |
| Capturar por `console.log` solto no stdout | Use o canal certo: sender→debug server quando precisa INJETAR observação no código (vai pro `.jsonl`); inspeção direta (Playwright network/console, query ao DB) quando o ponto já existe fora do código. O proibido é stdout solto e órfão, não "não subi o server". |
| "Não funcionou" → editar inline e seguir tentando | Reabertura = F9: PARE de editar, conta como tentativa do circuit breaker, re-entre na F2 com o report como state.md, re-instrumente e prove o NOVO estado antes de qualquer fix. Não vire Claude cru. |
| Declarar resolvido com teste unitário verde | Teste unitário é F6, não F4. O closing-gate exige re-repro de **runtime real** (o sintoma do humano sumindo no app), que o teste não substitui. |
| Commitar um fix que o humano disse que não funciona | Sob reabertura não confirmada o status é `fix-aplicado`, nunca `resolvido`. Só commite se o humano pedir, e registre no report que o sintoma segue aberto — nunca mascare como resolvido no git. |
| Empilhar tentativas de reprodução pelo mesmo método falho | Se o repro não dispara após 2 tentativas pelo mesmo caminho (ex.: automatizar um player/canvas/3º), pare: peça ao humano para disparar o fluxo real e você observa. Cada tentativa falha conta no breaker. |
| Inflar o contexto editando tudo no orquestrador | Cada fix de cada rodada (inclusive pós-reabertura) é um fix-executor fresco com TDD. Orquestrador que edita inline em 4 rodadas estoura o contexto — é o sintoma de ter abandonado o fluxo. |
| `.md` e `.jsonl` soltos em `docs/debug/` | Pasta-por-sessão: `docs/debug/<slug>/` com `report.md` E `session.jsonl` dentro. Em multi-repo, no repo onde a sessão começou. |
| Deixar o ambiente do dev alterado | Se reiniciou/derrubou um serviço para instrumentar, restaure-o ao estado original no closing-gate. |
| Achar que Playwright só serve para o visual | Quando a auth vive no browser, Playwright dispara o fluxo backend; e `browser_evaluate`/`run_code_unsafe` prova hit-testing (`elementFromPoint`). |
