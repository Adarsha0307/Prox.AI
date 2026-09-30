# Defect Report — Prox.AI Carousel Editor (Phase A QA)

**Audit date:** 2026-09-23
**Auditor:** Independent QA/security review (Phase A)
**Baseline:** commit `3ca958d`, branch `qa/phase-a-e-verification` (audit reflects the working tree — in-progress staged/unstaged changes present; auditor modified no application code).
**Related docs:** `requirements-matrix.md`, `verification-log.md`, `phase-a-handoff.md`

Severity legend:
- **CRITICAL** — data loss / test-suite damage / security breach
- **HIGH** — release-blocking feature cannot function
- **MEDIUM** — degraded feature or notable risk; should ship-fix
- **LOW** — hygiene / polish / low-risk hardening

---

## Defect summary

| ID | Severity | Area | One-line description |
|----|----------|------|---------------------|
| D-01 | HIGH | Client · dev config | Bare relative `fetch('/api/extract/document')` in AIPanel with no Vite `/api` proxy → document extraction fails in dev; bypasses `apiRequest` convention |
| D-02 | HIGH | Client · deployment | `http://localhost:3001` hardcoded in 4 files (ImagePanel, AuthModal, CloudProjectsModal, api.ts fallback) → breaks any non-local deployment |
| D-03 | HIGH | Client+Server | Generated-image preview/apply never attaches the required `?token=` → every server-hosted image 401s; AI-image feature non-functional |
| D-04 | HIGH | Client | Persisted `/uploads/*` image URLs are loaded token-less on reload/canvas → broken images after refresh and export failures |
| D-05 | MEDIUM | Client · logic | `layoutValidator` overlap feature half-implemented (no 30% threshold, auto-shift removed) → 2/8 unit tests fail + false positives on text-over-image designs |
| D-06 | LOW | Client · quality | 3 ESLint warnings (setState-in-effect, 2 unused catch params); build succeeds |
| D-07 | LOW | Client · performance | Main bundle 1.39 MB (gzip 441 KB) > Vite 500 KB warning; INEFFECTIVE_DYNAMIC_IMPORT for db.ts |
| D-08 | CRITICAL | Server · tests | `byok.test.cjs` sets `DATABASE_URL` (ignored) → tests write 17 accounts to real `server/sqlite.db`; dev DB permanently polluted |
| D-09 | MEDIUM | Server · config | Env-name mismatch: runtime reads `AUTH_SECRET`/`DATABASE_PATH` while tests set `JWT_SECRET`/`DATABASE_URL`; `.env.example` referenced but absent |
| D-10 | MEDIUM | Server · security | No rate limiting on `/api/generate/*` and `/api/extract/*` (auth-only limiter) |
| D-11 | MEDIUM | Server+Client | `web_research` research mode returns 501 while UI advertises it; no sources ever returned |
| D-12 | LOW | Server · security | Email verification code compared non-constant-time (mitigated by 20/15-min rate limit) |
| D-13 | LOW | Server · security | SSRF URL validated once — DNS-rebinding / TOCTOU window |
| D-14 | MEDIUM | Server | `/uploads` 24-hour purger → generated images used in saved projects 404 later (compounds D-04) |
| D-15 | LOW | Repo hygiene | `server/sqlite.db` committed to git (contains user/test records); stray artifacts in `server/` |
| D-16 | LOW | Docs | `ARCH` describes PostgreSQL + object storage; implementation is SQLite + local `/uploads` |

Full details follow. Code line references are to baseline commit `3ca958d`.

---

## D-01 — Document extraction fails in dev (bare relative fetch, no Vite proxy)

- **Severity:** HIGH · **Component:** `client/src/components/AIPanel.tsx` + client dev infrastructure
- **Code refs:** `client/src/components/AIPanel.tsx:54` (`fetch('/api/extract/document', ...)`); `client/vite.config.ts` (no `server.proxy`); compare with the project convention `client/src/utils/api.ts` (`apiRequest` / `API_BASE`).
- **Issue:** The document-upload path uses a bare relative fetch instead of `apiRequest`. Vite dev (client on `:5173`) has **no proxy configured** for `/api`, so the request resolves against the Vite dev server's HTML, not the API on `:3001`. A production same-origin reverse proxy would mask the bug.
- **Repro:** In dev, open AIPanel, drop a DOCX/PDF/TXT → response is HTML; `extractDocument` fails; extraction never reaches the server.
- **Impact:** Doc-upload input (PR R-11) is non-functional in the default dev setup; inconsistent with every other API call, which goes through `apiRequest` (honoring `VITE_API_URL`).
- **Fix:** Route through `apiRequest` (FormData is supported) and/or add `server.proxy['/api'] → http://localhost:3001` to `vite.config.ts`.

