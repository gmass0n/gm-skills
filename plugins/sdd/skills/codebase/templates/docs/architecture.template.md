# Archetype: `architecture/<decisão>.md`

Um documento por **decisão ou estilo arquitetural macro** que o código realmente assume. Não documente estilos que o repo *poderia* usar — só os que estão impostos na estrutura.

Sinais que justificam um doc aqui: regra de dependência entre camadas, ports & adapters (abstração + implementação concreta trocável), CQRS (split command/query/handler/bus), bounded contexts (módulos auto-contidos), layout de monorepo.

## Idioma e forma

PT-BR. Identificadores, caminhos e nomes de lib ficam verbatim.

## Estrutura do doc

```markdown
# <Nome do estilo>   (ex.: Clean Architecture, Hexagonal Architecture, CQRS)

## Regra-de-ouro
<A invariante central em 1–3 frases. Para Clean Arch: "A dependência aponta sempre
para dentro." Se há um diagrama ASCII de fluxo de dependência que cabe, inclua.>

## Mapeamento para folders   (quando o estilo se materializa em pastas)
<Tabela: camada/elemento → folder → o que pode importar. Caminhos reais do repo.>

## Como cada parte isola a próxima   (a prova)
<Trechos de código REAL, cada um com `// caminho/do/arquivo`, mostrando a regra
em ação. Para cada camada/elemento, um exemplo curto que prova o isolamento.
Mostre o import permitido E o proibido.>

## Sintomas de violação
<Lista de imports/estruturas que denunciam quebra do estilo. "`import X` em Y → errado.">

## Por que essa rigidez   (opcional, mas valioso)
<Testabilidade, trocabilidade, onboarding. Por que a regra existe, não só qual é.>
```

## Onde olhar no repo

- A estrutura de pastas repetida entre módulos → revela o estilo de camadas.
- Classes abstratas (ports) + implementações concretas (adapters) + ponto de wiring (`provide/useClass`, factory, container).
- Command/Query/Handler/Bus → CQRS.
- Config de lint de boundaries / import rules → **a prova de que o estilo é imposto, não aspiracional.** Cite e cross-linke para o doc de `conventions/` que detalha o enforcement.

## Regras

- Cross-linke para `conventions/*-boundaries.md` (ou equivalente) — é lá que o enforcement vive.
- Cross-linke para os `layers/*.md` que este estilo organiza.
- Toda afirmação cita um caminho real. Diagrama sem código embaixo não prova nada.

## Exemplo (extraído de um repo NestJS — adapte ao stack alvo)

```markdown
# Clean Architecture

## Regra-de-ouro

**A dependência aponta sempre para dentro.** Camadas externas conhecem internas;
internas não conhecem externas.

Presentation ──► Application ──► Domain ◄── Infrastructure

## Como cada camada isola a próxima

### Domain isola tecnologia
\`\`\`ts
// src/modules/identity/domain/entities/user.entity.ts
export class User {
  // ZERO imports de NestJS, Fastify, Mongoose.
}
\`\`\`

Reforçado por `eslint-plugin-boundaries` — ver [eslint-boundaries.md](../conventions/eslint-boundaries.md).

## Sintomas de violação
- `import { MongooseUserRepository }` em `presentation/` → errado.
- `import '@nestjs/common'` em `domain/` → errado.
```
