# Requirements Matrix — Prox.AI Carousel Editor (Phase A QA)

**Audit date:** 2026-09-23
**Auditor:** Independent QA/security review (Phase A)
**Baseline:** commit `3ca958d` on branch `qa/phase-a-e-verification`; audit reflects the **working state** of the branch (tree carries in-progress staged/unstaged changes; no application code was modified by the auditor).
**Method:** Static review of client/server source plus build/lint/test verification (see `verification-log.md`).

Source documents considered:
- `docs/product-requirements.md` (PR)
- `docs/architecture.md` (ARCH)
- `docs/decisions.md` (DEC)
- `docs/implementation-plan.md` (IMP)
- `docs/verification.md` (VER)

Status legend: **MET** = implemented and verified; **PARTIAL** = implemented with gaps/limitations; **GAP** = missing/not implemented; **DIVERGENT** = implementation differs materially from the documented approach; **UNVERIFIED** = not exercisable in this environment.

---

## Functional & product requirements (PR)

| # | Requirement (source) | Implementation evidence | Status | Notes |
|---|---|---|---|---|
| R-01 | Full lifecycle: idea/source → editable outline → AI draft → editable slide designs → manual refinement → save → export | `client/src/components/AIPanel.tsx` (input/extract/generate), `editorStore.appendGeneratedOutline`, `CarouselEditor.tsx`, `TopBar.tsx` (save), `utils/db.ts`, `utils/cloudSync.ts`, `utils/export.ts`, `components/ExportDialog.tsx` | PARTIAL | "Editable outline" stage is not a distinct UI step: `/api/generate/outline` returns a raw 2-slide structure (`server/src/index.ts` ~695-733) that is appended directly as slides. AI draft → editable design and save/export chains are present. |
| R-02 | Public registration when operationally ready | `POST /auth/register`, `/auth/login`, `/auth/verify-email`, `/auth/me` (`server/src/index.ts` 176-337); client `components/AuthModal.tsx`, `store/authStore.ts` | MET | Email flow is mock (code logged, dev-only); production blocks code logging (`logMockVerificationEmail`). |
| R-03 | Desktop + mobile web browsers | Responsive Tailwind UI; `components/MobilePropertySheet.tsx` (mobile editing surface) | MET | No browser E2E executed in Phase A; static assessment only. |
| R-04 | English-first, architected for i18n | All UI strings hardcoded English | PARTIAL | No i18n infrastructure or string extraction present. |
| R-05 | Consistent design across an entire carousel | Global theme tokens in document (`theme.colors/fonts`), `components/ThemePanel.tsx`, template families (`utils/templates.ts`) | MET | — |
| R-06 | Strong editable typography | Text properties surfaced in `components/RightPanel.tsx`; rendered via `utils/renderer.ts`; schema supports font size/weight/style/align/lineHeight/charSpacing | MET | — |
| R-07 | Global branding changes (colors, fonts, logo, handle) | Colors + fonts: ThemePanel / theme block. **Logo and handle are not implemented** as first-class brand fields | PARTIAL | No logo/handle fields exist in the document schema (`client/src/types/schema.ts`). |
| R-08 | Useful text-overflow handling | `utils/layoutValidator.ts` `measureTextHeight` + overflow expansion; `editorStore` layout-fix action (`editorStore.ts:~624`) | MET (caveats) | Overlap-correction half-implemented and its tests fail (see D-05). Overflow expand path exercised by 1/8 passing unit test. |
| R-09 | Fast reuse of templates and brand settings | `utils/templates.ts`; template application in editor store; brand/theme reused from theme block | MET | — |
| R-10 | Reliable saving, recovery, exports | IndexedDB `saveProject/loadAllProjects` (`utils/db.ts`), `backup.ts` restore, `cloudSync.ts` async sync with optimistic-revision conflict detection (`server/src/index.ts` 458-468: `STALE_REVISION` 409), `ExportDialog.tsx` | MET | Server + local-client recovery flows verified by code + `api.test.cjs`. |
| R-11 | Inputs: topics, pasted text, uploaded documents, URLs | AIPanel topic textarea; file upload (TXT/PDF/DOCX via `server/src/utils/extractDocument.ts`, multer 5 MB limit); URL extraction (`extractUrl.ts`) | MET | Doc-upload client path is broken in dev: bare relative `fetch('/api/extract/document')` with no Vite proxy (D-01). |
| R-12 | Outputs: generated content, template designs, custom layouts, image assets | generate/outline → `appendGeneratedOutline`; templates; canvas-editable custom layouts; ImagePanel upload + AI image generation | MET | Generated-image pipeline is broken end-to-end (D-03, D-04). |
| R-13 | AI facts: source-only, general drafting, web research **with sources** | `researchMode` plumbing in AIPanel/server; `source_only` and `general` implemented; `web_research` always returns 501 (`server/src/index.ts` ~663) | PARTIAL / GAP | Web-research mode is advertised in the UI dropdown but cannot work (server hardcodes 501). No source citations are ever returned. |
| R-14 | Generated text remains editable; images are assets, not editable objects | Outlines appended as editable `text` elements on canvas; generated images inserted as `image` elements (single asset objects) | MET | — |
| R-15 | Export: PNG/JPG/ZIP, PDF, PPTX, project JSON | `utils/export.ts`: `exportAsImages` (PNG/JPG/ZIP), `exportAsPdf`, `exportAsPptx`, `exportAsJson` | MET | Known PPTX limitations documented (rotation/opacity/letter-spacing approximations; rasterized PDF). |
| R-16 | Budget ₹0 — no paid infrastructure | SQLite (`server/src/db.ts`), local filesystem uploads, bcryptjs (pure JS), open-source FE deps | MET | NOTE: `ARCH` still references PostgreSQL + private object storage — documentation drift (see D-16). |
| R-17 | Platform-funded generation disabled until funding exists | `ENABLE_PLATFORM_FUNDING` env default false; 402 `platform_funding_disabled` responses; credit deduction + refund loops in `server/src/index.ts` | MET | Verified by `byok.test.cjs` (402 without funding) and `billing.test.cjs`. |
| R-18 | Mock adapters for dev/tests must be clearly labeled | `generateOutlineMock` defined in `server/src/utils/aiAdapter.ts` (labeled "Development mock") | **GAP** | Mock adapter is imported (`index.ts:20`) but **never invoked**; dev flow returns 402 instead of a labeled mock. Only the auth email flow uses a labeled mock. |
| R-19 | Manual editing functional when services unavailable | Canvas editing, exports, uploads, and local persistence are all client-side/local; generation is the only gated path | MET | Verified statically; extraction is local (mammoth/pdf-parse). |
## Architecture & data-model requirements (ARCH / DEC)

