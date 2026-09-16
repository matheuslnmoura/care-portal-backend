# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project context

This is `care-portal-backend` (package name), a Node.js/TypeScript/Express API for a multi-tenant
healthcare booking platform ("CarePortal"): clinics are tenants, staff/providers authenticate via
this app, and patient clinical identity is intended to live in an external FHIR-compliant EHR rather
than in this app's own database. `staff_users`/`staff_user_refresh_tokens` already carry a `tenant_id` column,
but no Tenant/RBAC/patient-identity application code exists yet, so don't assume tenant scoping is
enforced anywhere just because the column exists.

See `CODE_CONVENTIONS.md` for engineering principles, testing approach, and the working agreement
new code is held to — this file covers architecture and commands, that one covers standards.

## Commands

Package manager is pnpm (see `pnpm-lock.yaml`); Node version is pinned in `.nvmrc` (v22.12.0).

- `pnpm dev` — run the API with hot reload (`nodemon` + `tsx`) against `api/server.ts` directly, no build step.
- `pnpm compile` — type-check and emit to `dist/` via `tsc -p tsconfig.build.json` (clears `dist/` first).
- `pnpm start` — compile, then run the compiled server (`node dist/server.js`). Use `pnpm dev` for local iteration instead.
- `pnpm lint` / `pnpm lint:fix` — ESLint over `api/**/*.ts`.
- `pnpm test` — run the full Vitest suite once. `pnpm test:watch` for watch mode.
- `pnpm test:coverage` — run with v8 coverage. **Trust `coverage/coverage-summary.json` over the printed terminal table** — the table only lists files below 100%, so it silently omits fully-covered files and can make it look like a file has no test file at all when it's actually at 100%.
- Run a single test file: `pnpm exec vitest run path/to/file.test.ts`.
- `pnpm migrate:status` / `pnpm migrate:up` — check/apply SQL migrations in `scripts/db/migrations/` (plain sequential `.sql` files, tracked in a `schema_migrations` table by `scripts/db/run-migrations.js`; no down-migrations, append new files rather than editing applied ones).

There is no local `.env` committed (`.gitignore` excludes all `.env*` except `.env.example`) — copy `.env.example` and fill in real values before running against a real Postgres.

## Architecture

**Request flow:** `api/server.ts` imports `./bootstrap-env.js` first (must stay the first import — it loads `.env` then `.env.<APPLICATION_ENVIRONMENT>` with override, and everything else reads `process.env` assuming that already happened), then wires Express with routes → controllers → services → repositories, in that strict direction. Repositories are the only layer that talks to Postgres/Mongo/Redis directly.

**Base class hierarchy:** almost every class (`Server`, routes, controllers, services, repositories, `DatabaseManager`, `PasswordManager`, `TokenManager`) extends `BaseClass` (`api/base/base-class/base-class.ts`), which gives it `this.config` (the shared env-driven config object), `this.logger`, `this.env`, and `this.context`. `BaseRoute` adds `getBasePath()` (prefixes `config.app.baseRoute`); `BaseController` adds `handleError()`, which maps a caught error to an HTTP response.

**Config (`api/config/environment-config/config.ts`):** a single object read entirely from `process.env` at import time, with local-dev-friendly fallbacks (Postgres defaults to `localhost`; Mongo/Redis default to unconfigured/skipped). There is deliberately no per-environment config file anymore — environment differences come only from which `.env.*` file `bootstrap-env.ts` loaded, not from branching code. When adding a new config value, add it here as an env-var read with a fallback, not as a hardcoded literal.

**Module layout (`api/modules/<name>/`):** each domain module (currently `auth`, `staff-users`) follows `route.ts` → `controller.ts` → `service/` → `repository/`, each with a co-located `__tests__/`. A service should not reach into another module's repository directly — go through that module's service.

