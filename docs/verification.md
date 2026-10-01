# Verification

This document outlines the testing strategy.

## Testing Stack
- **Vitest:** For utility functions, logic, and state management testing.
- **Playwright:** For meaningful end-to-end user interaction verification on the canvas.

## Milestone A Verification Checklist
- [ ] Edit → save → reopen → export flow works.
- [ ] Images survive browser reload.
- [ ] Export dimensions are exact.
- [ ] Selection controls are absent from exported images.
- [ ] Canvas mounting and cleanup do not leak event handlers.

## Phase A QA Verification Results (2026-09)

### Server
- **Boot:** `npm run build && npm start` boots cleanly; `/health` returns `{ status: "ok" }` (verified live on a disposable database).
- **Integration tests:** `server/test/api.test.cjs` — 7/7 pass:
  - Registration rejects malformed input with 400 (not 500).
  - Unauthenticated/invalid tokens cannot reach project endpoints.
  - Cross-account ownership isolation.
  - Older revisions cannot overwrite newer server state (409 `STALE_REVISION`).
  - Project payloads validated before reaching the database.
  - `/auth/me` resolves the session; deletion is owner-only.
  - CORS rejects unknown origins, accepts the configured origin.
- **Live E2E flow (scripted, disposable DB):** register → mock-email code → verify → login → `/auth/me` → create → list → get → update (revision 2) → stale revision rejected (409) → second account sees zero projects.

### Client
- **TypeScript:** `tsc -b --force` clean; `npm run build` (tsc + vite) succeeds.
- **Lint:** `oxlint` clean (1 non-blocking React Compiler warning about a banner `setState` in an effect).
- **Dev server:** `vite` boots and serves the app (HTTP 200).
- **Key fixes in this pass:**
  - `ExportDialog` migrated to the new `exportAsImages(project, options)` signature.
  - `TopBar` sync indicator reads `cloudState`/`cloudSyncedAt`; auto-login uses `apiRequest`.
  - `templates.ts` image-led family now emits valid `rectangle` elements (was `type: 'shape'`/`role: 'decoration'` which the new schema validation rejects).
  - `cloudSync` retry path no longer trips TypeScript's property flow-narrowing across `await`.
  - Backup restore wraps `Uint8Array` for `BlobPart` compatibility.

### Known export limitations (PPTX)
- Rotation, per-element opacity, letter spacing, and exact line height are not representable in the PPTX mapping and are approximated (opacity/rotation are dropped; text is placed at the element box with px→pt font scaling).
- Images are embedded as PNG pictures with the crop applied (not re-editable crops).
- Fonts are referenced by name; PowerPoint substitutes missing fonts.
- PDF export is rasterized (text is not selectable).
