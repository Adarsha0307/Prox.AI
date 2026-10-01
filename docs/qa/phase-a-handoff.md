# Phase A Handoff — Prox.AI Carousel Editor QA/Security Review

**Audited by:** Independent QA/security review (Phase A)
**Date:** 2026-09-23
**Baseline:** `3ca958d` on `qa/phase-a-e-verification` (working-state audit; in-progress staged/unstaged changes were present — see `verification-log.md` §1)
**Deliverables in this folder:** `requirements-matrix.md` · `defect-report.md` · `verification-log.md` · `phase-a-handoff.md`

---

## 1. What was executed

1. **Repo state lock:** branch/HEAD captured (`qa/phase-a-e-verification` @ `3ca958d`; tree carries in-progress staged/unstaged changes — see `verification-log.md` §1); toolchain verified (Node v24.14.0, npm 11.9.0).
2. **Full static review** of client (editor, panels, stores, renderer, export, persistence, validation, assets) and server (Express routes, auth, SSRF, uploads, extraction, AI adapters, DB), cross-checked against `product-requirements.md`, `architecture.md`, `decisions.md`, `implementation-plan.md`, `verification.md`, and all three `server/tests/*.cjs` + `client/src/utils/layoutValidator.test.ts`.
3. **Executed checks:** client build (pass, 2 warn), client lint (pass, 3 warn), client unit tests (**2/8 fail**), server build (pass), server tests (18/18 pass), npm audits (0 vulns), secrets grep (clean), and a **real-DB pollution probe** (17 test accounts in `server/sqlite.db`).
4. **Produced:** 38-requirement traceability matrix, 16 filed defects (+ security notes), verification log with reproductions.

## 2. Bottom line

- **API layer is the strongest part** — auth, authorization/ownership, SSRF, CORS, billing gates, and schema validation held up under test and review.
- **Front-end feature chain is NOT release-ready.** The AI-image flow (generate → preview → persist → reload → export) is broken end-to-end, document upload fails in dev, and deployment non-locally is impossible with hardcoded `localhost:3001` origins.
- The "ALL MILESTONES COMPLETED — ready for release" claim in `docs/implementation-plan.md` is **contested** until the P0 backlog below closes.

## 3. Prioritized repair backlog

### P0 — Release-blocking (do before any release/public rollout)

| Fix | Defect(s) | Touchpoints | Notes |
|---|---|---|---|
| Tokenized asset loading: client sends `?token=` on `/uploads/*` for preview/apply; and/or server accepts `Authorization: Bearer` | D-03, D-04 | `ImagePanel.tsx`, `assets.ts`, `export.ts`, `index.ts` (`GET /uploads/:filename`) | Make generated-image insert/download assets into IndexedDB at insert time to stay durable past the 24 h purge (D-14) |
| Centralize API origin: replace all four hardcoded `http://localhost:3001` with `API_BASE`/`VITE_API_URL` | D-02 | `ImagePanel.tsx:47`, `AuthModal.tsx:5`, `CloudProjectsModal.tsx:6`, `api.ts:10` | Deploy client + server behind same origin or set `VITE_API_URL` at build |
| Route AIPanel doc-upload through `apiRequest` (and add dev Vite `/api` proxy as belt-and-suspenders) | D-01 | `AIPanel.tsx:54`, `vite.config.ts` | Unblocks PR R-11 doc input in dev |
| Test isolation: all `server/tests/*.cjs` must set `DATABASE_PATH` to a unique temp DB and clean up; guard `NODE_ENV=test` against default DB | D-08 | `byok.test.cjs:7`, `db.ts` | Also stop committing `sqlite.db` (D-15) and re-run `npm test` to confirm determinism |

### P1 — High-priority follow-up (next sprint)

| Fix | Defect(s) | Touchpoints |
|---|---|---|
| Reconcile `layoutValidator` overlap semantics (implement 30% threshold), decide auto-correct vs flag-only with the product owner, and fix the 2 failing unit tests | D-05 | `layoutValidator.ts`, `layoutValidator.test.ts`, `editorStore.ts:~624` |
| Standardize env names: run on `AUTH_SECRET` + `DATABASE_PATH`; update tests; add committed `.env.example` (currently referenced-but-missing) | D-09 | `utils/auth.ts`, `db.ts`, all tests |
| Gate or implement `web_research`; drop the UI option until a provider path exists, or return structured sources | D-11 | `index.ts` (~663), `AIPanel.tsx` (~150) |
| Rate-limit `/api/generate/*` + `/api/extract/*` per user; cap `image-size` decode | D-10 | `index.ts` |

### P1.5 — Careful with data

| Fix | Defect(s) | Touchpoints |
|---|---|---|
| Stop auto-deleting >24 h uploads that projects reference; purge only unreferenced assets | D-14 | `index.ts` cleanup interval |
| `crypto.timingSafeEqual` for email verification codes | D-12 | `index.ts` verify route |
| Pin SSRF validated IP at connect time (DNS-rebinding) | D-13 | `utils/ssrf.ts` |

### P2 — Quality/hygiene (any time)

| Fix | Defect(s) | Touchpoints |
|---|---|---|
| Clear 3 lint warnings, optionally split bundle, lazy-load `db.ts` | D-06, D-07 | `CarouselEditor.tsx:130`, `authStore.ts:59`, `ThemePanel.tsx:101`, `vite.config.ts` |
| `git rm --cached server/sqlite.db`; add `server/*.db*` to `.gitignore`; delete `temp_*` scratch files in `server/` | D-15 | repo hygiene |
| Update `architecture.md` to SQLite/local-uploads reality (or annotate Postgres/object-storage as future) | D-16 | `docs/architecture.md` |

## 4. Not covered in Phase A (suggested Phase B)

- **Browser E2E smoke** (register → upload doc → generate text → insert generated image → save → reload → export PNG/PDF/PPTX), desktop + mobile viewport. Needs the P0 fixes first to be meaningful.
- **Live BYOK provider round-trip** (needs an OpenAI key) — verify real generation, image dimensions, credit deduction, and failure-refund paths.
- **Concurrent multi-device sync conflict resolution** (revision 409 path) under real load.
- **Performance profiling** of renderer at N=50 slides / 500 elements.
- **Accessibility pass** on editor keyboard flows and forced-colors.

## 5. Quick reference commands

```bash
cd client && npm run build && npm run lint && npx vitest run
cd server && npm test
node -e "const db=require('better-sqlite3')('server/sqlite.db'); console.log(db.prepare('select count(*) c from users').get())"
```