# Template: `spec.md`

The **WHAT/WHY** contract of a feature. Lives in `docs/specs/<feature>/spec.md`. It is the root of the proof chain: every `REQ-ID` here will be traced by `sdd:plan` (REQ→task→test matrix) and proven green by `sdd:implement`. This template IS the contract — `sdd:plan` reads it expecting exactly these sections and this REQ-ID format.

## Language

`spec.md` is ALWAYS written in English, regardless of the conversation language. The `lang: pt|en` frontmatter key records the interview/narration language (how you talk to the human), not the language of this file. `sdd:plan` inherits it.

## Structure

```markdown
---
title: <feature>
lang: pt | en
status: draft | ready          # "ready" only when "Open clarifications" is empty
generated: <date>
---

# Spec: <feature>

## Context & goal
<why it exists, what problem it solves. 2-3 sentences. ZERO code.>

## Repos involved
<ONLY multi-repo (feature touches >1 repo). In single-repo OMIT this whole section
 and DON'T tag the REQs — the spec stays byte-identical to the single-repo format.
 Parseable table: the plan reads it directly and inherits the topology (does not re-discover root/slug/branch/clone).
 One row per repo, ordered by the chain. Columns:
   tag         = short handle (LOC/CUS/BFF/POR) — used to tag REQs and, later, tasks.
   repo (slug) = real repo slug (pos-facil-api etc.), not a friendly name.
   role        = produces / transforms / consumes (from the boundary question:
                 produces=mints the data, transforms=reshape/forward, consumes=reads).
   base branch = master / develop (where this repo's feature branch forks from).
   cloned?     = yes / no / <where> (is it cloned locally and where — so the plan doesn't re-discover it).
 A cell you can't pin down = ambiguity → [NEEDS CLARIFICATION], same loop.>
| tag | repo (slug) | role | base branch | cloned? |
|-----|-------------|------|-------------|---------|
| LOC | locations-api | produces | master | yes |
| CUS | pos-facil-api | transforms | master | yes |
| BFF | seru-delivery-api | transforms | develop | yes (this repo) |
| POR | seru-delivery-portal | consumes | develop | no |

Chain: LOC → CUS → BFF → POR

## User stories
- US-1: As a <persona>, I want <capability> so that <benefit>.
- US-2: ...

## Requirements (EARS, with REQ-IDs)
<EARS = Easy Approach to Requirements Syntax. Each REQ is observable and testable.
 Patterns: WHEN <trigger>, THE system SHALL <action>. / WHILE <state>, THE system
 SHALL <action>. / IF <condition>, THEN THE system SHALL <action>. REQ-IDs are stable
 and sequential — once assigned, a number is never reused.
 Multi-repo: each REQ ends with (repo: <tag>) — the plan derives the task's Repo: field
 from this map, it doesn't guess. A REQ that crosses 2 repos becomes 2 REQs (one per repo), not 1 with 2 tags.
 Single-repo: no tag.>
- REQ-1: WHEN an order changes status, THE system SHALL emit a notification to the connected operator within 2s. (repo: BFF)
- REQ-2: WHILE the operator is disconnected, THE system SHALL discard notifications (no backlog). (repo: BFF)
- REQ-3: IF the SSE connection drops, THEN the client SHALL reconnect automatically. (repo: POR)

## Acceptance criteria (per requirement)
<one block per REQ — it's what becomes the test in the plan. Concrete and verifiable.>
- REQ-1: given an order in "preparing", when it becomes "ready", then the operator's stream receives an `order.status` event with the code within ≤2s.
- REQ-2: given a disconnected operator, when an order changes, then no notification is queued.

## Validation diagram
<OPTIONAL — only when it helps validate the understanding (lifecycle/state machine,
 multi-component flow, process with branches). Trivial/linear CRUD: OMIT (YAGNI).
 Type by what the spec is: state (status that transitions) / sequence (components over
 time) / flowchart (process with decisions). Drawn WITH the user before "ready".>
```
PENDING ──payment──> PAID
   │                  │
   └──expires(grace 5d)──┴──fails──> FAILED ──retry(7d)──> SUSPENDED ──30d──> CANCELLED
```

## Out of scope
<closes the door to scope creep. What does NOT belong in this feature.>
- Push/email notification.
- Persisted notification history.

## Interview decisions & constraints
<decision log: the conditioning-HOW settled in the grill. Not a requirement, but the plan inherits it.
 Each line: decision + why + affected REQ.>
- D-1: SSE instead of WebSocket — unidirectional is enough for REQ-1 and needs less infra. Affects REQ-1, REQ-3.
- D-2: No persistence layer — REQ-2 defines a stateless stream. Affects REQ-2.

## Open clarifications
<the [NEEDS CLARIFICATION: ...] still open. Persisted HERE the moment they surface.
 While this section has items, status = draft and sdd:plan REFUSES.
 When empty: "None." and status = ready.>
- [NEEDS CLARIFICATION: does reconnection re-deliver missed notifications or only from then on?]
```

## Filling rules

- **Stable REQ-IDs.** Sequential, never reused. They are the backbone of traceability — the plan and implement reference them by ID.
- **A requirement is observable, not implementation.** "THE system SHALL emit event" (observable) — not "the SeruNotificationAdapter subscribes to the stream" (that's design, goes to the plan).
- **Every REQ has a measurable acceptance criterion.** No verifiable number/condition → becomes `[NEEDS CLARIFICATION]`, doesn't pass.
- **Unconfirmed external contract = `[UNVERIFIED]`.** An external-API field/route/event you haven't confirmed against the official doc goes in marked `[UNVERIFIED]` — valid in the spec, but the marker rides down to the plan to confirm before coding. Never state an external contract as fact without a source.
- **Composing time windows: sum and validate the total.** Retry + grace + expiry — ask the user whether they are parallel or sequential and confirm the aggregate SLA (8d vs 15d). Draw it in the "Validation diagram" so the gap shows up.
- **Decisions ≠ Clarifications.** Decisions = what was CLOSED in the grill (the plan inherits). Clarifications = what is OPEN (the plan waits on). The two sections are opposite halves of the handoff.
- **Multi-repo: topology is an artifact, not prose.** `## Repos involved` (table + `Chain:`) and the `(repo: <tag>)` on each REQ are born HERE, in the spec — the plan inherits the topology and derives each task's `Repo:` from the REQ→repo map, without re-discovering root/slug/branch/clone. Single-repo: section omitted and REQs untagged (spec byte-identical to the single-repo format).
- **Incremental persistence of clarifications.** The marker enters this section the instant the ambiguity surfaces — not at the end. That's what makes the spec resumable if the session dies.
- **`status: ready` is a real gate.** It only becomes `ready` with "Open clarifications" empty. `sdd:plan` reads this and the frontmatter — a `draft` spec or one with an open marker is refused.