## D-02 — Hardcoded `http://localhost:3001` API origin (4 sites)

- **Severity:** HIGH · **Component:** Client network config
- **Code refs:**
  - `client/src/components/ImagePanel.tsx:47-48` (`const API_URL = 'http://localhost:3001'`; `fetch(\`${API_URL}/api/upload/image\`)`)
  - `client/src/components/AuthModal.tsx:5` (`const API_URL = 'http://localhost:3001';`) used at `:30`, `:65`
  - `client/src/components/CloudProjectsModal.tsx:6` (`const API_URL = 'http://localhost:3001'`) used at `:16`
  - `client/src/utils/api.ts:10` (fallback origin; unlike the others it honors `VITE_API_URL`)
- **Issue:** Three components bypass the `API_BASE`/env mechanism and hardcode a loopback origin. Any deployment served over LAN/HTTPS (static client + hosted API) fails with mixed-content/CORS errors.
- **Repro:** Serve the client from any origin other than `http://localhost:3001` → login, project cloud sync, and image upload all fail.
- **Fix:** Import `API_BASE` from `utils/api.ts` everywhere; set `VITE_API_URL` at build time. Remove all hardcoded origins.
## D-03 — Generated-image preview/apply never sends the required `?token=`

- **Severity:** HIGH · **Component:** `server/src/index.ts` (uploads route) + `client/src/components/ImagePanel.tsx`
- **Code refs:** server `GET /uploads/:filename` requires an env-signed `?token=` query param (`server/src/index.ts` ~40-68); client preview/apply builds `http://localhost:3001/uploads/gen-…` with **no token** (`ImagePanel.tsx:145-151` `fetch(previewImage)` and the `<img src>` on the insert panel).
- **Issue:** The server deliberately protects uploaded assets with an auth token, but the client feature that consumes those assets omits the token. Every server-hosted generated image returns 401.
- **Repro:** Generate an image (BYOK mode) → inserted `<img src="/uploads/gen-….png">` 401s; `applyGeneratedImage` `fetch(previewImage)` throws → apply always fails.
- **Impact:** The "AI images" output type (PR R-12/R-14) is non-functional despite passing code review.
- **Fix:** (a) client requests assets with `?token=…`, or (b) server accepts `Authorization: Bearer` on `GET /uploads/:filename`. See D-04 for the reload/export corollary.

## D-04 — Persisted `/uploads/*` image URLs load token-less on reload and during export

- **Severity:** HIGH · **Component:** `client/src/utils/assets.ts`, `client/src/utils/export.ts`, `client/src/utils/db.ts`
- **Code refs:** `assets.ts` returns non-`blob:`/non-`static/` URLs verbatim as image src; `renderer.ts`/`export.ts` forward no auth headers when rasterizing server-hosted images; `validation.ts` only strips `blob:` URLs.
- **Issue:** A saved project referencing a server-hosted generated image renders a broken `<img>` after reload (the token is not available to the canvas loader) and exports (`renderSlideToDataUrl`) cannot fetch the asset (401, and no `crossOrigin` set → canvas taint).
- **Repro:** Insert generated image → save → reload → broken image; PNG/PDF/PPTX export containing that image → blank/missing raster.
- **Impact:** Generated-image projects are not durably renderable or exportable — the "reliable persistence/exports" path is compromised.
- **Fix:** Download server-hosted images into IndexedDB `ASSETS_STORE` at insert time (by `assetId`, revoking the server URL) — aligns with the asset model in `db.ts`; and/or add signed-URL handling across renderer/export.

## D-05 — `layoutValidator` overlap feature half-implemented; 2 of 8 unit tests fail

- **Severity:** MEDIUM · **Component:** `client/src/utils/layoutValidator.ts`, `client/src/utils/layoutValidator.test.ts`
- **Code refs:** `layoutValidator.ts` — no overlap **threshold** exists (design says ~30% before flagging); auto-correction path (mentioned in `server`-era spec) removed; `editorStore.ts:~624` layout-fix action surfaces `statusMessage` on any overlap. Tests `'detects overlapping elements and classifies severity'` and `'auto-corrects overlapping elements'` fail (verified `npx vitest run` → 2 failed / 6 passed / 8 total).
- **Issue:** Every overlap — including intentional *text-over-image* designs (a carousel staple) — is flagged as "ambiguous overlap" and blocks the green "Layout looks good!" status; the promised auto-shift correction was removed while the consumer (`editorStore`) and tests still expect it.
- **Repro:** `cd client && npx vitest run`; or draw two overlapping shapes and run the layout-fix action.
- **Impact:** False-positive warnings degrade UX for common designs; broken tests block CI-green and contradict release readiness (IMP "all milestones complete").
- **Fix:** Implement the 30% threshold (bounding-box overlap ratio), allow text-over-image by default (flag only >= threshold without auto-correct, or re-add shift-back), and reconcile tests with the intended behavior.

