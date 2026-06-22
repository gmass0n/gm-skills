# Archetype: `layers/<camada>-layer.md`

Um documento por **camada que o projeto realmente tem**. Leia a convenção de pastas de um módulo representativo e gere um doc por camada existente — não imponha um modelo de 4 camadas num repo que tem 2. Nomes de camada seguem o repo (`domain`/`application`/`infrastructure`/`presentation`, ou `models`/`services`/`views`, ou o que for).

## Idioma e forma

PT-BR. Identificadores, caminhos e nomes de lib verbatim.

## Estrutura do doc

```markdown
# <Nome da camada> Layer

## Regra-de-ouro
<O que esta camada PODE e NÃO PODE importar/fazer, em 1–3 frases. Para um domain:
"TypeScript puro: nenhum import de framework/ORM. Imports permitidos: o próprio
domain + shared.">

<Se há lint rule que impõe isso, cole o trecho real aqui mesmo.>

## Pastas da camada
<Árvore das subpastas reais desta camada num módulo, com 1 linha por subpasta.>

## <Elementos principais>   (uma seção por tipo de elemento da camada)
<Para cada tipo (entities, value-objects, ports / handlers / adapters / controllers…):
um trecho de código REAL com `// caminho`, e a regra que ele exemplifica. Liste os
elementos existentes do tipo com 1 linha cada. Cross-linke para o pattern doc que
detalha o elemento: "Padrão completo em [entity-pattern.md](../patterns/entity-pattern.md)".>

## Anti-padrões
<Lista com ❌. O que parece pertencer à camada mas a viola.>
```

## Onde olhar no repo

- A árvore de pastas de UM módulo representativo (depth 2–3 dentro da camada).
- Os imports no topo dos arquivos da camada → revelam o que ela conhece.
- A lint rule de boundaries que restringe a camada → a prova da regra-de-ouro.
- 5–10 arquivos representativos da camada. Não leia todos.

## Regras

- A regra-de-ouro de uma camada é sobre **dependências permitidas**. Comece por aí.
- Cada tipo de elemento aponta para seu `patterns/*.md` — o layer doc dá o panorama, o pattern doc dá o detalhe.
- Não duplique o pattern doc. Aqui: "que elementos existem e o que a camada permite". Lá: "como construir um".
- Anti-padrões vêm de violações plausíveis e reais, não de uma lista genérica.