| # | Requirement | Implementation evidence | Status | Notes |
|---|---|---|---|---|
| R-20 | Versioned, application-owned document schema with stable IDs | `client/src/types/schema.ts`, `CURRENT_SCHEMA_VERSION='1.0'`, `SUPPORTED_SCHEMA_VERSIONS` (`utils/validation.ts`); server structural validation (`server/src/utils/validate.ts`) | MET | Both client (`validation.ts`) and server (`validate.ts`) enforce ceilings: ≤50 slides, ≤500 elements/slide, ≤2 MB project JSON, dims ≤10000 px. |
| R-21 | Element types text/image/rectangle/circle/line + semantic roles | `ELEMENT_TYPES` / `ROLES` sets in `utils/validation.ts`; rendered by `utils/renderer.ts` | MET | — |
| R-22 | Local-first persistence (IndexedDB) to work without cloud/billing | `utils/db.ts` (`PROJECTS_STORE`, `ASSETS_STORE`, `saveProject/loadProject/saveAsset`) | MET | — |
| R-23 | Asset references persisted; transient object URLs never persisted | `validation.ts` drops `blob:` URLs with a warning; assets stored by `assetId` in IndexedDB | MET | Server-hosted (`/uploads/*`) URLs are treated as external and loaded token-less — breaks after reload (D-04). |
| R-24 | Cloud projects + cross-device synchronization | `/api/projects` CRUD with owner checks; `cloudSync.ts` manager; `components/CloudProjectsModal.tsx` | MET | Client talks to server via hardcoded `http://localhost:3001` in CloudProjectsModal (D-02). |
| R-25 | Undo/redo history of document transactions | `editorStore` history stack + `commit('immediate')` around mutations | MET | — |
| R-26 | Accessibility metadata (post caption, per-slide descriptions) | Schema defines these fields (`client/src/types/schema.ts`) | PARTIAL | Fields exist but no UI authoring/editing surface identified. |

