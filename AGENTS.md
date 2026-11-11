# AGENTS.md

## Project facts

- Internal Wilaya d'Alger anomaly-tracking app. Code, comments, tests and UI copy are mostly French; the UI also ships Arabic with full RTL.
- Node.js >= 20, ESM only, npm workspaces: `shared/`, `server/`, `client/`.
- Production is one Express process serving both `/api` and the built SPA from `client/dist`. The SPA uses `HashRouter`, so routes look like `/#/anomalies/nouvelle`.
- Product docs call the current version V6, but `shared/src/constants.js`, all workspace `package.json` files and the API E2E still assert `5.0.0`. Do not bump the version casually.
- Windows-first project: keep npm scripts and paths cross-platform (`path`, no bash-only commands).

## Architecture boundaries

- `shared/src/` is the single source of truth for business rules: Zod schemas, status transitions, dates, GPS/URL parsing, percentages, duplicate and list-view rules. Both server and client import `@anm/shared`; do not duplicate these rules.
- `server/src/services/` owns domain operations and SQL statistics. Routes stay thin. Statistic aggregation belongs in SQL (`stats*.js`), never in client-side loops over rows.
- `client/src/components/ui/` holds shared UI primitives. `client/src/features/` holds screens. `client/src/api/client.js` is the only API wrapper; it adds CSRF and validates responses.
- SQLite migrations live in `server/src/db/migrations/` and are applied automatically on server start. Anomalies use soft delete via `deleted_at`.
- Docs: `docs/SPEC_V6.md` wins on V6 behavior, then `SPEC_V5.md`, then `SPEC.md`. `DECISIONS.md` records binding implementation choices. Some prose is stale: trust config/tests over docs (e.g. `AUDIT_V6.md` describes an older Playwright `webServer` that no longer exists).

## Commands

```bash
npm install
npm run setup              # only when .env/dirs/DB need creating
npm run dev                # API :3000 + Vite :5173 (Vite proxies /api to :3000)
npm run build && npm start # production: build is mandatory before start
npm run qa                 # full gate: build, lint, styles, Vitest, API E2E, Playwright, a11y
```

- `npm start` does **not** build. If `client/dist` was absent when the server started, restart it after building; static mounting is decided at startup.
- `npm run dev` hardcodes the API proxy to `:3000`; changing `PORT` also requires updating `client/vite.config.js`.
- Focused tests: `npx vitest run server/tests/auth.test.js` · `npx playwright test tests/e2e/c8-action-bar.spec.js` · `npx playwright test --grep "motif"`.
- `npm run test:e2e` is a custom Node/Supertest script, not Playwright. It starts its own server on port 4321.
- `npx playwright install chromium` is required once on a new machine.
- `npm run db:check` reports integrity/migrations; `npm run backup` creates a consistent SQLite backup.
- There is no TypeScript/typecheck step. ESLint and the test suites are the static gates.

## Tests and browser harness

- Vitest covers only `shared/` and `server/`; there are no client unit tests. UI behavior is verified by Playwright.
- Every test suite uses an isolated temporary database through `ANM_TEST_ROOT`. Never point tests at `data/` or `backups/`.
- Browser specs must import `test`/`expect` from `tests/e2e/fixture.js`, not directly from `@playwright/test`. The fixture forks one isolated server per test, seeds `[DEMO]` data and the `admin`/`operateur`/`lecteur` users (password `E2E-Alger-2026`), injects a fake short-link resolver and stubs map tiles.
- Do not add a Playwright `webServer`: the fixture already starts the app and manages ports/temp dirs.
- Playwright serves the built client. Run `npm run build` before browser tests after client changes, or use `npm run qa`.
- Keep tests contractual: no `skip`, no weakening, no deleting an existing assertion to make a change pass. Add a focused regression spec for each fix.
- On Windows, test temp roots are created under `%LOCALAPPDATA%\Temp\opencode`.

## Data safety