## D-06 — Client lint: 3 warnings

- **Severity:** LOW · **Component:** Client
- **Code refs:** `client/src/components/CarouselEditor.tsx:130` (setState in effect — React hooks lint), `client/src/store/authStore.ts:59` & `client/src/components/ThemePanel.tsx:101` (unused `catch` params).
- **Fix:** Suppress correctly (`void`), use functional `setState` or effect guard in CarouselEditor, or add scoped disable comments. Build is unaffected.

## D-07 — Main bundle well above Vite's 500 KB advise threshold

- **Severity:** LOW · **Component:** Client build
- **Code refs:** build output: `dist/assets/index-*.js` 1.39 MB / gzip 441 KB; warning `chunk size exceeds 500 kB`; `INEFFECTIVE_DYNAMIC_IMPORT` on `db.ts` (also loaded synchronously).
- **Impact:** Slower first paint on mobile (R-03). Not release-blocking.
- **Fix:** Route-split editor surface; lazy-load `db.ts`/`backup.ts`; verify source maps are off for prod.
## D-08 — Test suite writes to the real database (env-var MISTAKE: `DATABASE_URL` vs `DATABASE_PATH`)

- **Severity:** CRITICAL · **Component:** `server/tests/byok.test.cjs`, `server/src/db.ts`
- **Code refs:** `server/tests/byok.test.cjs:7` (`process.env.DATABASE_URL = ...`); `server/src/db.ts` reads the **`DATABASE_PATH`** env var (or defaults to `<cwd>/sqlite.db`); billing/api tests use `DATABASE_PATH` correctly.
- **Issue:** BYOK tests set a variable the code ignores, so the suite connects to the default `server/sqlite.db` — a real, committed repo file. Verified: after running `npm test`, 17 records with `byok-…` and `billing-…` emails (including users created during *this* audit run) live in `server/sqlite.db`. Tests are not isolated, are order- and state-dependent, and permanently pollute the dev DB inside the repo.
- **Repro:** `cd server && npm test` → inspect `sqlite.db` for test accounts; re-run → counts grow further (some routes reject repeat emails, altering outcomes on subsequent runs).
- **Impact:** Data pollution, non-deterministic tests, git-diff noise; `sqlite.db` is even committed to the repo so the pollution ships in history.
- **Fix:** In every test file use the canonical `DATABASE_PATH` (with per-run temp path + `fs.rm` cleanup) — as `api.test.cjs` already does; add a guard that refuses to run when `DATABASE_PATH` is unset under `NODE_ENV=test`; un-commit/regenerate the shipped DB (see D-15).

## D-09 — Env-var naming mismatch between runtime and all test files

- **Severity:** MEDIUM · **Component:** `server/src/utils/auth.ts`, `server/src/db.ts`, all three `server/tests/*.cjs`
- **Code refs:** runtime reads `AUTH_SECRET` (`auth.ts`, with a hint referencing a **`.env.example` that does not exist** in the repo) and `DATABASE_PATH` (`db.ts`); tests set `JWT_SECRET` and `DATABASE_URL`.
- **Issue:** Tests never exercise the documented/known configuration paths. `JWT_SECRET` is a no-op, so tests run the ephemeral per-process key path; token persistence across server restarts has never been tested. Ops docs would mislead a deployer.
- **Fix:** Standardize on one documented set (`AUTH_SECRET`, `DATABASE_PATH`), update all tests/utils to match, and add a committed `.env.example`.

## D-10 — No rate limiting on generation/extraction endpoints

- **Severity:** MEDIUM · **Component:** `server/src/index.ts` routes
- **Code refs:** `rateLimit` middleware is scoped to register/login/verify (`index.ts` ~176-320). `/api/generate/image`, `/api/generate/outline`, `/api/extract/document`, `/api/extract/url` are unlimited.
- **Impact:** Authenticated (or BYOK) clients can spam LLM/image generation; PNG-decoding of user uploads (`image-size`) is a CPU sink; BYOK mode deducts no credits so image generation is unbounded. Abuse/cost risk.
- **Fix:** Apply per-user rate limits and a global concurrency cap on generate/extract routes; cap `image-size` decode dimensions.

## D-11 — `web_research` mode: advertised in UI, always 501 on server

- **Severity:** MEDIUM · **Component:** `server/src/index.ts` + `client/src/components/AIPanel.tsx`
- **Code refs:** server hardcodes `501 { error: 'Web research is not configured.' }` for `researchMode === 'web_research'` (`index.ts` ~663); client dropdown advertises *"Web Research (Live Provider Required)"* (`AIPanel.tsx` ~150).
- **Impact:** A PR-listed research mode (R-13, with source citations) cannot work and no sources are ever returned; UI promises a feature the API rejects.
- **Fix:** Gate the UI option behind a capability flag (e.g., provider key present), or implement web research; at minimum return structured `sources` for supported modes.

