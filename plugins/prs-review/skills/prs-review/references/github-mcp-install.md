# Instalação do MCP do GitHub

Status atual no ambiente do Gabriel (verificado via `claude mcp list`): **MCP do GitHub NÃO está instalado**. Apenas o MCP do Bitbucket está ativo.

Esta skill exige o MCP do GitHub sempre que houver pelo menos um link de PR do `github.com` no lote. Sem ele, a skill bloqueia o review.

## Opção 1 (recomendada) — Servidor oficial `github-mcp-server` (remoto, hospedado pelo GitHub)

O GitHub mantém um MCP server hospedado em `https://api.githubcopilot.com/mcp/`. Usa OAuth/PAT. É a forma mais simples de obter as ferramentas de PR.

### Pré-requisito
Personal Access Token (PAT) do GitHub com escopos:
- `repo` (acesso a repos privados; use `public_repo` se for só público)
- `read:org` (para resolver `owner` em organizações)

Crie em https://github.com/settings/tokens.

### Adicionar ao Claude Code

```bash
claude mcp add --scope user github \
  --transport http \
  --url https://api.githubcopilot.com/mcp/ \
  --header "Authorization: Bearer <SEU_PAT>"
```

Depois verifique:

```bash
claude mcp list
```

Deve aparecer `github: https://api.githubcopilot.com/mcp/ (HTTP) - ✓ Connected`.

## Opção 2 — Servidor oficial `github-mcp-server` local (Docker)

Se preferir rodar localmente sem expor PAT em config remota:

```bash
claude mcp add --scope user github \
  --transport stdio \
  -- docker run -i --rm \
     -e GITHUB_PERSONAL_ACCESS_TOKEN=<SEU_PAT> \
     ghcr.io/github/github-mcp-server
```

## Opção 3 — Servidor comunitário `@modelcontextprotocol/server-github` (npm, stdio)

Mais antigo, mas funciona sem Docker:

```bash
claude mcp add --scope user github \
  --transport stdio \
  --env GITHUB_PERSONAL_ACCESS_TOKEN=<SEU_PAT> \
  -- npx -y @modelcontextprotocol/server-github
```

## Validação após instalação

Reinicie a sessão do Claude Code e confirme que estas ferramentas aparecem (podem ser deferred — carregue via ToolSearch `select:<nome>`):

- `mcp__github__pull_request_read` — uma tool única com parâmetro `method`: `get` (metadata/autor/commits), `get_diff` (unified diff), `get_files` (arquivos com `patch`, paginável), `get_commits`.
- `mcp__github__get_file_contents` (útil para explorer sub-subagents).

Os nomes exatos podem variar levemente entre os três servidores acima. A skill aceita qualquer um desde que cubra os passos: ler PR (metadata), ler diff e listar arquivos/commits.

## Troubleshooting rápido

- **`! Needs authentication`** no `claude mcp list` → token expirado/sem escopo. Recrie o PAT com `repo` + `read:org`.
- **Ferramentas não aparecem** → reinicie a sessão (`/reset` ou nova janela do Claude Code).
- **HTTP 404 em `pull_request_read` com `method: "get_diff"`** no servidor remoto → caia para `method: "get_files"` (a skill já tem esse fallback).
