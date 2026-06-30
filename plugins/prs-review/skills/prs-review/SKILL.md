---
name: prs-review
description: Code review estruturado de um ou mais Pull Requests, suportando tanto Bitbucket quanto GitHub no mesmo lote. Use sempre que o usuário pedir para revisar PRs (de qualquer plataforma), fizer code review de uma task com múltiplos PRs, colar links de pull-requests do bitbucket.org ou github.com, ou invocar /prs-review. Cada PR é revisado por um subagente em background que aplica a doutrina de review da skill sdd:review (lentes cegas + verificação adversarial) sobre o diff obtido via o MCP correspondente à plataforma (Bitbucket MCP para PRs do Bitbucket, GitHub MCP para PRs do GitHub). O resultado é um veredito único (aprovado/rejeitado) com blockers, warnings e praise. Acione mesmo que o usuário não diga "skill" — basta haver links de PR (Bitbucket e/ou GitHub) + intenção de revisão.
---

# PRs Review (multi-plataforma)

Revisa um conjunto de Pull Requests — **Bitbucket, GitHub ou mistura dos dois** — que normalmente compõem uma única task/feature, e devolve **um veredito consolidado**.

A premissa: PRs relacionados (ex.: backend + API + job, ou monorepo + serviço externo em outra org no GitHub) precisam ser avaliados juntos porque um bug num repo pode anular o objetivo da task inteira. Por isso o veredito é único e cobre todos os PRs, independente da plataforma.

## Detecção de plataforma

Para cada URL fornecido, identifique a plataforma pelo host:

- `https://bitbucket.org/<workspace>/<repo>/pull-requests/<id>` → **Bitbucket**. Extraia `workspace`, `repo_slug`, `pull_request_id`.
- `https://github.com/<owner>/<repo>/pull/<number>` → **GitHub**. Extraia `owner`, `repo`, `pull_number`.

Hosts com prefixo (`www.`) ou trailing slash/fragmento (`#discussion`, `/files`) também são válidos — normalize antes de extrair.

URL desconhecido → pergunte ao usuário; não tente adivinhar.

## Pré-requisito obrigatório — MCPs

Esta skill **depende dos MCPs** das plataformas usadas no lote. Verifique disponibilidade **antes de qualquer coisa**, considerando apenas os MCPs realmente necessários para os links recebidos:

- **Bitbucket** (se houver pelo menos um PR do Bitbucket no lote): `mcp__bitbucket__getPullRequest`, `mcp__bitbucket__getPullRequestDiff`, `mcp__bitbucket__getPullRequestCommits`.
- **GitHub** (se houver pelo menos um PR do GitHub no lote): `mcp__github__pull_request_read`. É uma única tool com um parâmetro `method`: use `method: "get"` (metadados/autor), `method: "get_diff"` (unified diff), `method: "get_files"` (lista de arquivos com `patch`, para paginar PRs grandes) e `method: "get_commits"` (commits do PR). Para ler arquivos no branch do PR: `mcp__github__get_file_contents`.

Ferramentas podem estar como **deferred tools** — nesse caso carregue via ToolSearch (`select:<nome>`) antes de chamar.

**Bloqueio:** se o MCP de uma plataforma usada no lote **não estiver disponível**, **bloqueie a revisão imediatamente**. Não tente revisar via `git`, `curl`, `gh` CLI ou WebFetch. Responda exatamente uma destas linhas, conforme o caso:

> 🚫 Review bloqueado: MCP do Bitbucket não instalado. Instale o MCP do Bitbucket e tente novamente.

> 🚫 Review bloqueado: MCP do GitHub não instalado. Instale o MCP do GitHub e tente novamente. Guia em `references/github-mcp-install.md`.

> 🚫 Review bloqueado: MCPs faltando para as plataformas usadas: <lista>. Instale e tente novamente.

E encerre. Não revise nenhum PR parcialmente — ou tudo, ou nada.

