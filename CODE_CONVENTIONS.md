# Code Conventions & Working Agreement

How code gets written and reviewed in this project. `CLAUDE.md` documents what the codebase *is*
(commands, architecture, file layout); this documents the standards new code is held to and how
work actually gets done here.

## Core principles

1. **Don't repeat yourself.** Before writing a new function/method, check whether one that already
   does what's needed exists, and reuse it. If the same logic is needed in more than one place,
   extract a shared helper rather than duplicating it.
2. **Keep it simple.** Prefer the simplest solution that actually satisfies the task at hand — no
   abstraction, configuration, or generalization the task doesn't call for. Three similar lines
   beats a premature abstraction.
3. **Declarative, self-documenting naming.** Every variable, function, type, and interface should
   make its own purpose clear from its name alone.
4. **Minimize comments.** Code should explain itself through naming and structure. Add a comment
   only when it's strictly necessary — a non-obvious constraint, a workaround, a subtle invariant —
   and keep it short. Never reference this project's local-only planning docs (`.local/`) from a
   comment or commit — they won't exist for anyone else who clones the repo.
5. **Keep functions/methods short** — a soft guideline, not a hard rule. Past ~30-40 lines, consider
   whether splitting it would actually improve readability.
6. **Watch cognitive complexity.** Deeply nested conditionals, many branches, and compound boolean
   logic all drive this up — the fix is usually the same as for function length: extract and name
   the sub-piece so the complexity moves with it.
7. **No shims when refactoring.** When renaming or moving something, update every call site. Don't
   leave a backward-compatibility re-export or a "removed" comment behind for code with no other
   consumers — delete it outright.
8. **Prefer named parameters over positional ones.** A function/method taking more than one
   argument should take a single destructured object (`createUser({ email, password })`) rather than
   a positional argument list (`createUser(email, password)`) — this is already the convention
   throughout the codebase. Named parameters make call sites self-documenting without needing to
   check the signature, remove the risk of two same-typed arguments getting silently swapped, and
   let a new optional field get added later without touching every existing call site. A function
   that only ever takes one clearly-named argument (e.g. a single `id` lookup) doesn't need this —
   the rule is about avoiding ambiguous multi-argument positional lists, not about wrapping
   everything in an object reflexively.

## Don't guess — verify

Never write code against an unverified assumption about how something behaves, what a library
actually does, or what the current schema/state is — check it (read the code, run it, query the
database) or ask, before designing around it. If a genuine assumption is unavoidable, flag it
explicitly and prominently rather than silently building on it as if it were confirmed.

## Testing

- **TDD-first**: write the failing test before the implementation. This is the standing convention
  going forward — note that it's a deliberate change from this project's earlier history, where
  implementations were reviewed for gaps first and tests followed; new work should lead with the
  test.
- One `__tests__/x.test.ts` colocated per source file `x.ts`.
- Working target is ~100% statement/branch/function/line coverage per file. Trust
  `coverage/coverage-summary.json` over the terminal table when checking — the table omits fully-covered
  files, which can look like a missing test file when it's actually complete.
- After each implementation step — not just once at the end — run typecheck, lint, and the affected
  tests. Catching a regression while the diff that caused it is still small beats finding it in one
  big pass at the end, especially when a later step's change breaks something an earlier, already-
  finished step depends on.
- Prove correctness with concrete evidence before considering something done: an actual `curl`
  against a running server, an actual applied migration inspected with `\d`, an actually-booted
  compiled build — not just "the test suite is green." This project has been doing this already
  (e.g. actually running the compiled server after the NodeNext migration, actually applying and
  inspecting the tenant_id migration); keep doing it deliberately, not only when something feels
  risky enough to double-check.

## Architecture conventions

- A service should not reach into another module's repository directly — go through that module's
  service. See `CLAUDE.md` for the full module layout.
- Two distinct error tiers: repositories throw plain `Error` subclasses for domain-level failures
  (e.g. `DuplicateEmailError`); the service layer translates those into the right
  `CustomRequestError` subclass for the HTTP response. A repository should never throw a
  `CustomRequestError` directly, and a controller shouldn't need to know about repository-level
  error types at all.
- Config values are read from `process.env` with a documented fallback in
  `api/config/environment-config/config.ts` — never hardcode a value that legitimately differs per
  environment (a host, a credential, a pool size) directly in code.
- **Error-handling target state (not yet migrated — see `.local/technical-debt.md`):** the agreed
  direction is one centralized Express error-handling middleware instead of each controller calling
  `BaseController.handleError()` directly, alongside an Express 4→5 upgrade. Until that migration
  lands, keep using the existing per-controller pattern for any new or edited controller — don't
  migrate a single controller in isolation and leave the codebase inconsistent about which pattern
  is current.
