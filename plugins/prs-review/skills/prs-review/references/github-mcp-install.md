# Instalação do MCP do GitHub

Este review exige um MCP GitHub quando o lote contém PRs de `github.com`.
Instale-o no cliente em uso, reinicie a sessão e confirme as ferramentas antes
de refazer o review. Não presuma que a configuração de Claude vale para Codex,
nem o contrário.

## Servidor remoto recomendado

Use `https://api.githubcopilot.com/mcp/` com um PAT em uma variável de ambiente
(`GITHUB_PERSONAL_ACCESS_TOKEN`). O token precisa de `repo` para repos privados
ou `public_repo` para públicos; acrescente `read:org` quando necessário.

### Codex

```bash
export GITHUB_PERSONAL_ACCESS_TOKEN=<SEU_PAT>
codex mcp add github \
  --url https://api.githubcopilot.com/mcp/ \
  --bearer-token-env-var GITHUB_PERSONAL_ACCESS_TOKEN
codex mcp list
codex mcp get github
```

O servidor usa bearer token; não use `codex mcp login github` para esse fluxo.

### Claude Code

```bash
claude mcp add --scope user --transport http github \
  https://api.githubcopilot.com/mcp/ \
  --header "Authorization: Bearer <SEU_PAT>"
claude mcp list
```

## Alternativas locais

Se a política impedir o servidor remoto, configure o servidor oficial
`ghcr.io/github/github-mcp-server` (Docker) ou
`@modelcontextprotocol/server-github` (stdio) usando o mecanismo de MCP do
cliente atual. Passe `GITHUB_PERSONAL_ACCESS_TOKEN` somente como segredo local;
não o grave em repositórios nem o exponha no chat.

## Validação

Confirme que o servidor oferece leitura de metadados de PR, diff, arquivos e
commits, além de leitura de arquivo no branch quando disponível. Os nomes podem
variar por cliente/servidor; no contrato desta skill, os equivalentes são
`mcp__github__pull_request_read` (`get`, `get_diff`, `get_files`,
`get_commits`) e `mcp__github__get_file_contents`. Ferramentas deferred devem
ser carregadas por ToolSearch.

Se houver autenticação falha ou as ferramentas não aparecerem, confirme o token
e os escopos e reinicie a sessão do cliente.
