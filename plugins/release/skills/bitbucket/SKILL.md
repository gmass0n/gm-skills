---
name: bitbucket
description: Preparar ou finalizar releases Bitbucket com branch release, PR para produção, tag e merge-back para develop.
disable-model-invocation: true
---

# Bitbucket Release

Execute uma release de um único repositório Bitbucket em PREPARE ou FINALIZE.
A release é representada por commit, tag, PR e relatório; não invente um
objeto de release da plataforma. Aplique o contrato comum em
[../shared/release-contract.md](../shared/release-contract.md) e detecte
convenções em [../shared/conventions.md](../shared/conventions.md).
Use [templates.md](templates.md) para o wire format do PR e do relatório.

## PREPARE

1. Confirme o caminho git e origin; derive workspace/repository da URL
   Bitbucket e confirme autenticação/API disponível. Detecte develop (ou a
   branch de desenvolvimento real), master/produção, prefixo de tag,
   manifesto/versionamento, idioma, formato de commit/PR, CHANGELOG e
   migration notes. Para primeira release, confirme defaults.
2. Faça fetch de branches e tags. Calcule o delta entre o HEAD remoto da
   produção e desenvolvimento, excluindo commits de release/changelog/version
   bump. Registre o SHA remoto usado. Se o delta for vazio, pare.
3. Procure release/<version> local/remota, tag, PR aberto
   release/<version> para master e eventual PR de merge-back. Mostre o estado:
   nenhum artefato = novo; todos os artefatos = retomar/finalizar; parcial =
   abort ou resume. Nunca recrie ou sobrescreva artefatos.
4. Analise cada commit do delta e prove no diff as mudanças, remoções,
   endpoints, eventos, schema, variáveis de ambiente e migrations. Proponha
   major/minor/patch, versão e título
   [CHORE] #RELEASE - Release X.Y.Z; peça confirmação antes de editar.
5. Depois da confirmação, parta do SHA remoto registrado e crie
   release/<version>. Atualize somente o campo de versão detectado, sem
   instalar dependências ou alterar lockfile. Atualize o CHANGELOG técnico e
   notas/descrição do PR em templates separados; inclua Migration notes.
6. Faça um único commit no estilo detectado, crie a tag na branch de release,
   publique branch e tag, e abra o PR para master. Verifique que o PR
   corresponde ao branch/versão, está sem conflito e registre links, SHAs e
   pipeline. PREPARE termina aqui.

## FINALIZE

1. Releia remotamente o PR correto release/<version> para master, seu HEAD,
   status de conflito, aprovação e pipelines/quality gates. Nenhum pending,
   failed, approval ausente ou conflito pode avançar.
2. Verifique que a tag candidata existe, é a tag esperada e aponta exatamente
   para o HEAD da branch de release (descubra o SHA apontado de tags
   anotadas). Pare e mostre a divergência se qualquer valor não casar.
3. Mostre o plano completo e aguarde uma confirmação explícita. Faça merge
   com merge commit; só use squash/rebase se escolhido explicitamente.
4. Confirme o PR MERGED, a tag no commit esperado e que a tag é ancestral de
   master. Após o merge, abra automaticamente um PR master para develop com
   migration notes e contexto da release. Nunca faça merge desse PR
   automaticamente.
5. Entregue o relatório final com PR de produção, merge commit, tag/HEAD,
   pipeline, aprovação e PR de merge-back. Se qualquer operação falhar, pare
   com diagnóstico recuperável e não tente compensar silenciosamente.

## Regras SERU

Quando as convenções detectadas forem as do portal SERU, preserve
develop -> release/* -> master + develop, o título indicado, tag na branch de
release e migration notes explícitas. Não transforme essa convenção em
default para outros repositórios.