## Inputs obrigatórios

A skill **exige** duas informações. Se qualquer uma faltar, pergunte ao usuário e **não inicie a revisão** até obtê-las:

1. **Links dos PRs** — um ou mais URLs de pull request do Bitbucket e/ou GitHub. Sem pelo menos um link válido, não há o que revisar.
2. **Contexto/detalhamento geral** — o que os PRs implementam, qual a task, regras de negócio e validações esperadas. Sem isso a revisão fica cega a erros de regra/cálculo. Se o usuário colou só os links, pergunte: "Qual o contexto/detalhamento da task que esses PRs implementam?"

## Fluxo

### 1. Validar
- Parse de cada URL → identifique plataforma + extraia identificadores.
- Confirme que todos os MCPs necessários estão disponíveis (carregue deferred tools se preciso).
- Confirme contexto fornecido.

Caso contrário, bloqueie ou pergunte.

### 2. Coletar metadados
Para cada PR, busque **autor** e **nº de commits**:

- **Bitbucket:** `mcp__bitbucket__getPullRequest` (autor) + `mcp__bitbucket__getPullRequestCommits` (contagem).
- **GitHub:** `mcp__github__pull_request_read` com `method: "get"` (autor em `user.login`; o payload já traz a contagem em `commits`) — ou `method: "get_commits"` se precisar da lista.

Guarde apenas o que o veredito usa: **nome do autor, nº de commits, repo, id, link, plataforma**.

### 3. Revisar cada PR

Preferencial: **um subagente em background por PR, todos disparados no mesmo turno** (paralelo) — `subagent_type: general-purpose`, `run_in_background: true`. Isola contexto e acelera. Cada subagente recebe o prompt-modelo correspondente à plataforma do seu PR.

**Fallback obrigatório:** se a ferramenta de subagentes (`Task`/`Agent`) não estiver disponível neste ambiente, **revise os PRs inline, um de cada vez, em sequência** — mesmo critério, mesmo resultado. Nunca aborte o review por falta de subagente.

Em qualquer dos modos, cada PR é revisado **aplicando a doutrina de review da `sdd:review`** (lentes cegas → verificação adversarial) sobre o diff obtido via MCP. O motor não é clonado nem reimplementado aqui: o subagente **lê os arquivos de doutrina da `sdd:review` por path** e os segue. Pipeline por PR:

1. **Buscar o diff** via MCP:
   - **Bitbucket:** `mcp__bitbucket__getPullRequestDiff`.
   - **GitHub:** `mcp__github__pull_request_read` com `method: "get_diff"` (unified diff). Para PRs grandes que truncam (~3000 linhas), use `method: "get_files"` e revise arquivo a arquivo a partir do campo `patch`.

2. **Carregar a doutrina** (uma leitura barata por subagente). Os dois arquivos vivem na skill `sdd:review` do plugin `gm-skills`, num diretório **versionado**:
   - `<sdd-review>/references/review-lenses.md` — as 5 lentes (correctness, security, performance, architecture/DRY-SOLID + detecção de reimplementação, spec) com checklist por dimensão e as blocklists **"What NOT to flag"** (o maior redutor de falso-positivo).
   - `<sdd-review>/references/verification-discipline.md` — a disciplina de verificação adversarial (F4): os 4 veredictos, voto-duplo só para blocker, FP traps.
   - **Resolver `<sdd-review>`:** liste `~/.claude/plugins/cache/gm-skills/sdd/*/skills/review/` e pegue a **maior versão** (semver). Não hardcode uma versão — o cache tem várias. Se nenhum diretório existir, degrade: avise numa linha que rodou sem a doutrina completa e siga com a doutrina mínima inline do passo 3-4 abaixo — **nunca aborte o review por isso**.

