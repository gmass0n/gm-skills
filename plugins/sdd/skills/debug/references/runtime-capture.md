# Captura de runtime — leia ao instrumentar (F3) e ao reproduzir (F4)

O Debug Mode troca palpite por evidência. Esta é a mecânica de como obter essa evidência no Claude Code: o debug server local (o canal **sempre**), os senders por linguagem, como reiniciar o serviço-alvo e automatizar o repro, e o Playwright tanto para o que o log não vê quanto como disparador de fluxo autenticado.

**Quem executa:** a injeção dos senders (F3) e a remoção deles (F8) são **comissionadas a subagentes** — o `instrumentation-executor` injeta, o `closing-gate` remove e prova grep-zero. O orquestrador nunca escreve esses senders no próprio contexto; ele passa este doc no briefing do subagente e lê o manifesto/veredito de volta. A mecânica abaixo é o que vai no briefing.

## O debug server é o canal — SEMPRE, não `console.log`

A captura vai pelo debug server **em todos os casos**, sem atalho — mesmo num serviço local simples. `console.log` em stdout é frágil: some num worker, num processo filho, no SSR, num container, num lambda local; é texto não-estruturado que você fareja com grep; e te força a olhar o terminal *certo*. O Cursor resolve isso com um debug server numa extensão — a instrumentação faz um `POST localhost` e o server agrega tudo. Replicamos isso com `scripts/debug-server.js`:

- **stdlib pura (`http`+`fs`), zero dependências, zero build.** Roda em qualquer projeto Node sem instalar nada. Para projetos não-Node, ele ainda serve: é um endpoint HTTP agnóstico, e o sender (em Python, Go, etc.) só precisa fazer um POST.
- **Captura estruturada.** Cada POST vira 1 linha JSON em `docs/debug/<slug>/session.jsonl` (a pasta da sessão criada na F0; o `report.md` é irmão dele). `{tag, hyp, var, value, file, line}` é parseável; você lê o arquivo e cruza com as hipóteses sem adivinhar.
- **Canal único — inclusive multi-repo.** Backend e frontend POSTam pro mesmo server → a evidência dos dois lados (de dois repos, inclusive) cai no mesmo `session.jsonl`, na ordem real dos eventos. É por isso que a pasta da sessão fica num único repo: tudo converge num só lugar.
- **Independente do terminal.** Não importa qual processo emitiu — o POST sempre chega.

## Subir e derrubar o server (lifecycle)

```bash
# Subir em background na F3. O slug nomeia a pasta da sessão; a captura vai dentro dela.
node scripts/debug-server.js docs/debug/<slug>/session.jsonl 9999 &
# A 1ª linha do stdout é parseável: {"debugServer":"up","port":9999,"out":"docs/debug/<slug>/session.jsonl"}
# Se 9999 estiver ocupada, o server tenta 9999+1..9999+20 e reporta a porta real nessa linha — use-a no sender.

# Confirmar que o canal está de pé antes de instrumentar:
curl -s localhost:9999/health    # → {"ok":true,"out":"..."}

# Derrubar na F8, nesta ordem:
kill <pid>                              # 1. mata o processo (pid guardado ao subir, registrado no manifesto)
rm docs/debug/<slug>/session.jsonl      # 2. apaga a captura ANTES do grep (senão o grep acha o tag dentro dela)
grep -rn "DEBUG-<hash>" .               # 3. prova grep-zero no código — em CADA repo instrumentado
```

**Lifecycle disciplinado (o closing-gate da F8 depende disso):** o server sobe na F3, vive durante F4–F6, e morre no closing-gate (F8) — então o `.jsonl` é apagado e os senders removidos (grep-zero **em cada repo**). **A ordem importa:** apague o `.jsonl` antes do grep-zero, senão o `grep` encontra o próprio `DEBUG-<hash>` dentro do arquivo de captura (é onde ele deve estar) e o grep-zero nunca fecha. Nada do server sobrevive ao fim do debug. Registre porta + pid + caminho do `.jsonl` no manifesto do report assim que subir.

## Senders por linguagem

O server é o mesmo; só o trecho injetado no código muda. Todo sender POSTa o mesmo shape JSON e **nunca pode quebrar o app** (engole o próprio erro). O `tag` carrega o `DEBUG-<hash>` da sessão para a limpeza.

Marque sempre cada inserção com o **comentário-âncora** na linha de cima, para a F8 remover sem ambiguidade (o Cursor usa "clear comments which help the AI clean them up later"):
```
// DEBUG-a4f2 (sdd:debug) — remover na limpeza
```

