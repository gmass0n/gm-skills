---
name: prs-review
description: Revisão consolidada e multi-plataforma de Pull Requests.
disable-model-invocation: true
---

# PRs Review

Revise um lote relacionado de PRs do Bitbucket, GitHub ou ambos e entregue um
único veredito ClickUp-ready. O escopo é o diff novo de cada PR; não invente
contratos, regras ou contexto entre repositórios.

## Antes de começar

Exija os links dos PRs e o contexto da task. Se faltar contexto, pergunte
`Qual o contexto/detalhamento da task que esses PRs implementam?` e pare.

Normalize URLs com `www.`, barra final ou fragmentos. Aceite somente:

- `bitbucket.org/<workspace>/<repo>/pull-requests/<id>`;
- `github.com/<owner>/<repo>/pull/<number>`.

Host desconhecido: peça esclarecimento, sem adivinhar.

Verifique apenas os MCPs das plataformas presentes antes de coletar qualquer
PR. Carregue uma deferred tool via ToolSearch quando necessário.

- Bitbucket: `mcp__bitbucket__getPullRequest`,
  `mcp__bitbucket__getPullRequestDiff`, `mcp__bitbucket__getPullRequestCommits`.
- GitHub: `mcp__github__pull_request_read` e, para arquivos no branch,
  `mcp__github__get_file_contents`.

Além desses mínimos, descubra na plataforma a operação que lista os arquivos
alterados (e a de conteúdo do arquivo no head do PR, se ela for separada). Não
comece a análise sem conseguir paginar essa lista até o fim. Se o conector não
expuser a operação necessária, a revisão daquele PR fica incompleta e rejeitada
— nunca presuma que o diff recebido representa todos os arquivos.

Se algum MCP necessário estiver ausente, encerre sem revisão parcial usando
exatamente uma das respostas abaixo:

> 🚫 Review bloqueado: MCP do Bitbucket não instalado. Instale o MCP do Bitbucket e tente novamente.

> 🚫 Review bloqueado: MCP do GitHub não instalado. Instale o MCP do GitHub e tente novamente. Guia em `references/github-mcp-install.md`.

> 🚫 Review bloqueado: MCPs faltando para as plataformas usadas: <lista>. Instale e tente novamente.

## Fluxo

1. Para cada PR, obtenha autor, número real de commits, repo, id, URL original e
   plataforma. No GitHub, use `pull_request_read` com `method: "get"`; use
   `get_commits` somente se precisar da lista. No Bitbucket, use os endpoints
   de PR e commits.
2. Revise todos os PRs em paralelo, um subagente por PR, quando houver suporte.
   Se não houver subagentes, revise inline e sequencialmente; isso não é motivo
   para cancelar o lote.
3. Primeiro construa o inventário completo: pagine a lista de arquivos
   alterados até não haver próxima página e registre cada caminho/status. Faça
   isso também na revisão inline; delegar não transfere a prova de cobertura.
   Depois busque o diff pelo MCP: Bitbucket `getPullRequestDiff`; GitHub
   `pull_request_read(method: "get_diff")` e `get_files` paginado. Reconcilie
   diff, páginas e inventário: cada arquivo alterado precisa estar marcado como
   lido. Para patch ausente, truncado ou binário, busque o conteúdo do arquivo
   no head do PR e revise-o no escopo da mudança; se não puder obter ou ler esse
   conteúdo, marque a cobertura como incompleta. Não aprove PR/lote com qualquer
   arquivo não lido: inclua um blocker explícito de cobertura incompleta.
4. Aplique a doutrina da `sdd:review`: lentes cegas, depois verificação
   adversarial. Procure, nos caches Claude e Codex,
   `~/.claude/plugins/cache/gm-skills/sdd/*/skills/review/` e
   `~/.codex/plugins/cache/gm-skills/sdd/*/skills/review/`; escolha a maior
   versão semver compatível, que contenha **ambos** `references/review-lenses.md` e
   `references/verification-discipline.md`, e leia-os. Se não houver versão
   compatível, informe em uma linha que a doutrina completa não estava
   disponível e aplique lentes de correctness, security, performance,
   architecture/DRY-SOLID e spec, seguidas de tentativa explícita de refutação.
5. Gere hipóteses apenas em linhas adicionadas ao diff. Verifique cada hipótese
   contra o branch do PR e callers/contratos pontuais; não explore o repositório
   inteiro. Para um possível blocker, uma segunda verificação fresca deve
   confirmá-lo. Divergência rebaixa o item para warning com `confirmar:`.
   Itens refutados e questions não entram no veredito; partial vira warning.
6. Retorne somente blockers, warnings e praise concretos, com
   `arquivo:Llinha`. Descarte nits.
7. Consolide: qualquer blocker — inclusive cobertura incompleta — rejeita o
   lote e o PR correspondente; sem blocker aprova ambos. Grave o resultado em
   `code-review-<TASK-KEY-ou-AAAA-MM-DD>.txt` no diretório atual.

Leia [o contrato de saída](references/output-contract.md) antes de gravar o
arquivo. Ele é obrigatório para a formatação, agrupamento e omissões. Leia
[os prompts de plataforma](references/subagent-prompt-bitbucket.md) ou
[GitHub](references/subagent-prompt-github.md) ao delegar a revisão; eles
contêm as particularidades de cada MCP. Para um exemplo completo do arquivo,
leia [example-verdict.md](references/example-verdict.md). Consulte
[github-mcp-install.md](references/github-mcp-install.md) apenas quando o MCP
do GitHub precisar ser instalado.

## Conclusão

Responda no chat somente o caminho do `.txt` gerado. Nada do veredito deve ir
no chat.
