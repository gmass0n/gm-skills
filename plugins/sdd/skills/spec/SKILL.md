---
name: spec
description: Capture a feature as a complete, testable SDD specification.
disable-model-invocation: true
---

# SDD — Specify

*You have already been invoked; these instructions are now active context, not a pending action. Do not call the Skill tool to invoke this skill again.*

Create and incrementally maintain `docs/specs/<feature>/spec.md`: an English, testable contract for a feature. Live narration and interview questions stay in the user's detected language.

## Ground before interviewing

1. Read `docs/codebase/context.md` and only the documents it routes to this feature. Load confirmed lessons before asking questions.
2. Verify prompt assumptions against the code through focused exploration. Record contradictions and let the user decide; never turn a premise into a requirement without evidence.
3. If multiple repositories are involved, establish the producer → transformer → consumer chain first. Record each real slug, role, base branch, and local clone state before product detail.

## Clarification loop

1. Ask one question at a time through the native question UI, with a grounded recommended option first. Exhaust relevant happy paths, errors, limits, legacy data, states, timing, and explicit out-of-scope boundaries.
2. Persist every unresolved ambiguity immediately as `[NEEDS CLARIFICATION: ...]`; silence is not a decision. Before persisting a consequential delegated decision, reconcile it with the decision log: preserve an agreeing entry, record a supersession trace for a changed one, or stop for the user when the conflict is unresolved. Record its source and `file:line`/official-doc evidence with the affected REQs.
3. Express requirements as observable EARS statements with stable REQ-IDs and measurable acceptance criteria. If an external route, field, or event is not confirmed from its official documentation, mark it `[UNVERIFIED]`.
4. For multi-repo work, use the topology table and tag each REQ with exactly one repository. Split cross-repo behavior into one REQ per responsible repository.
5. Include a state, sequence, or flow diagram whenever it exposes nontrivial lifecycle, interaction, or time-window behavior; skip it for trivial linear work.

Use [the specification template](templates/spec.template.md) for the required structure and frontmatter. Its `status` becomes `ready` only when the clarification section is empty and the user confirms the picture is complete.

## Finish and hand off

Before marking ready, verify every REQ has acceptance criteria, every consequential decision has reconciled evidence and affected REQs, external uncertainty is explicit, and—when applicable—the repository table, chain, and REQ tags are complete. Write no design, class names, or file layouts, and do not change source code.

Report the ready specification path and tell the user to invoke `$sdd:plan <feature>` manually. The plan inherits the recorded topology and requirement mapping; it does not rediscover them.