## Security requirements (Phase A hardening review)

| # | Requirement | Evidence | Status | Notes |
|---|---|---|---|---|
| R-27 | Passwords stored with a strong hash | `bcrypt.hash(password, 10)` (`server/src/index.ts` 204); login via `bcrypt.compare` | MET | Round cost 10 acceptable. |
| R-28 | Email verification with expiry; blocked production code leakage | 6-digit code, 15-min expiry, cleared after verify; `logMockVerificationEmail` no-ops in production | MET | Code compare is not constant-time (D-12, mitigated by rate limit). |
| R-29 | Rate limiting on credential/verification endpoints | `rateLimit` middleware on register (10/h), login (20/15min), verify (20/15min) (`index.ts` 176-320) | MET | Rate limiting is auth-only — generation/extract unthrottled (D-10). |
| R-30 | Token integrity, expiry, no secrets in tokens | Custom AES-256-GCM encrypted token (`utils/auth.ts`: 7-day TTL, per-process key) | MET* | *Correction to prior docs: tokens are AES-256-GCM ciphertexts (`iv.ciphertext.tag`), **not** standard JWT/HMAC. Crypto design is sound; deviation from the documented "JWT" convention is a maintainability risk. `jsonwebtoken` dep is unused. |
| R-31 | Authorization: owner-only project access; no IDOR | `findOwnedProject` + `userId` checks on all project routes; UUID ids; `POST` rejects existing ids | MET | Cross-account isolation proven by `api.test.cjs`. |
| R-32 | SSRF protection on server-fetched URLs | `utils/ssrf.ts` `validateSafeUrl`: protocol/port whitelist, private/loopback/link-local/multicast/CGNAT/reserved ranges blocked, cloud-metadata IP blocked | MET | Resolves DNS once — TOCTOU/DNS-rebinding window remains (D-13). |
| R-33 | Upload safety: type + size + secure filenames | 5 MB multer limit; `image-size` type whitelist (jpg/png/webp); randomized `up-{userId}-{ts}-{uuid}` filenames; document extraction by mimetype | MET | Document extraction accepts any mimetype it is handed; `mammoth`/`pdf-parse` are the only parsers (no exec risk) — monitor office-file parser CVEs. |
| R-34 | Asset URLs require auth + ownership; path-traversal resistance | `GET /uploads/:filename` requires `?token=`; ownership via `-{userId}-` prefix; normalize + prefix-strip vs traversal | MET | Breaks client preview/apply because clients never attach the token (D-03, D-04). |
| R-35 | CORS deny-by-default | Explicit origin allowlist; unknown origins → 403 `Origin not allowed` | MET | Verified by `api.test.cjs` (CORS test). |
| R-36 | Secrets kept out of source and documents | Grep scan found no `sk-…`, private keys, or API keys in client/server source; `X-Provider-Key` sent per-request from `credentialStore` | MET | `server/sqlite.db` (user records incl. test data) is committed to git (D-15). |
| R-37 | No secrets/temp state in project documents | Secrets, selection, panel state, object URLs excluded from document model; validation drops `blob:` URLs | MET | — |

## Milestone status claims (IMP)

| # | Claim | Evidence | Status |
|---|---|---|---|
| R-38 | "ALL MILESTONES COMPLETED — ready for release" (`docs/implementation-plan.md`) | Build + 18 server tests pass; **but** two client unit tests fail, generated-image feature is non-functional, auth UI/API base URLs are hardcoded to localhost | **CONTESTED** — release readiness is not supported until D-01..D-05, D-08, D-09 are resolved. |

---

### Key divergences summary
1. **Auth token scheme** documented/summarized as JWT/HMAC — actual implementation is AES-256-GCM (R-30).
2. **Backend datastore** — `ARCH` says PostgreSQL + private object storage; implementation is SQLite + local `/uploads` (documentation drift, D-16).
3. **Mock adapters** required by PR — defined but never wired (R-18).
4. **Web research modes** required by PR — advertised in UI but always returns 501 (R-13).