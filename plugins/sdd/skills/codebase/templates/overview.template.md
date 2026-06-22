# Template: `overview.md`

A visão de avião do sistema. O leitor abre este arquivo primeiro e sai sabendo: que sistema é, que stack roda, como está dividido, e como uma requisição percorre o código ponta a ponta. Os detalhes operacionais de cada lib ficam em `integrations/` — aqui só o panorama, com links.

## Idioma e forma

PT-BR. Identificadores, caminhos, nomes de lib verbatim.

## Estrutura do doc

```markdown
# Visão geral

<1 parágrafo: o que é o sistema, que tipo de serviço, entrypoints (HTTP/CLI/worker),
estilo arquitetural base. Aponta para integrations/ para o detalhe de libs.>

## Stack resumida
<Tabela: Concern → Integração atual → Referência canônica (link para integrations/*
ou conventions/* ou patterns/*). Uma linha por concern: HTTP server, CLI,
persistência, observabilidade, health, docs, auth/crypto, validação ENV, qualidade.>

## <Aliases / module resolution>   (quando o repo usa path aliases)
<Bloco real do tsconfig/jsconfig paths. Regra de uso: quando usar alias vs relativo.>

## <Estrutura de alto nível / bounded contexts>
<Árvore depth 1–2 de src/ com 1 comentário por entrada. Mostra a divisão macro:
entrypoints, módulos/contextos, shared.>

## Fluxo <protocolo> ponta a ponta   (um bloco por entrypoint: HTTP, CLI…)
<Diagrama ASCII vertical do caminho de uma requisição real: Guard → Controller →
Mapper → Facade → Bus → Handler → Domain → Adapter → DB → volta. Anote cada passo
com a classe real e seu folder. É o doc mais valioso para onboarding — mostra como
as camadas conversam numa request concreta.>

## Princípios não-negociáveis
<Lista numerada das invariantes do sistema, cada uma verificável: "Domain não importa
framework — verificado por <lint>", "Cobertura ≥ X% blocking no pre-push". Cada
princípio aponta (implícita ou explicitamente) para o doc que o detalha.>
```

## Onde olhar no repo

- Entrypoints: `main.*`, `index.*`, `console.*`, `cmd/`, `manage.py`.
- Manifesto + config de aliases.
- A árvore de `src/` em depth 1–2.
- UM fluxo real completo: siga uma rota do controller até o banco e de volta. Esse trace é o coração do overview.
- Os gates de qualidade (coverage, lint blocking) → viram os princípios não-negociáveis.

## Regras

- O fluxo ponta a ponta é a parte mais importante. Trace um caminho real, com nomes de classe e folders reais. Não generalize.
- Cada linha da stack table aponta para o doc canônico — o overview não duplica `integrations/`, referencia.
- Princípios não-negociáveis são **verificáveis**, não slogans. Se não há enforcement, não é não-negociável — é aspiração; rebaixe.
- Mantenha alto nível. Detalhe de implementação pertence aos docs filhos.
