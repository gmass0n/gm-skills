---
name: github
description: Preparar ou finalizar uma release GitHub por repositório, com changelog, draft, PR e gates de merge.
disable-model-invocation: true
---

# GitHub Release

Prepare ou finalize a release de um único repositório. Prove toda afirmação a
partir do histórico e do diff desse repositório. `CHANGELOG.md` é técnico;
notas de release são amigáveis e sempre separadas.

Aplique também o contrato comum em [../shared/release-contract.md](../shared/release-contract.md).

## Guardrails

- PREPARE cria apenas uma release draft e nunca faz merge.
- FINALIZE publica e faz merge somente após uma confirmação explícita.
- Detecte branch, prefixo de tag, nomes e idioma antes de usá-los; defaults só
  servem para primeira release, após confirmação do usuário.
- Nunca sobrescreva artefatos existentes silenciosamente.
- Antes de rebase ou force-push, crie `backup/<branch>-pre-rebase-<YYYYMMDD-HHMM>`,
  mostre alternativas e aguarde confirmação. Nunca faça rollback automático.
- Todo push que reescreve uma branch exige nova leitura do HEAD remoto imediatamente
  antes do push e `--force-with-lease` preso àquele SHA; se divergir, pare e
  mostre os SHAs. Nunca force uma tag sem confirmação explícita e separada.
- Todo CHANGELOG e corpo de PR contém Migration notes, inclusive
  `No migration required.`.

Consulte [../shared/conventions.md](../shared/conventions.md) ao detectar convenções, calcular a
versão ou lidar com primeira release. Consulte [templates.md](templates.md)
ao escrever CHANGELOG, notas, corpo de PR e relatórios finais.

## Fluxo

### 1. Validar e detectar

Confirme caminho/repositório git, `origin`, autenticação `gh` e
`<owner>/<repo>` obtido de `origin`; se houver apenas um nome, peça o caminho ou
owner. Detecte `dev` ou `develop`, a tag mais recente, produção (o branch que
contém a última tag), manifesto/versionamento, convenções de release, CHANGELOG
e idioma. Exiba o resumo detectado. Para primeira release, confirme os defaults
antes de continuar.

### 2. Sondar estado

Para a versão candidata, procure branch local/remoto `release/v<X.Y.Z>`, tag,
PR aberto para produção e release GitHub.

- Nenhum artefato: PREPARE.
- Todos (branch, PR aberto para produção, tag e release draft): ofereça FINALIZE.
- Parte deles: mostre a tabela de estado e peça `abort` ou `resume`.
- Release publicada: se PR estiver aberto, ofereça somente seu merge; se já foi
  merged, pare e peça uma versão maior.

### 3. Computar e analisar delta

Faça `git fetch origin <dev> <prod> --tags`, verificando o HEAD remoto de
`origin/<dev>` pela API GitHub antes de usar a ref. O delta é exclusivamente:

```bash
git log --cherry-pick --right-only --no-merges \
  --invert-grep --grep='^release(' --grep='^chore(release)' --grep='^docs(changelog)' --grep='bump version' \
  --format='%H %s' origin/<prod>...origin/<dev>
```

Se estiver vazio, pare. Registre o SHA remoto verificado. Para até oito commits,
analise um lote; acima disso, divida em lotes de oito e analise em paralelo. Os
investigadores retornam somente fatos por commit (`sha`, tipo, resumo,
migrations, env vars, endpoints, events, schema, removidos e breaking), sem
diffs crus. Restrinja cada investigação a `git show --stat` e arquivos-chave.

### 4. Propor versão e artefatos

Derive major/minor/patch pelos commits convencionais. Releia pontualmente cada
migration, endpoint, env var e remoção antes de afirmá-los. Mostre versão e
justificativa e espere confirmação explícita: não crie branch, commit, tag ou
altere arquivos antes dela.

Com a versão confirmada, produza o bloco técnico no CHANGELOG e as notas
amigáveis, sem reutilizar o mesmo texto. Veja os formatos e regras em
[templates.md](templates.md).

### 5. Preparar

Partindo do SHA remoto registrado, crie `release/v<X.Y.Z>`. Altere somente o
campo de versão do manifesto detectado, sem instalação ou lockfile; atualize o
CHANGELOG e faça um único commit no estilo detectado, sem footer de IA.

Publique normalmente a branch, abra o PR para produção, crie/push a tag na
branch e crie a release GitHub draft com as notas amigáveis. Verifique a
mergeabilidade. Se estiver limpa, informe branch, tag, PR, draft e os próximos
passos: revisar, mergear PR por merge commit, publicar draft e deploy.

### 6. Tratar conflito

PR em conflito é parada: diagnostique com o mesmo delta e comparação de árvore.
Apresente rebase de `dev` sobre produção, merge `--no-ff` ou cherry-pick do
delta, com trade-offs. Para divergência só cosmética, recomende rebase, mas só
execute após confirmação e backup. Se houve rebase, confirme antes de
force-push de `dev`, branch release e tag. Para cada branch reescrita, obtenha
seu SHA atual com `git ls-remote origin refs/heads/<branch>` imediatamente antes
do push, compare-o ao SHA esperado/fetchado e só então use
`git push --force-with-lease=refs/heads/<branch>:<remote-sha> origin <branch>`.
Se qualquer SHA divergir, não faça push e reporte estado local/remoto. Tag só
pode ser movida após uma confirmação explícita separada; revalide a tag remota
e mostre o SHA antigo/novo antes do `git push --force origin refs/tags/<tag>`.
Mova branch/tag somente nesse fluxo e confira se o draft continua correto.

### 7. Finalizar

Revalide em tempo real PR aberto (`release/v<X.Y.Z>` → produção), mergeável,
draft ainda draft e tag remota. Antes de mostrar a confirmação, obtenha o
`tagName` da draft, o HEAD remoto de `release/v<X.Y.Z>` e o SHA da tag remota
(use o SHA descascado para tag anotada). `tagName` deve ser exatamente a tag
candidata e os dois SHAs devem ser iguais. Qualquer ausência ou divergência é
parada: mostre a tabela `draft tagName / candidate tag / branch HEAD / tag SHA`
e não faça merge ou publicação. Se houver conflito, volte ao tratamento de
conflito. Mostre o plano de finalize e aguarde uma confirmação para mergear
primeiro e publicar depois. O padrão é `gh pr merge <num> --merge`; honre outro
método apenas se o usuário o escolheu explicitamente nessa execução.

A tag permanece no commit de release. Após merge, confirme que ela é ancestral
de produção, publique a draft, confirme PR `MERGED`, release não-draft e tag no
commit esperado, então entregue o relatório de go-live de [templates.md](templates.md).

## Conclusão

PREPARE termina com draft e próximos passos. FINALIZE termina apenas depois de
verificar merge, publicação e tag. Se qualquer operação protegida falhar, pare
e reporte o estado atual, a referência de backup e comandos de recuperação.
