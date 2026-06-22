# Archetype: `concerns/<área-de-risco>.md`

Um documento por **área de risco** do código. Diferente dos outros cinco diretórios, `concerns/` é **avaliativo, não descritivo**: registra o que está errado/frágil, não como o código funciona. Por isso **não abre com `Regra-de-ouro`** — abre direto nos achados.

Áreas típicas (gere só as que têm achado real): `security-gaps.md`, `perf-hotspots.md`, `fragile-areas.md`, `tech-debt.md`. Não crie um arquivo de área sem ao menos um achado evidenciado.

## Idioma e forma

PT-BR. Caminhos, símbolos e markers verbatim.

## Regra de ouro do diretório (não vai no doc — é pra você)

**Evidência forte ou nada.** Cada achado precisa de uma âncora real: `caminho:linha`, um `TODO`/`FIXME`/`HACK` confirmado no código, ausência comprovada de teste, dependência desatualizada. Concern sem âncora = especulação = corta. Este é o diretório onde a tentação de inventar é maior — resista. Um `concerns/` honestamente curto vale mais que um inflado.

## Frontmatter (obrigatório)

```yaml
---
title: <Área de risco>
area: concerns
generated: <data passada por você>
sources:
  - <os arquivos/globs onde os achados desta área vivem>
---
```

## Estrutura do doc

Cada achado é **machine-parseable** — é isto que diferencia este fork. O `sdd:plan` ingere concerns filtrando pela `ancora`: ele cruza os arquivos que a feature vai tocar contra a `ancora` de cada achado e só traz os relevantes (opt-in, com gate humano) como tasks de remediação. Prosa não é filtrável; por isso `id` estável, `severidade` enum e âncora **com número de linha** são obrigatórios.

```markdown
# <Área de risco>   (ex.: Security Gaps, Performance Hotspots, Fragile Areas, Tech Debt)

<1 frase sobre o escopo desta área. Se a varredura não achou nada relevante:
"Nenhum achado relevante de <área> com evidência no código atual." e PARE — não invente.>

## <Achado conciso>          (uma seção `##` por achado, título = o problema em si)
- id: CONCERN-NNN          # estável; não reuse números de achados removidos
- severidade: alta         # enum exato: alta | média | baixa
- ancora: caminho/do/arquivo.ts:NN   # SEMPRE com :linha; liste pontos extras se o achado se repete
- descricao: <o problema em uma linha — o que está errado>
- evidencia: <o trecho/marker/fato observado: o TODO real, o código frágil, o teste ausente>
- impacto: <o que pode quebrar / vazar / degradar, concreto>
- sugestao: <opcional, 1 linha — só se óbvia. Não vire backlog grooming.>
```

> O bloco de campos é lido por máquina: mantenha as chaves exatas (`id`, `severidade`, `ancora`, `descricao`, ...) e a `severidade` dentro do enum. Um `Âncora:` sem `:linha` ou severidade escrita em prosa quebra a ingestão do `sdd:plan`.

## Onde olhar no repo

- `rg -n "TODO|FIXME|HACK|XXX|@deprecated"` → débito declarado pelo próprio time.
- Arquivos de regra de negócio sem `*.spec`/`*.test` co-localizado → cobertura faltando em área crítica.
- `eslint-disable`, `@ts-ignore`, `any` em pontos sensíveis → escapes de tipo/lint.
- Segurança: secret hardcoded, validação de input ausente em entrypoint, authz checada em lugar errado, crypto fraco/sem rehash. **Só registre o que vê no código** — não rode scanner externo nem invente CVE.
- Perf: N+1, loop sobre I/O, ausência de índice/paginação onde os dados crescem.
- Manifesto: deps com major desatualizado, pacote sem manutenção.

## Regras

- **Severidade (enum) e id em todo achado.** É o que torna o doc acionável por humano (triagem) e por máquina (ingestão do `sdd:plan`).
- **Observado, não imaginado.** "Esse repo poderia ter problema de X" não é achado. "`auth.ts:42` confia em `req.headers` sem validar" é.
- Sem achados numa área → não crie o arquivo. Sem achados em lugar nenhum → `concerns/` recebe um único `tech-debt.md` com a nota de "nenhum achado relevante", e o README registra isso.
- Cross-linke para o doc descritivo da área quando útil (`fragile-areas.md` → `patterns/mapper-pattern.md`), mas concern e descrição vivem separados de propósito.
- **Não duplique os outros docs.** Inconsistência de naming é `conventions/`, não concern. Concern é risco, não divergência de estilo.

## Volatilidade (importa pro diff mode)

Concerns somem quando o código é corrigido. Em **diff mode**, ao tocar uma área:
- Remova o achado que o diff resolveu (não deixe concern morto). Inclui o caso em que uma task de remediação do `sdd:plan` (rastreada como `Origem: CONCERN-NNN`) fechou o achado — remova o `CONCERN-NNN` e registre.
- Adicione o que o diff introduziu, com `id` novo (não reuse o número de um removido).
- Registre no `## Changelog` do doc o que mudou e por quê (`- [data]: removido CONCERN-007 (timeout do stream), corrigido em <commit/arquivo>`).