**JavaScript / TypeScript (browser ou Node 18+):**
```js
// DEBUG-a4f2 (sdd:debug) — remover na limpeza
fetch('http://localhost:9999',{method:'POST',body:JSON.stringify({tag:'DEBUG-a4f2',hyp:'H2',var:'user',value:user,file:'foo.ts',line:42})}).catch(()=>{});
```

**Node antigo (sem `fetch`):**
```js
require('http').request({host:'localhost',port:9999,method:'POST'},()=>{}).on('error',()=>{}).end(JSON.stringify({tag:'DEBUG-a4f2',var:'user',value:user}));
```

**Python:**
```python
import urllib.request, json
try: urllib.request.urlopen('http://localhost:9999', json.dumps({'tag':'DEBUG-a4f2','var':'user','value':repr(user)}).encode(), timeout=0.2)
except Exception: pass
```

**Go:**
```go
b, _ := json.Marshal(map[string]any{"tag": "DEBUG-a4f2", "var": "user", "value": user})
http.Post("http://localhost:9999", "application/json", bytes.NewReader(b)) // erro ignorado de propósito
```

**Genérico (qualquer linguagem com shell à mão):**
```bash
curl -s -XPOST localhost:9999 -d '{"tag":"DEBUG-a4f2","var":"user","value":"'"$USER_VAL"'"}' >/dev/null 2>&1 || true
```

O `DEBUG-<hash>` no `tag` é o que a F8 grepa para remover. Use o mesmo hash em todos os senders de uma sessão.

## Reiniciar o serviço-alvo (obrigatório para long-running; crítico em multi-repo)

Os senders só passam a postar no debug server **depois que o serviço que os contém é reiniciado**. Instrumentar um backend/watcher e não reiniciá-lo = `.jsonl` vazio e a falsa conclusão de que o repro não disparou. Sequência:

1. **Descubra como o serviço roda.** `lsof -ti:<porta>` dá o PID que ouve a porta; `ps aux | grep <nome>` mostra o comando exato (watch? dist? qual entrypoint?).
2. **Reinicie com o runtime que AQUELE repo exige.** Cheque `engines`/`.nvmrc`/`package.json` do repo-alvo — em multi-repo o 2º repo pode exigir outra versão de Node que o gerenciador *barra* se você usar a errada. Caso real: `engines.node>=24` fez o `pnpm start` falhar sob Node 22; a saída foi usar o Node 24 (via nvm) e rodar o entrypoint compilado direto (`node dist/main.js`), contornando o gate do gerenciador.
3. **Capture o stdout do boot** (redirecione para um arquivo) e confirme o "listening on ..." antes de disparar o repro — senão você dispara contra um serviço que não subiu.
4. **Se derrubou o processo do dev, anote no manifesto e RESTAURE no F8.** O closing-gate religa o serviço no modo original (watch/dev, mesmo runtime). O ambiente do humano não pode terminar diferente de como começou.

## Ranking de repro determinístico

Reproduzir é pré-requisito de tudo. O repro *automatizado* é o que torna o resto mecânico — você roda quantas vezes quiser, sem depender do humano, e ele vira o teste de regressão depois. Tente do topo para baixo conforme o caso permitir:

1. **Teste que falha no seam certo** — o melhor. O repro minimizado da F1 escrito como um teste vermelho **é** o teste RED do fix-executor na F6 — vira o próprio teste de regressão. Zero retrabalho.
2. **Script HTTP / `curl`** no endpoint que dispara o bug — determinístico para bugs de API/backend. **Mas:** se a auth vive em cookie httpOnly / sessão server-side, o `curl` falha (sem token) — pule para o #3 Playwright.
3. **Playwright com sessão real — disparador, não só captura.** Quando o token está no browser (cookie httpOnly), o **browser logado dispara o fluxo backend** que o `curl` não alcança: navegue/interaja para acionar o request, e leia a evidência no `session.jsonl`. Caso real: o `GET /courses` exigia bearer de sessão; `curl` deu 401, mas reabrir o popover no browser logado disparou o fetch e o sender capturou o payload bruto. Playwright (`browser_navigate` + interações) também é o repro determinístico padrão para bugs de UI/frontend.
4. **CLI com snapshot diff** — rode o comando, capture a saída, compare com o esperado. Bom para fluxo silencioso (tipo c): o diff aponta onde divergiu.
5. **Differential** — rode a versão que funciona e a quebrada, compare os dois `.jsonl`. A primeira linha que difere é a pista. Útil para regressões.

