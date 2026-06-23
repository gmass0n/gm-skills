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

## Testing é uma família dedicada — nunca um parágrafo solto

`testing.md` é sempre seu próprio doc quando o repo tem qualquer suíte (não dobre dentro de quality-gates). Além de stack/comandos/coverage, **declare explicitamente** as três regras que humanos esquecem — é para torná-las lei que o mapa existe:

1. **Co-localização do spec** — onde o spec vive *em relação ao arquivo que testa*, na granularidade real do repo. Leia 5–10 pares source→spec de sub-camadas diferentes e prove com um caminho real. Ex.: spec mora em `tests/` dentro da **própria** sub-camada (`dtos/tests/`, `mappers/tests/`, `http/tests/`), nunca num `tests/` genérico da camada acima.
2. **Cobertura por artefato** — quais artefatos *obrigatoriamente* têm spec co-localizado (ex.: todo dto/mapper/controller). Se um artefato real está sem spec, isso vira achado em `concerns/`.
3. **Postura TDD** — se o repo declara test-first em qualquer lugar (testing.md, CLAUDE.md, AGENTS.md, contributing), registre como política, não sugestão. Se um hook/CI torna obrigatório, também entra em `context.md` › Invariantes enforced.

`## Anti-padrões` do `testing.md` nomeia o erro literal: `❌ mapper/dto/controller sem spec`, `❌ spec fora do tests/ da própria sub-camada`.

### Exemplo de `testing.md` (repo NestJS com mirror por sub-camada)

```markdown
# Testing

## Regra-de-ouro
Todo dto/mapper/controller tem spec, e o spec vive em `tests/` DENTRO da própria
sub-camada do arquivo — `dtos/tests/`, `mappers/tests/`, `http/tests/` —, nunca num
`tests/` genérico da camada acima. Desenvolvimento é test-first (TDD).

## Co-localização (mirror por sub-camada)
\`\`\`
http/dtos/list-notifications.query.dto.ts
http/dtos/tests/list-notifications.query.dto.spec.ts      // mesmo dir + tests/
http/mappers/notification-http.mapper.ts
http/mappers/tests/notification-http.mapper.spec.ts
\`\`\`

## Anti-padrões
- ❌ mapper/dto/controller sem spec.
- ❌ spec de dto/mapper fora do `tests/` da própria sub-camada (ex.: num `http/tests/` solto).
```

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
