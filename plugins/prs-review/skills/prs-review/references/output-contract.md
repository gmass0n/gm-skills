# Contrato de saída

O `.txt` segue exatamente esta ordem. Omita por inteiro `🔴 BLOCKERS`,
`🟡 WARNINGS` ou `✅ PRAISE` quando a seção não tiver conteúdo.

1. Uma linha: `🔴 CODE REVIEW REJEITADO` ou `🟢 CODE REVIEW APROVADO`.
2. Uma linha em branco e a lista numerada dos PRs:
   `<n>. <url-original> - <N> commit(s) - <autor> - <🔴 REJEITADO | 🟢 APROVADO>`.
   Use `commit` quando `N == 1`; caso contrário, `commits`.
3. As seções existentes, nesta ordem: `🔴 BLOCKERS`, `🟡 WARNINGS`,
   `✅ PRAISE`.

Não use tabelas, alinhamento por espaços, resumo ou recomendação. Cada achado
ocupa uma única linha e todo identificador de código fica entre crases.

Para lote com um PR, liste os achados numerados diretamente sob o título. Para
dois ou mais, agrupe por `PR #<id> — <repo>` e reinicie a numeração em cada PR.
Se dois repos tiverem o mesmo nome, use `<owner>/<repo>`.

Blocker: `` `arquivo:Llinha`: <problema> → <impacto>. <fix>.``

Cobertura incompleta também é blocker e usa caminho(s) reais, por exemplo:
`` `src/a.ts`, `assets/logo.png`: cobertura incompleta; não foi possível ler o
patch/conteúdo no head do PR → o diff novo não foi totalmente revisado. Disponibilize
os arquivos/conector e repita a revisão.`` Nunca aprove um PR com esse blocker.

Warning: `` `arquivo:Llinha`: <problema>. <fix>.``

Praise: só um ponto positivo comprovável do diff; não invente. Nits nunca são
incluídos.