3. **Fase de lentes (hipóteses):** aplique as 5 lentes de `review-lenses.md` ao diff. Cada achado é uma **hipótese** `{lente, arquivo:Llinha, severidade-palpite, claim, snippet}`, **ancorada no lado `+`** do diff (linha real do arquivo no branch do PR). Respeite as blocklists "What NOT to flag". Escopo: **apenas problemas NOVOS introduzidos pelo diff** (é um diff target — a própria doutrina manda "diff → só new"). Gere liberalmente; a verificação a seguir é que filtra.

4. **Fase de verificação adversarial (F4):** para cada hipótese, tente **refutá-la** ("por que isto NÃO é bug?") contra o código real. Leia arquivos no branch do PR via `mcp__github__get_file_contents` (GitHub) / equivalente Bitbucket; para callers/contratos fora do diff, em modo subagente **spawne sub-subagentes explorer focados** ("onde `X` é chamado", "o que `Y` retorna") — nunca leia o repo inteiro; em modo inline, faça buscas pontuais. Aplique os FP traps (já-tratado-acima, caminho-inalcançável, framework-cobre, intencional+documentado, fixture, lente leu errado o snippet). Veredictos:
   - **confirmed** → 🔴 blocker (quebra/corrompe/segurança) ou 🟡 warning (frágil/erro engolido/falta validação). **Voto-duplo só para blocker:** um blocker só sai se uma segunda verificação fresca confirmar o mesmo `arquivo:Llinha`; divergência → rebaixa para warning + `confirmar:`.
   - **partial** (impacto depende de código inalcançável) → 🟡 warning + `confirmar:` com o que checar. Nunca afirme blocker sem evidência.
   - **refuted** → descartado (não entra no veredito).
   - **question** (depende de intenção do autor / regra de negócio, irresolúvel por código) → guardado internamente; **não vai pro `.txt`** (ver passo 4 de consolidação).

5. **Retornar ao orquestrador:** blockers, warnings, nits, praise — terso, uma linha por item, `arquivo:Llinha`, identificadores em crase. (NITs e questions o consolidador descarta; o subagente pode produzi-los, mas não poluem a saída final.)

Prompts-modelo (trazem os passos acima já preenchidos por plataforma + as notas específicas de cada MCP):
- Bitbucket → `references/subagent-prompt-bitbucket.md`.
- GitHub → `references/subagent-prompt-github.md`.

### 4. Consolidar veredito
Quando todos os subagentes terminarem, monte **um único veredito** no formato abaixo.

- **Status global**: `🔴 REJEITADO` se **qualquer** PR tiver ≥1 blocker; senão `🟢 APROVADO`.
- Status por PR: `🔴 REJEITADO` se tiver blocker, senão `🟢 APROVADO`.
- **Não inclua NITs** no output final — descarte. Apenas blockers, warnings e praise.

### 5. Gravar o veredito em arquivo .txt
O veredito consolidado **não vai no chat**. Grave-o num arquivo `.txt` (Write tool) no diretório de trabalho atual, nomeado `code-review-<TASK-KEY-ou-data>.txt` (ex.: `code-review-SERU-15515.txt`; sem chave de task, use `code-review-AAAA-MM-DD.txt`).

No chat do agente, responda **apenas** o caminho do arquivo gerado — nada mais. Nenhum trecho do veredito, nenhum resumo.

## Formato de saída (obrigatório)

O conteúdo do `.txt` tem exatamente estas seções, nesta ordem. As seções Blockers, Warnings e Praise são **omitidas inteiramente** (título incluso) se não tiverem conteúdo.

Regras gerais de formatação:
- **Sem tabela, sem markdown de tabela, sem alinhamento por espaços.** Tudo em linhas simples — feito para copiar e colar direto no ClickUp.
- **Cada achado ocupa exatamente uma linha** (uma linha = um bullet `- `). Nunca quebre um achado em várias linhas.
- **Todo identificador de código** — nome de arquivo, método, função, variável, enum, valor, status, chamada — vem **entre crases**: `` `@Optional()` ``, `` `.sort()` ``, `` `invoiceData.status` ``, `` `tpEmis=9` ``, `` `arquivo.ts:L123` ``. Aplica-se a TODAS as seções, inclusive Praise.
- Sem seção de resumo e sem seção de recomendação.

