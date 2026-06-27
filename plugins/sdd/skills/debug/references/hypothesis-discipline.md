# Hypothesis discipline — read this when a bug tempts you to jump to the fix

The flow (hypotheses → instrument → reproduce → confirm → fix at the root → prove → clean up) is in SKILL.md. This file is the *why* and the defense against the rationalizations that silently erode it. Read it when a hypothesis seems too obvious to test, when haste pushes you toward "I'll just try this fix", or when you catch yourself about to edit production without runtime evidence.

## The core principle

**If you haven't seen the runtime evidence confirm the cause, you don't know the cause — you're guessing.** A fix applied over a hunch may even erase the symptom, but that proves nothing: it might be masking the real cause, which reappears somewhere else the following week. The `.jsonl` line showing `user=null` at the boundary is what turns "I think it's the upstream" into "it's the upstream, I saw it happen". Without it, the fix is decoration: green on screen, proving nothing.

That's why the order is non-negotiable. Hypotheses-first is not bureaucracy — it's the entire source of the fix's value as a real solution. And it's the shortcut, not the detour: a wrong guess costs three fixes in a row, each masking the previous one, and a diff that turns to junk. The evidence costs one instrumentation and one reproduction. The rigorous path is the shortest one.

## The rationalizations, and why each one is wrong

These are the thoughts that show up in the middle of the hunt. Naming them is how you resist them.

- **"It's obvious what it is, I'll just fix it."** If it's obvious, confirming costs one log line and ten seconds of reproduction — and when it *wasn't* obvious (which happens more often than people admit), you just avoided a wrong fix. The cost of confirming is tiny; the cost of not confirming is a diff that resolves nothing and hides the real bug.
- **"I'll try this fix and see if it resolves it."** That's guess-and-check — exactly the thrashing the skill exists to prevent. "See if it resolves it" without a hypothesis and without evidence is poking in the dark; if it "resolves it", you don't know *why*, and a fix you don't understand comes back.
- **"I don't fully understand it, but this might work."** A fix you don't understand isn't a fix — it's a bet. Either it masks the symptom (and the bug comes back), or it changes something else you didn't foresee. Stop and trace the data to its origin; runtime evidence exists precisely to replace the "maybe".
- **"Just one more attempt."** That's the phrase that precedes infinite thrashing. If two or three have already failed, the fourth in the same direction won't hit — the problem is the premise, not the implementation. It's the trigger for the circuit breaker, not for one more guess.
- **"The stack trace is long, I'll go straight to my theory."** The error message frequently contains the exact solution. Skipping the read to theorize is trading the evidence the runtime already gave you for free for a hunch.

## Red-flags table — recognize your own excuse

These phrases (from `systematic-debugging`) are signs you've left the investigation and gone back to guessing. When one of them passes through your head — or your text — it's the signal to **go back to F2** and demand evidence before touching production.

| The trap phrase | What it really means | What to do |
|---|---|---|
| "Quick fix for now, investigate later" | You're going to mask the symptom and "later" never comes | Investigate now — the root cause IS the smaller fix |
| "Just try changing X and see if it works" | Guess-and-check without a hypothesis | Form the hypothesis, instrument, confirm with runtime |
| "I don't fully understand but this might work" | A bet, not a fix | Trace the data to its origin before editing |
| "One more fix attempt" | You're already thrashing | Circuit breaker: stop, re-hypothesize the premise |
| "It's probably the same as last time" | Unverified premise | Confirm with evidence; similar bugs have different causes |

The point of the table isn't to forbid you from thinking fast — it's to give you a mirror. The instant you recognize your own excuse in it, you know you need evidence, not one more guess.

## The circuit breaker in detail

Each cycle "I instrumented/fixed → reproduced → no hypothesis confirmed, or the fix didn't hold" counts as **one attempt**. Count them honestly — including the ones you discarded quickly.

**After 3 failed attempts, stop.** Don't try a 4th variation in the same direction. Three hypotheses that didn't hold almost never mean "I need a 4th similar hypothesis" — they mean a **premise** is wrong:

1. **Is the symptom what you think it is?** Maybe the visible error is a consequence of another, earlier one, that you never even looked at.
2. **Are you in the right file?** The caller grep may have pointed at the wrong function; the cause may be one layer up.
3. **Does the repro actually reproduce this bug?** A repro that triggers *another* path gives you evidence of a bug that isn't yours — and you chase a phantom.

Go back to F2 and re-hypothesize from scratch, questioning those three premises. If you're still stuck, **escalate to the human with the complete report** — the 3 refuted hypotheses and the evidence for each. This isn't giving up; it's handing the human a map of what's already been ruled out, so they can decide with context instead of you continuing to guess. Honesty beats thrashing.

## What distinguishes a good hypothesis

A testable hypothesis has three parts, and it's the third that makes it useful:
- **Mechanism:** *why* the bug happens ("`user` is null because the auth middleware doesn't run on the public route").
- **Where:** the layer/file where this lives (from the codebase map).
- **How to distinguish:** which runtime evidence confirms it *and separates it from the others* ("if it's this, the `.jsonl` shows `user=null` already at the controller entry, before the service").

Without the third part, you have a hunch, not a hypothesis — two hypotheses that the same evidence would confirm are, in practice, a single one. Design the instrumentation (F3) to produce exactly the evidence that separates one from the other. That's what makes F4 conclusive instead of ambiguous.