## D-12 — Verification-code comparison is not constant-time

- **Severity:** LOW · **Component:** `server/src/index.ts` (`/auth/verify-email`)
- **Code refs:** stored plaintext code compared with `===` (string compare). Attack window is mitigated by: 6-digit space, 15-min expiry, code cleared after N attempts, and the 20/15-min verify rate limit.
- **Fix:** `crypto.timingSafeEqual` on buffers.

## D-13 — SSRF validation resolves DNS once (TOCTOU / DNS-rebinding window)

- **Severity:** LOW · **Component:** `server/src/utils/ssrf.ts`
- **Code refs:** `validateSafeUrl` + `fetch` re-resolves the hostname; a rebinding attacker could flip the DNS record between validation (public IP) and fetch (private IP).
- **Impact:** Limited: endpoints are behind auth + (planned) rate limits; still worth locking down for a hardened deployment.
- **Fix:** Resolve once, pin the connection to the validated IP (custom dispatcher / Happy Eyeballs-off agent), or validate the *resolved* IP immediately before connect.

## D-14 — Uploads purger deletes >24h assets referenced by saved projects

- **Severity:** MEDIUM · **Component:** `server/src/index.ts` cleanup interval (~line 772)
- **Code refs:** periodic sweep deletes `/uploads` files older than 24 hours. Generated images (~30-60 s to create) are retained in project JSON as `/uploads/gen-…` URLs.
- **Impact:** Any saved project whose images are not re-fetched within 24 h loses those assets (compounds D-04). Data-loss-adjacent.
- **Fix:** Scope purging to *unreferenced* uploads (query DB for asset references) and treat generated images as long-lived until project deletion.

## D-15 — `server/sqlite.db` committed to git; stray artifacts in `server/`

- **Severity:** LOW · **Component:** Repo hygiene
- **Code refs:** `server/sqlite.db` tracked in git (contains 17+ test/user records after D-08). Stray files present: `server/test.txt`, `server/test/billing-test-data.db`, and stale scratch files `server/temp_dbcheck.cjs`, `server/temp_tsconfig_probe.json`, `server/temp_verify_doc.ts`, `server/temp_verify_g.ts`; an untracked `package-lock.json` at repo root.
- **Impact:** Revision-controlled database bloat (binary diffs each test run), leaked test/HMAC secrets surface risk, and reviewer noise.
- **Fix:** `git rm --cached` the DB + add `server/*.db*` to `.gitignore`; regenerate schema at boot (`CREATE IF NOT EXISTS`), remove `temp_*` scratch files; decide `package-lock.json` policy (commit it for reproducible builds).

## D-16 — Architecture docs drifted from implementation (PostgreSQL/object storage vs SQLite/local uploads)

- **Severity:** LOW · **Component:** `docs/architecture.md` vs `server/src`
- **Code refs:** `ARCH` specifies PostgreSQL and private object storage; implementation uses SQLite (`db.ts`) and a local `/uploads` dir. Probably a deliberate Rs-0 trade-off, but docs are stale and mislead reviewers/deployers.
- **Fix:** Update `ARCH` with the SQLite-first plan and note the migration boundary to Postgres/object storage if the product exits the Rs-0 phase.

---

## Verified-clean areas (no findings)

- Project authorization: 403/404 isolation, id-owner checks, `POST /api/projects` id conflicts → all covered by passing `api.test.cjs` cases.
- Password hashing (`bcrypt` cost 10), token cipher w/ 7-day TTL and per-process key, email-code expiry + rate limits.
- SSRF blocklist (loopback/private/link-local/multicast/CGNAT/cloud metadata) and CORS deny-by-default with allowlist.
- Schema/structural validation ceilings on both client and server (≤50 slides, ≤500 elements, ≤2 MB, dims ≤10000).
- Document extraction is entirely local (mammoth/pdf-parse) — no AI dependency; manual editing, exports, and IndexedDB persistence continue when external services are down.
- Credits accounting: deduction + refund loops + 402 gates verified by passing `billing.test.cjs` cases.

## Positive engineering notes

- Clean separation `utils/aiAdapter.ts` (mock vs live), `utils/ssrf.ts`, `utils/auth.ts`.
- Careful untrusted-input handling in uploads: randomized filenames, ownership prefix, path-traversal checks.
- Client schema purge of `blob:` URLs on save shows deliberate hygiene in `validation.ts`.
- 18/18 passing server tests exercise real HTTP paths (auth, CORS, ownership, billing, BYOK gating).