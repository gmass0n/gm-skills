# TDD discipline — read when a task tempts you to skip the red step

The operational loop (RED → watch fail → GREEN → watch pass → REFACTOR, repeated per `Verificação` criterion, then one atomic commit) is in SKILL.md, and the plan's per-task Steps already lay it out in order. This file is the *why* and the defense against the rationalizations that quietly erode it. Read it when a test is awkward to write, when the code seems "too simple to test", or when you catch yourself about to write code first.

## The core principle

**If you didn't watch the test fail, you don't know that it tests the right thing.** A test written after the code passes on the first run — but that tells you nothing, because it would also pass against broken code you haven't written yet. The failing run is the evidence that the test actually exercises the behavior. Skip it and the test becomes decoration: green, but proving nothing.

This is why the order is not negotiable. The red step is not bureaucracy — it's the entire source of the test's value as proof. In this workflow, that proof is load-bearing: the closing gate trusts a green test to mean a requirement is met. A test that never failed can't carry that trust.

## The rationalizations, and why each is wrong

These are the thoughts that show up mid-task. Naming them is how you resist them.

- **"This is too simple to need a test."** Simple code breaks too — an off-by-one, a wrong default, a flipped boolean. And "simple" code is exactly where a 30-second test is cheap. If it's truly trivial (a constant, a pure re-export), the task probably shouldn't have had a `Verificação` line; if it does, honor it.
- **"I'll write the test right after."** You won't watch it fail, so it won't prove anything — and "after" tends to become "never" under pressure. The cost of test-first is front-loaded and small; the cost of test-after is a false green that hides a real bug.
- **"The test is hard to write."** A hard-to-test unit is usually telling you the design is tangled — too many responsibilities, hidden dependencies, no seam. That's signal, not friction. Listen to it: the test difficulty is surfacing a design problem the codebase map would also frown on.
- **"I already know it works, I ran it manually."** Manual runs aren't repeatable and don't gate the next change. The next person (or the next task) needs the test to catch a regression you can't foresee.
- **"It's just a refactor."** Refactor means behavior unchanged — which is exactly what the existing tests prove. If there's no test covering what you're about to refactor, write it first (and watch it pass against current code), *then* refactor under its protection.

## What a good test asserts

Write the test from the task's `Verificação` criterion, which traces to an acceptance criterion in the spec. So the test asserts **observable behavior tied to a requirement**, not implementation details:
- Good: "emite evento `order.status` com o code quando o pedido muda" — that's REQ-1's observable behavior.
- Bad: "chama `adapter.subscribe()` uma vez" — that's testing the mechanism, and it'll break on a harmless refactor while proving nothing about the requirement.

If you can't phrase the test in terms of observable behavior, that's a sign the task or the requirement is under-specified — surface it rather than writing a brittle mechanism-test.

## Watching it fail — what to look for

The failing run should fail **for the right reason**: an assertion failure about the missing behavior, not a syntax error, a missing import, or a typo'd test name. A test that fails because it doesn't compile hasn't tested anything yet. Get it to fail cleanly on the assertion, *then* write the code. If it fails for a setup reason, fix the setup and re-run until the failure is the real one.

## When green comes too easy

If the test passes the first time you run it — before you wrote the code — stop. Either the behavior already exists (then the task is redundant; verify and note it) or the test isn't actually exercising the new path (then it's a bad test; fix it until it fails for the right reason). A test that was never red is not yet a test.