- `data/`, `backups/`, `logs/` and `.env` are gitignored and can contain live data. Do not delete, re-seed or overwrite them without explicit approval.
- Server startup applies pending migrations and may create the daily backup. Experimental work should use a copied DB and a separate `DB_PATH`.
- `npm run backup` runs migrations **before** taking the backup. For a true pre-migration backup, stop the server and copy the DB (including WAL state safely), or use the SQLite backup API.
- The admin password is stored only as a bcrypt hash and cannot be recovered. `ADMIN_PASSWORD` in `.env` only creates the first admin when the `users` table is empty; it does not reset an existing account.
- Resetting a real password (`npm run admin:reset`) destroys sessions, forces a password change and requires explicit user agreement.
- Login locks after 5 failed attempts for 15 minutes. Never brute-force or repeatedly try guessed credentials against the live app.
- Never renumber an applied migration. The latest is `008_interventions_workflow.sql`; add `009+`. `SPEC_V6.md` still mentions `003_v6.sql`, but `003` already belongs to V5.
- `npm run seed:demo` and `seed:demo:purge` point to missing files. Do not rely on them; use the explicit `scripts/import-*.js` tools and mark demo records `[DEMO]`.
- The live DB may contain deliberate demo/test batches marked `[DEMO]`, including `TEST-LOCAL-30`. Do not purge them without approval.

## UI and design constraints

- No hardcoded colors, hex values or raw Tailwind palette classes outside `client/src/styles/tokens.css` (`components/ui/` is the only excluded component folder). `npm run check:styles` enforces this.
- In Tailwind, `text-brand-*` resolves to `--brand-text-*` contrast tokens, while `bg-brand-*` resolves to `--brand-*`. Use the text tokens for colored text.
- When adding text/background token combinations, add the pair to `scripts/check-a11y.js`. `npm run check:a11y` checks WCAG AA contrast in light and dark themes.
- `scripts/check-styles.mjs` and `scripts/check-a11y.mjs` are stale copies; npm uses the `.js` versions.
- Required responsive widths: 390, 768, 1024, 1440 px. Check FR/AR RTL, light/dark, no horizontal page overflow, and no action-bar/field overlap. Playwright geometry helpers in `tests/e2e/geometry.js` enforce these.
- Leaflet maps must be created in effects, removed with `map.remove()`, avoid global plugin imports, and degrade without breaking the page.
- No runtime CDN/external assets except the configured map tiles; fonts/icons are bundled. No `TODO`, dead buttons or silent actions.

## Domain and API gotchas

- Business dates are `YYYY-MM-DD` in `Africa/Algiers`. Never use `new Date('YYYY-MM-DD')` as local time; use `shared/src/dates.js` helpers (`todayAlgiers`, UTC arithmetic).
- Status/verification transitions live in `shared/src/statut.js`; form requirements live in `shared/src/formValidation.js`. Validate on both client and server.
- Mutating API calls need the session cookie and `X-CSRF-Token`; the client wrapper handles it. API errors are `{ error: { code, message, fields? } }`.
- Add response schemas to `shared/src/apiSchemas.js`; the client falls back silently on schema mismatch.
- Short-link resolution must keep the domain allowlist, SSRF/DNS rebinding protection, typed failures and manual recovery. Tests inject `fetchImpl`/`lookupImpl`; never weaken production security to make a test pass.
- Never invent real communes, daïras, EPIC or agents. Import through the provided scripts and keep existing administrator edits.

## LAN deployment

- Documented address: `http://192.168.117.163:3000` (Ethernet 2, `192.168.117.0/24`). See `docs/RESEAU_LOCAL.md`.
- Keep `COOKIE_SECURE=false` while serving HTTP, otherwise LAN sessions break. HTTP also means no browser geolocation or direct clipboard access (manual GPS/paste still work).
- Do not expose Vite `5173` in production and do not change firewall rules/profiles without approval.
- Server-local health checks do not prove access from another device; cross-device LAN access must be verified separately.
