# Archetype: `integrations/<lib-ou-serviço>.md`

Um documento por **lib/serviço externo que o runtime realmente pluga** — não toda dependência transitiva do manifesto. Cruze o manifesto com código real de `import`/adapter: a entrada só existe se há wiring de verdade.

Exemplos: cliente de banco (mongoose, prisma, pg), logger (pino, winston), tracer (dd-trace, otel), libs de auth/crypto (jsonwebtoken, bcrypt), geradores de doc HTTP (swagger, scalar), health probes (terminus), hardening (helmet), framework de CLI.

Estes docs são **curtos** — referência operacional, não ensaio.

## Idioma e forma

PT-BR. Nomes de lib, caminhos e símbolos verbatim.

## Estrutura do doc

```markdown
# <nome-da-lib>

## O que é / para que serve
<1–3 frases. O papel concreto dela NESTE repo, não a descrição do README dela.>

## Onde está no código
<Lista de caminhos reais: o adapter, o ponto de registro/módulo, o config, o VO/tipo
que valida o formato. Cada item é um caminho clicável em backticks com 1 linha.>

## Regras e padrões
<O que o repo decidiu sobre o uso dela. Comportamentos garantidos, limitações
deliberadas, decisões ("não há needsRehash", "RS256 only", "CSP em modo X").>
```

Quando a integração for rica (gera contrato, tem decorators próprios, expõe rota), pode crescer com `## Como funciona` mostrando um trecho real. Mantenha o foco: é referência de "como ISSO está plugado aqui".

## Onde olhar no repo

- O manifesto (`package.json` deps) → candidatos.
- `rg "from '<lib>'"` ou o import da lib → onde é realmente usada.
- O módulo/arquivo de registro (provider, factory, `forRoot`, init).
- Config relacionada (env vars, schema de validação).

## Regras

- Só entra quem está plugado no runtime. Dev-deps de build/test não viram doc de integração (viram, no máximo, item em `conventions/quality-gates`).
- "Onde está no código" é o coração — caminhos reais que o leitor abre.
- Se o repo não tem integrações externas relevantes, **não invente**. `integrations/` recebe uma nota curta no README, não entradas fabricadas.
- Cross-linke para o pattern/layer que consome a integração (ex.: `mongoose.md` → `mapper-pattern.md`, `port-and-adapter-pattern.md`).
