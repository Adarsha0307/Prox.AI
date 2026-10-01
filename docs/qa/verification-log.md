# Verification Log — Prox.AI Carousel Editor (Phase A QA)

**Audit date:** 2026-09-23
**Auditor:** Independent QA/security review (Phase A)
**Environment**
- OS: Windows 10/11 (win32)
- Node: v24.14.0, npm 11.9.0
- Repo: `e:\projects\Prox`, branch `qa/phase-a-e-verification`, HEAD `3ca958d18e096bcd78c6d3ad573bcb2015c34ae6` (working tree carries in-progress changes; see §1)
- Client: Vite/React+TS; Server: Express 5 + better-sqlite3 + TypeScript ESM; Tests: Node test runner (`*.test.cjs`), Vitest (client)

Legend: **PASS** · **FAIL** · **WARN** (non-blocking) · **NOT RUN** (not feasible in this environment) · **FI** (finding, see defect-report)

---

## 1. Repository state

| Check | Command | Result |
|---|---|---|
| Branch / HEAD | `git branch --show-current`, `git log -1 --format=%H` | PASS — `qa/phase-a-e-verification` @ `3ca958d` |
| Working tree | `git status --porcelain` | WARN — tree is **not clean**: branch carries in-progress staged + unstaged changes to many client/server files incl. `server/sqlite.db` (tracked & modified, see D-08/D-15). Audit conclusions apply to this working state. `docs/qa/` is the only new addition from this audit. |

> **Correction to earlier session note:** the pre-audit "git clean" observation was inaccurate. `git status` at audit end shows a large in-progress change-set on this branch. This does not affect file-content findings; it does affect D-08/D-15 (polluted committed DB **is accumulating tracked modifications**).

## 2. Toolchain

| Check | Command | Result |
|---|---|---|
| Node/npm present | `node -v; npm -v` | PASS — v24.14.0 / 11.9.0 |
| Deps installed | `client/node_modules`, `server/node_modules`, `server/dist` exist | PASS |
| Security scan (top-level) | `npm audit` at repo root | PASS — 0 vulnerabilities |
| Client security scan | `npm audit` in `client/` | PASS — 0 vulnerabilities |
| Server security scan | `npm audit` in `server/` | PASS — 0 vulnerabilities, dev-deps reassessed as non-production risk |

## 3. Client build & quality

| Check | Command | Result |
|---|---|---|
| Production build | `cd client && npm run build` | PASS (2 non-blocking warnings — D-07) |
| Lint | `cd client && npm run lint` | PASS w/ 3 warnings (D-06) |
| Unit tests | `cd client && npx vitest run` | **FAIL – 2/8** (D-05: `layoutValidator` overlap) |

Build note: entry chunk 1.39 MB (gzip 441 KB) triggers Vite's 500 KB advise; `db.ts` flagged `INEFFECTIVE_DYNAMIC_IMPORT`.

## 4. Server build, tests, runtime

| Check | Command | Result |
|---|---|---|
| Build | `cd server && npm run build` | PASS |
| Tests | `cd server && npm test` | PASS — 18/18 (api 9, billing 5, byok 4) |
| Test isolation audit | grep env overrides in `tests/*.cjs` | **FI — D-08**: `byok.test.cjs` sets `DATABASE_URL` (ignored); `api`/`billing` set `DATABASE_PATH` correctly |
| Real-DB pollution probe | `node -e "...sqlite.db users query..."` | **FI — D-08** (17 test accounts present, see evidence below) |
| Env-name consistency | grep `AUTH_SECRET`/`JWT_SECRET`/`DATABASE_PATH`/`DATABASE_URL` | **FI — D-09** |
| Secrets-in-source scan | grep `sk-`, `api[_-]?key`, `secret`, `BEGIN .*PRIVATE` under `client/src`, `server/src`, root `.env*` files | PASS — no live secrets in source |
| Ports/processes | current listeners during audit | n/a — no server left running after tests |

## 5. Critical finding evidence — test-polluted real DB (D-08)

Test accounts observed in `server/sqlite.db` (the committed development database) after a stock `cd server && npm test` run:

| user_id | email | created_by | notes |
|---|---|---|---|
| u_byok_<sub>/single</sub> | byok_…@example.com (×4 from byok tests) | — | success = 1 |
| u_credit_… | byok_credit_…@example.com | — | BYOK top-up path |
| u_billing_… | billing_@example.com / billing_update@example.com / billing_binom… | — | billing suite |
| u_api_… | api_user@example.com (idempotent) | — | api suite (uses temp DB correctly) |
| u_verified_… * | verified.generated@… (created during this audit's verification run) | — | proves pollution is *reproducibly growing* |

Probe: `node -e "const db=require('better-sqlite3')('server/sqlite.db'); console.log(db.prepare('select count(*) c from users').get()); ..."` → **17 rows** at end of run (was 16 before the audit's own re-run). Sequential test re-runs keep appending.

## 6. Manual code inspection (no runtime changes)

| Area | Files | Result |
|---|---|---|
| Client-server contract completeness | `api.ts`, `AIPanel.tsx`, `ImagePanel.tsx`, `AuthModal.tsx`, `CloudProjectsModal.tsx`, `assets.ts`, `export.ts`, `db.ts`, `cloudSync.ts`, `editorStore.ts`, `renderer.ts`, `validation.ts`, `layoutValidator.ts`, `templates.ts`, configs | FI — D-01/D-02/D-03/D-04/D-05/D-07 |
| Server routes & hardening | `server/src/index.ts`, `db.ts`, `utils/{auth,ssrf,validate,aiAdapter,extractDocument,extractUrl}.ts` | FI — D-08..D-16; R-17/R-27..R-37 verified clean |
| Requirements traceability | `docs/product-requirements.md` + `architecture.md`/`decisions.md`/`implementation-plan.md`/`verification.md` vs code | Matrix produced (`requirements-matrix.md`); R-38 contested |

## 7. Not executed in this environment

- **Browser E2E (Playwright/mobile/viewport smoke):** not run — no browser automation available on the audit box. Client-side behavior evidence is static + unit-test-only. Handoff recommends a brief manual smoke (register → extract → generate → export) after D-01..D-04 fixes.
- **Live LLM/image provider round-trip (BYOK):** not run — no provider API key available. Generation paths were verified at the gating/mocking/credit-accounting layer only.
- **Deployed-origin smoke (https, mixed-origin):** not run — blocked by D-02 (no configurable origin).
- **Long-running stability/uptime:** out of scope for Phase A.

## 8. Artifacts produced during audit (this change-set only)

- `docs/qa/requirements-matrix.md` — requirement → code mapping, 38 requirements.
- `docs/qa/defect-report.md` — 16 filed defects + security notes + verified-clean list.
- `docs/qa/verification-log.md` — this document.
- `docs/qa/phase-a-handoff.md` — handoff & repair backlog (next).
- Temporary stdout logs used during verification were removed after the audit.