### 1. Linha de status
Uma linha:
```
🔴 CODE REVIEW REJEITADO
```
ou
```
🟢 CODE REVIEW APROVADO
```

### 2. Lista de PRs analisados
Linha em branco, depois uma linha numerada por PR (`1.`, `2.`, ...), no formato:
```
<n>. <url-do-pr> - <N> commit(s) - <nome> - <🔴 REJEITADO | 🟢 APROVADO>
```
- Lista sempre numerada, mesmo com um único PR.
- Sem o texto `Autor:` — só o nome.
- Use `commit` no singular quando `N == 1`, `commits` no plural caso contrário.
- Contagem de commits e autor reais, vindos do passo 2.
- O link de cada PR é o URL original (mantém `bitbucket.org` ou `github.com`).
- Exemplos:
  - `1. https://bitbucket.org/rssolutions/pra-notas-api/pull-requests/141 - 4 commits - Yan Ernesto - 🔴 REJEITADO`
  - `2. https://github.com/acme/payments-svc/pull/872 - 2 commits - Ana Lima - 🟢 APROVADO`

### Agrupamento por PR nas seções Blockers / Warnings / Praise

As três seções abaixo seguem a mesma regra de estrutura:
- **Achados são numerados** (`1.`, `2.`, ...) — a numeração reinicia em cada PR.
- O cabeçalho de PR é `PR #<id> — <repo>` **sem numeração** na frente. Para GitHub, `<id>` é o `pull_number`; `<repo>` é só o nome do repo (sem `<owner>/`), suficiente para desambiguar dentro do lote. Se houver dois PRs com o mesmo nome de repo em owners diferentes, use `PR #<id> — <owner>/<repo>`.
- **Se apenas um PR foi revisado, não exiba o cabeçalho de PR** — liste os achados numerados direto sob o título da seção. O cabeçalho `PR #<id> — <repo>` só aparece quando há **2+ PRs**.

### 3. Blockers
Omitir a seção inteira se nenhum PR tiver blocker. Título `🔴 BLOCKERS`.

Um PR (sem cabeçalho):
```
🔴 BLOCKERS

1. `arquivo:Llinha`: <problema> → <impacto>. <fix>.
2. `arquivo:Llinha`: <problema> → <impacto>. <fix>.
```

Dois ou mais PRs (com cabeçalho, numeração reinicia por PR):
```
🔴 BLOCKERS

PR #<id> — <repo>

1. `arquivo:Llinha`: <problema> → <impacto>. <fix>.

PR #<id> — <repo>

1. `arquivo:Llinha`: <problema> → <impacto>. <fix>.
```

### 4. Warnings
Omitir a seção inteira se não houver warnings. Mesma estrutura da seção Blockers, título `🟡 WARNINGS`.
```
🟡 WARNINGS

1. `arquivo:Llinha`: <problema>. <fix>.
```

### 5. Praise
Omitir a seção inteira se não houver nada positivo concreto. Mesma estrutura da seção Blockers, título `✅ PRAISE`.
```
✅ PRAISE

1. <ponto positivo concreto> (PR #<id>).
```

Regras do output:
- Cada achado: `` `arquivo:Llinha` `` exato, problema, fix concreto. Sem hedging.
- **Nunca** liste NITs em nenhuma seção.
- Praise não se inventa — só pontos positivos reais do diff.

## Exemplo de veredito

Ver `references/example-verdict.md` para o conteúdo `.txt` completo de referência (lote misto Bitbucket + GitHub, e exemplo de PR único).

## Instalação do MCP do GitHub

Se o usuário precisar instalar o MCP do GitHub para usar esta skill, consulte `references/github-mcp-install.md`.
