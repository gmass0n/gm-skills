# Prompt-modelo para subagente — PR do GitHub

Use este prompt ao disparar cada subagente background de PR do GitHub. Substitua os campos `<...>`.

---

Code review de um Pull Request do **GitHub**.

**PR alvo:** owner=`<owner>`, repo=`<repo>`, pull_number=`<pull_number>`.

**Contexto da task (fornecido pelo usuário):**
<colar aqui o detalhamento/contexto geral dos PRs>

**Escopo deste PR:** <o que este PR específico implementa, se conhecido>

## Passos

1. **Busque o diff do PR** via `mcp__github__pull_request_read` com `method: "get_diff"` (unified diff). Se truncar (PR grande), use `method: "get_files"` e revise arquivo a arquivo pelo campo `patch`. Ferramentas deferidas → carregue com ToolSearch `select:mcp__github__pull_request_read` antes.

2. **Carregue a doutrina de review da `sdd:review`** (uma leitura por arquivo) e siga-a — não invente o motor:
   - `<sdd-review>/references/review-lenses.md` — as 5 lentes + as blocklists "What NOT to flag".
   - `<sdd-review>/references/verification-discipline.md` — a verificação adversarial (F4).
   - Resolva `<sdd-review>` procurando nos dois caches:
     `~/.claude/plugins/cache/gm-skills/sdd/*/skills/review/` e
     `~/.codex/plugins/cache/gm-skills/sdd/*/skills/review/`. Escolha a **maior versão semver compatível** — a que contém os dois arquivos acima — sem hardcode. Sem versão compatível → avise numa linha e siga com a doutrina mínima (lentes informais + tentar refutar cada achado contra o código real).

3. **Lentes (hipóteses):** aplique as 5 lentes ao diff. Cada achado é hipótese ancorada no lado `+` (linha real do arquivo). Respeite as blocklists. Gere liberalmente.

4. **Verificação adversarial (F4):** tente **refutar** cada hipótese ("por que NÃO é bug?") contra o código real. Para callers/contratos fora do diff, **spawne sub-subagentes explorer focados** (perguntas específicas, não o repo inteiro); use `mcp__github__get_file_contents` para ler arquivos no branch do PR. Sem ferramenta de subagente → buscas pontuais inline. Aplique os FP traps da doutrina. Veredictos: **confirmed** → blocker (voto-duplo: 2ª verificação confirma o mesmo `arquivo:Llinha`, senão rebaixa) ou warning; **partial** (código inalcançável) → warning + "confirmar:"; **refuted** → descartado; **question** (intenção do autor / regra de negócio) → guardado, fora do retorno final.

## Notas específicas de GitHub

- **Numeração de linhas no diff:** use sempre o número da linha do arquivo **após** o patch (lado `+`). Se o achado for sobre linha removida, cite a linha do contexto adjacente preservada no diff.
- **PRs grandes:** a API do GitHub trunca o diff em ~3000 linhas / arquivos muito grandes. Se detectar truncamento, pegue arquivo-a-arquivo via `mcp__github__pull_request_read` com `method: "get_files"` (paginado, parâmetros `page`/`perPage`) e revise por arquivo. Nunca dê parecer sem ter visto o conteúdo dos arquivos modificados.
- **PRs de merge / squash em rebase:** revise o diff do PR (head vs base), não os commits individuais — exceto quando o usuário pedir review por commit.

## Regras de análise

- Reporte **apenas problemas NOVOS introduzidos por este diff**. Nunca problemas pré-existentes.
- Avalie DRY, SOLID, KISS e a **correção das regras/cálculos** descritas no contexto.
- Caça: bugs lógicos, condições invertidas, null/undefined, async/await faltando, erros engolidos, race conditions, regressões, valores corrompidos.

## Classificação

- 🔴 **blocker**: quebra comportamento, anula objetivo da task, corrompe dado, loop infinito, mascara falha.
- 🟡 **warning**: frágil, race, erro engolido, regra duvidosa, falta validação.
- 🔵 **nit**: estilo, dead-code, typo, formatação.

## Retorno

Terso, uma linha por achado, formato `arquivo:Llinha: <emoji> <tipo>: <problema>. <fix>.`. Agrupe em: BLOCKERS, WARNINGS, NITS, PRAISE. Praise = pontos positivos concretos do diff (não invente).
