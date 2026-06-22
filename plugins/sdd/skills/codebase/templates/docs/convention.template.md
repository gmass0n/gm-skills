# Archetype: `conventions/<família>.md`

Um documento por **família de convenção** do repo. As de maior valor são as **mecânicas** — impostas por lint/types/CI/hooks — porque transformam "tentamos" em "o build falha".

Famílias típicas: key-conventions (aliases, ENV, exceptions, mappers, commits — um resumo dos acordos), naming-conventions, testing-conventions, quality-gates (coverage, hooks, thresholds), eslint-boundaries (ou o equivalente de import-rules do stack).

## Idioma e forma

PT-BR. Identificadores, caminhos, nomes de regra verbatim.

## Estrutura do doc

```markdown
# <Nome da convenção>

## Regra-de-ouro
<A convenção em 1–3 frases. Para boundaries: "lint torna a arquitetura mecânica:
separações de camada viram erro de lint, não bom-modo.">

## <Configuração / tipos / regras reais>
<Para convenções IMPOSTAS: cole o trecho real da config (eslint.config, ruff.toml,
jest.config, husky hook, CI step). A config É a documentação. Para convenções de
naming/estrutura: tabela ou lista de regras observadas com exemplo de cada.>

## Como interpretar uma falha   (para convenções com enforcement)
<Mostre uma mensagem de erro real e como resolver. "import de infra num mapper de
presentation → passe pelo Result do handler.">

## <Como estender>   (opcional — quando adicionar algo exige tocar a config)
<Ex.: novo adapter → registrar em boundaries/elements + regras simétricas.>

## Anti-padrões
<Lista com ❌. Bypass com disable-comment, regra sem alinhamento, esquecer de
classificar subfolder novo, etc.>
```

## Onde olhar no repo

- `eslint.config.*`, `.eslintrc*`, `ruff.toml`, `.editorconfig`, `tsconfig.json` (paths/strict).
- `jest.config.*` / `vitest.config.*` → coverage thresholds, organização de testes.
- `.husky/`, `lefthook.yml`, `.github/workflows/` → gates de CI/pre-push.
- `package.json` scripts (`lint`, `test`, `--max-warnings 0`).
- Padrões de naming observados em 5–10 arquivos.

## Regras

- Para convenções impostas, **cole a regra real** — não parafraseie. O trecho de config prova que a convenção é lei.
- "Como interpretar uma falha" é ouro: o leitor chega aqui justamente quando o build quebrou.
- Cross-linke dos `architecture/*` e `patterns/*` PARA este doc — é aqui que o enforcement deles é detalhado.
- Naming/estrutura: documente o que o código faz, inclusive inconsistências. Não invente o ideal.

## Exemplo (extraído de um repo NestJS — adapte ao stack alvo)

```markdown
# ESLint Boundaries Enforcement

## Regra-de-ouro
`eslint-plugin-boundaries` faz a arquitetura mecânica: separações de camada são
impostas como erros de lint, não bons-modos.

## Regras observadas (todas as `disallow` reais)
\`\`\`ts
{ from: { type: 'domain' },
  disallow: { to: { type: ['presentation','infrastructure'] } },
  message: 'Domain layer cannot import presentation or infrastructure.' }
\`\`\`

## Como interpretar uma falha
\`\`\`
presentation/http/mappers/issue-token.mapper.ts:5
  error  Presentation mappers cannot import from infrastructure.
\`\`\`
→ Solução: passe pelo Result do handler.

## Anti-padrões
- ❌ Bypass com `// eslint-disable-next-line boundaries/dependencies`.
```