**Principal identity split:** `staff-users` holds staff/provider accounts specifically — not a generic "user." Patients are a structurally different principal (many-to-many to tenants, no admin provisioning, no adult-age requirement, and per this project's data-ownership design their identity belongs in FHIR, not this app). `api/modules/auth/credential.ts` defines `AuthCredential`/`CredentialProvider<T>` — the minimal shape (`id`, `userId`, `passwordHash`) `AuthService` actually needs for login/refresh/logout, decoupled from any one concrete principal type. `StaffUserService implements CredentialProvider<StaffUserSchema>`; when a patient-facing principal is eventually added, it should implement the same interface rather than `AuthService` growing a second hardcoded dependency. Account creation (`createUser`) is deliberately *not* part of this interface — signup fields differ per principal type.

**Error handling, two distinct tiers (`api/exceptions/exceptions.ts`):**
- `CustomRequestError` and its subclasses (`BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `TooManyRequestsError`, `UnexpectedError`) are HTTP-facing — `BaseController.handleError` maps these to the right status code/body, and anything else falls back to a generic 500.
- Plain `Error` subclasses (`RefreshTokenNotFoundError`, `RefreshTokenOwnershipError`, `RefreshTokenRevokedError`, `RefreshTokenExpiredError`, `DuplicateEmailError`, `DuplicatePhoneError`) are repository-level domain errors with no HTTP meaning of their own — the **service** layer catches these (e.g. via `instanceof`) and translates them into the right `CustomRequestError` subclass. Repositories should keep throwing the plain domain errors; don't have a repository throw a `CustomRequestError` directly.

**Request context (`api/utils/request-context/request-context.ts`):** request-scoped state (`requestId`, `userId`) is carried via `node:async_hooks` `AsyncLocalStorage`, not mutable instance fields — this replaced an earlier design where `Logger`/middleware mutated shared state per-request, which was a real cross-request data race. `Logger` reads `getRequestId()`/`getUserId()` from this store rather than being told them directly.

**Auth (`api/modules/auth/`):** JWT access tokens + rotating refresh tokens. Refresh tokens are stored hashed in Postgres (`user_refresh_tokens`); rotation, revocation, and logout all verify token ownership against the authenticated `user_id` before mutating anything — don't add a refresh-token operation that skips that ownership check.

**Database (`api/config/database/`):** `DatabaseManager.connectAll()` connects Postgres, MongoDB, and Redis in parallel. Postgres is required (no host configured throws on connect); Mongo/Redis silently skip connecting if unconfigured — repositories should follow the same "optional dependency, skip don't crash" convention if a new one is added. `postgres-client.ts` holds the single `Pool` instance other modules read via `getPostgresPool()`.

**Module resolution:** `tsconfig.json` uses `"module"`/`"moduleResolution": "nodenext"`. Every relative import (including in test files, including dynamic `import()`) must include an explicit `.js` extension, even though the source is `.ts` — this is intentional (matches Node's native ESM resolution at runtime) and TypeScript will fail to compile a missing extension, so treat that as a real error to fix, not a build quirk to suppress.

**TypeScript config split:** `tsconfig.json` (includes tests, used by the editor/ESLint/`tsc --noEmit`) vs `tsconfig.build.json` (extends it, excludes `**/*.test.ts` and `__tests__/**`, used only by `pnpm compile`). Don't add test-only exclusions to `tsconfig.json` itself — that breaks editor type-checking for tests.

## Testing conventions

- Vitest, one `__tests__/x.test.ts` per source file `x.ts`, colocated next to it.
- Working target is ~100% statement/branch/function/line coverage per file (see the coverage command note above about trusting the JSON summary over the terminal table). `api/server.ts`, `api/types/**`, and `api/models/audit-model.ts` are excluded in `vitest.config.ts` (the latter because the audit-logging feature it belongs to isn't implemented yet — see the comment there for when to remove the exclusion).
- `vitest.setup.ts` seeds baseline env vars (JWT secrets, `APPLICATION_ENVIRONMENT=testing`, a fast `PASSWORD_SALT_ROUNDS=1`) needed before any class under test is constructed.
- Mocking a class that's constructed with `new X()` in the code under test requires the `vi.mock` factory to return a `function` expression, not an arrow function — arrow functions can't be used as constructors and this fails at runtime, not at type-check time.
- `vi.mock()` paths resolve relative to the test file, not the module under test — a common mistake is copying the path straight from the source file's own imports, which is usually one `../` short.
- Modules that run side effects at import time and depend on `process.env` (e.g. `bootstrap-env.ts`, `config.ts`) are tested via `vi.resetModules()` + a dynamic `import()` per test case, not a static top-level import, so each test gets a fresh evaluation.
