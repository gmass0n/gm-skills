# Disciplina de hipóteses — leia quando um bug te tentar a pular pro fix

O fluxo (hipóteses → instrumenta → reproduz → confirma → corrige na raiz → prova → limpa) está no SKILL.md. Este arquivo é o *porquê* e a defesa contra as racionalizações que silenciosamente o erodem. Leia-o quando uma hipótese parecer óbvia demais para testar, quando a pressa empurrar pro "vou só tentar esse fix", ou quando você se pegar prestes a editar produção sem evidência de runtime.

## O princípio central

**Se você não viu a evidência de runtime confirmar a causa, você não sabe a causa — está adivinhando.** Um fix aplicado sobre um palpite pode até apagar o sintoma, mas isso não prova nada: ele pode estar mascarando a causa real, que reaparece noutro lugar na semana seguinte. A linha do `.jsonl` que mostra `user=null` na fronteira é o que transforma "acho que é o upstream" em "é o upstream, vi acontecer". Sem ela, o fix é decoração: verde na tela, sem provar nada.

É por isso que a ordem não é negociável. Hipóteses-primeiro não é burocracia — é a fonte inteira do valor do fix como solução real. E é o atalho, não o desvio: um palpite errado custa três fixes em sequência, cada um mascarando o anterior, e um diff que vira lixo. A evidência custa uma instrumentação e uma reprodução. O caminho rigoroso é o mais curto.

## As racionalizações, e por que cada uma está errada

Estes são os pensamentos que aparecem no meio da caça. Nomeá-los é como você resiste a eles.

- **"É óbvio o que é, vou só corrigir."** Se é óbvio, confirmar custa uma linha de log e dez segundos de reprodução — e quando *não* era óbvio (o que acontece mais do que se admite), você acabou de evitar um fix errado. O custo de confirmar é minúsculo; o de não confirmar é um diff que não resolve nada e esconde o bug real.
- **"Vou tentar esse fix e ver se resolve."** Isso é guess-and-check — exatamente o thrashing que a skill existe para impedir. "Ver se resolve" sem uma hipótese e sem evidência é mexer no escuro; se "resolver", você não sabe *por quê*, e um fix que você não entende volta.
- **"Não entendo totalmente, mas isso talvez funcione."** Um fix que você não entende não é um fix — é uma aposta. Ou ele mascara o sintoma (e o bug volta), ou muda outra coisa que você não previu. Pare e trace o dado até a origem; a evidência de runtime existe justamente para substituir o "talvez".
- **"Só mais uma tentativa."** Essa é a frase que precede o thrashing infinito. Se duas ou três já falharam, a quarta na mesma direção não vai acertar — o problema é a premissa, não a implementação. É o gatilho do circuit breaker, não de mais um chute.
- **"O stack trace é longo, vou direto à minha teoria."** A mensagem de erro frequentemente contém a solução exata. Pular a leitura para teorizar é trocar a evidência que o runtime já te deu de graça por um palpite.

## Tabela de red-flags — reconheça a própria desculpa

Estas frases (do `systematic-debugging`) são sinais de que você saiu da investigação e voltou a adivinhar. Quando uma delas passar pela sua cabeça — ou pelo seu texto — é o sinal para **voltar à F2** e exigir evidência antes de tocar produção.

| A frase-armadilha | O que ela realmente significa | O que fazer |
|---|---|---|
| "Quick fix for now, investigate later" | Você vai mascarar o sintoma e o "later" nunca chega | Investigue agora — a causa raiz É o fix menor |
| "Just try changing X and see if it works" | Guess-and-check sem hipótese | Forme a hipótese, instrumente, confirme com runtime |
| "I don't fully understand but this might work" | Aposta, não fix | Trace o dado até a origem antes de editar |
| "One more fix attempt" | Você já está em thrashing | Circuit breaker: pare, re-hipotetize a premissa |
| "It's probably the same as last time" | Premissa não verificada | Confirme com evidência; bugs parecidos têm causas diferentes |

O objetivo da tabela não é te proibir de pensar rápido — é te dar um espelho. No instante em que você reconhece a própria desculpa nela, você sabe que precisa de evidência, não de mais um palpite.

## O circuit breaker em detalhe

Cada ciclo "instrumentei/corrigi → reproduzi → nenhuma hipótese confirmou, ou o fix não segurou" conta como **uma tentativa**. Conte-as honestamente — incluindo as que você descartou rápido.

**Após 3 tentativas falhas, pare.** Não tente uma 4ª variação na mesma direção. Três hipóteses que não seguraram quase nunca significam "preciso de uma 4ª hipótese parecida" — significam que uma **premissa** está errada:

1. **O sintoma é o que você acha que é?** Talvez o erro visível seja consequência de outro, anterior, que você nem olhou.
2. **Você está no arquivo certo?** O grep dos callers pode ter apontado a função errada; a causa pode estar uma camada acima.
3. **O repro reproduz mesmo este bug?** Um repro que dispara *outro* caminho te dá evidência de um bug que não é o seu — e você persegue um fantasma.

Volte à F2 e re-hipotetize do zero questionando essas três premissas. Se ainda assim travar, **escale ao humano com o report completo** — as 3 hipóteses refutadas e a evidência de cada uma. Isso não é desistir; é entregar ao humano um mapa do que já foi descartado, para ele decidir com contexto em vez de você seguir chutando. Honestidade vence thrashing.

## O que distingue uma boa hipótese

Uma hipótese testável tem três partes, e é a terceira que a torna útil:
- **Mecanismo:** *por que* o bug acontece ("`user` é null porque o middleware de auth não roda na rota pública").
- **Onde:** a camada/arquivo onde isso vive (do mapa da codebase).
- **Como distinguir:** qual evidência de runtime a confirma *e a separa das outras* ("se for isso, o `.jsonl` mostra `user=null` já na entrada do controller, antes do service").

Sem a terceira parte, você tem um palpite, não uma hipótese — duas hipóteses que a mesma evidência confirmaria são, na prática, uma só. Desenhe a instrumentação (F3) para produzir exatamente a evidência que separa uma da outra. É isso que faz a F4 ser conclusiva em vez de ambígua.
