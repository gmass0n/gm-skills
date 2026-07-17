# Stack discovery — real traps to hunt for

A lean catalog of environment traps observed standing up real local stacks, as general heuristics (not project-specific hardcode). When exploring repos in `qa:plan` Step 2, look for these and record the resolution in the plan's preconditions.

## Node & package manager
- **Node version pinned by `.nvmrc`.** Require `source ~/.nvm/nvm.sh && nvm use` before any `pnpm`/`yarn`, or the install fails with `ERR_PNPM_UNSUPPORTED_ENGINE`. The plan records the exact version per service.

## Worktrees & bundlers
- **Next 16 + git worktree.** A symlinked `node_modules` breaks Turbopack ("points out of the filesystem root") → the worktree needs a real local `pnpm install`, not a symlink. Note that `.env.local` takes priority over `.env`.

## Strict env validation
- **Strict-zod env schemas.** An empty variable like `DOCS_FAVICON_URL=` can crash boot — **remove** the line rather than leaving it empty.
- **API base URL prefix.** The base URL may need a prefix suffix (`/api`) — symptom: "connection failed" / 404 on routes that lack the prefix.

## Mock vs real
- **Provider switches** (`DATA_SOURCE`, `ORDER_PROVIDER`, `*_API_URL`, etc.): flip to the real backend, or QA tests the mock — the exact gap QA exists to close.
- **Stale mock session / httpOnly cookie.** An old mock cookie can poison login. Clear via `page.context().clearCookies()` (`document.cookie` can't touch httpOnly).

## React Native / Maestro
- **App can't reach the local backend.** The device is not the host: an Android emulator sees the host as `10.0.2.2`, a physical device needs the LAN IP or a tunnel — `localhost` in the app config silently fails. Record the exact reach and bake it into the app env.
- **Stale build after an env/native change.** Metro reloads JS but not native config or `.env` baked at build time — a full rebuild+reinstall is required, not just a Metro restart, or QA tests the old binary.
- **Wrong variant/scheme.** The default run script may target a specific flavor (e.g. `defaultSimuladoDebug`); QA must build the variant that points at the backend under test.
- **Device state carries over.** A previous run's login/session survives on the device — reset the app (reinstall or clear app data) at test start, the mobile analog of a fresh browser profile.

## Orphan processes
- **Old dev server holding a port/lock, or an orphan Chrome MCP holding the browser profile.** Kill by PID/port before standing up. A fresh, clean browser profile at test start avoids both the locked profile and leftover session state.

## Preconditions to verify before firing anything
- **Tunnel/DB reachable** (`nc -zv host port`) and the **login user exists** in that DB.
- **Interactive-verification flows detected early** — login, OTP/2FA, email/phone confirmation, captcha. These are the most common cause of a test stalling mid-run; resolve the mode (unattended / assisted / blocked) in the plan, never at runtime on your own.
