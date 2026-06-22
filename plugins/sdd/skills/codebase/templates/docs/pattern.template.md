# Archetype: `patterns/<padrão>.md`

Um documento por **padrão tático recorrente** — evidenciado por **≥2 ocorrências** no código. Um arquivo único não é um padrão; não documente.

Exemplos de padrões: entity, value-object, mapper, facade, dependency-injection, error-handling, env-validation, helper, controller fino, comando CLI, scope-validation, module-wiring.

## Idioma e forma

PT-BR. Identificadores, caminhos e nomes de lib verbatim.

## Estrutura do doc

```markdown
# <Nome do padrão> Pattern

## Regra-de-ouro
<A invariante do padrão em 1–3 frases. Para mapper: "Mappers vivem em `mappers/`
dentro da camada de I/O, são classes com métodos estáticos, sem estado, sem DI.
Cross-boundary é proibido.">

## <Métodos/forma canônica>   (quando o padrão tem uma API recorrente)
<Tabela ou lista da convenção: nomes de método por intenção, assinatura típica,
onde cada um aparece.>

## Exemplo(s)
<Um ou mais trechos de código REAL com `// caminho`. Se o padrão aparece em
contextos diferentes (ex.: mapper HTTP vs mapper Mongoose vs mapper JWT), mostre
um de cada. Logo abaixo, "Observe:" com os pontos que o exemplo prova.>

## <Enforcement>   (quando há lint/types/CI que impõe)
<Trecho real da regra. Cross-linke para o conventions doc.>

## Anti-padrões
<Lista com ❌. Cada um é uma tentação real que viola o padrão.>
```

## Onde olhar no repo

- `grep`/`rg` por nome do padrão ou por sufixo de arquivo (`*.mapper.ts`, `*.vo.ts`, `*.handler.ts`).
- Confirme ≥2 ocorrências antes de criar o doc.
- A lint rule que governa o padrão (composição cross-boundary, instanciação proibida, etc).

## Regras

- O exemplo é a documentação. Prosa sem código não prova o padrão.
- "Observe:" depois do código transforma o exemplo em ensino — liste o que o trecho prova (sem `new`, sem DI, composição só dentro do boundary, etc).
- Se o padrão tem variações por contexto, mostre uma de cada — é o que evita o leitor generalizar errado.
- Cross-linke para o `layers/*.md` da camada que hospeda o padrão e para o `conventions/*` que o impõe.