Só caia para **"humano dispara na app real"** quando nenhum dos cinco é viável (precisa de login real, estado montado à mão, hardware). Aí é o back-and-forth do Debug Mode: o humano dá os passos, o agente lê o `session.jsonl`.

## Captura por tipo de bug

**(a) backend / console / terminal**
- Sender nos pontos das hipóteses; o server captura tudo no `.jsonl`.
- Repro pelo ranking acima (#1 teste, #2 curl). Se precisa de ambiente real, o humano roda e o agente lê o `.jsonl`.
- Evidência: valor das variáveis, branch tomado, a exception com a linha real.

**(b) frontend / tela — Playwright MCP é o complemento E o disparador**
O sender no JS do browser POSTa pro mesmo server (a *lógica* do front cai no `.jsonl`). Mas o **visual e a geometria** o log não captura — para isso, Playwright:
- `browser_navigate` → a URL do repro.
- `browser_console_messages` → erros/warns do console do browser (mesmo que o sender já não cubra).
- `browser_network_requests` → requests que falharam, status, payload (bug de API visto do cliente).
- `browser_snapshot` → o DOM acessível (elemento ausente, render quebrado).
- `browser_take_screenshot` → o estado visual (tela branca, layout torto).
- `browser_click` / `browser_fill_form` → o agente reproduz o fluxo sozinho quando não precisa de humano (inclui disparar fluxo backend autenticado — ver #3 do ranking).
- `browser_run_code_unsafe` / `browser_evaluate` → **prova de hit-testing e geometria.** `document.elementFromPoint(x,y)` confirma QUAL elemento recebe um clique (mata o falso-negativo de "cliquei mas não fechou" quando o clique caiu noutro elemento, ex. um header sobreposto); `getBoundingClientRect()` mede caixas para validar que um overlay/close cobre a área certa. Caso real: o "clique no backdrop não fecha" era o clique caindo no header do app, não no backdrop — só `elementFromPoint` provou onde o ponteiro aterrissava.

**(c) fluxo errado / silencioso — instrumentação é obrigatória**
Não há erro para capturar; o que define o bug é a divergência. Ponha um sender em **cada fronteira** do fluxo suspeito, imprimindo o estado *esperado vs real* em cada passo. Rode o repro e leia a sequência no `.jsonl`: a linha onde o estado diverge do esperado **é** a causa. Isso transforma "fluxo errado" (vago) em "na linha 47 `x` já está errado, mas na 31 estava certo" (localizado). É o "runtime evidence rather than guessing" aplicado ao caso sem exception.

## Fallbacks — exceções raras, NÃO rota de conveniência

O debug server é o canal sempre. Os fallbacks abaixo só entram quando o HTTP server é **tecnicamente inviável** — não porque "é mais rápido" ou "o serviço já loga no terminal". `console.log`/stdout não é atalho aceitável; é fallback de último recurso. O próprio Cursor só degrada para **"file writes in certain environments"** quando o canal HTTP não serve. Ordem de preferência:

1. **File-write direto (sem rede).** Em sandbox sem `localhost`, ou ambiente onde abrir porta falha, o sender escreve a linha JSON direto no `.jsonl` em vez de fazer POST — mesma captura estruturada, mesmo arquivo, mesma limpeza, só sem o servidor no meio:
   ```js
   // DEBUG-a4f2 (sdd:debug) — remover na limpeza
   require('fs').appendFileSync('docs/debug/<slug>/session.jsonl', JSON.stringify({tag:'DEBUG-a4f2',var:'user',value:user})+'\n');
   ```
   ```python
   # DEBUG-a4f2 (sdd:debug) — remover na limpeza
   open('docs/debug/<slug>/session.jsonl','a').write(__import__('json').dumps({'tag':'DEBUG-a4f2','value':repr(user)})+'\n')
   ```
   Não serve para o **browser** (sem acesso a filesystem) — lá, o canal é Playwright (`browser_console_messages`) ou o sender HTTP para o server rodando na máquina do dev.
2. **stdout/stderr de um repro determinístico.** Só quando nem o server nem o file-write servem. O agente roda o teste/comando e lê a saída direta; os senders viram `console.log`/`print` com prefixo `[DEBUG-<hash>]`. Menos estruturado — último recurso, não preferência.
3. **Humano cola o artefato que já tem** (stack/log/screenshot). Custo zero, evidência real — sempre o primeiro a tentar quando ele já reproduziu.

Em qualquer fallback, a disciplina da F8 não muda: comentário-âncora + grep-zero (em cada repo), e o `session.jsonl` apagado antes do grep.
