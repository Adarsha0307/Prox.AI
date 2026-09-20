# Product Requirements

## Objective
Build a beginner-friendly tool that supports the full lifecycle of carousel creation:
Idea or source material → editable outline → AI draft → editable slide designs → manual refinement → save → export.

## Audience
Educational creators, content creators, LinkedIn professionals, CEOs, and other professional users.

## Scope & Access
- Public-facing product with public registration when operationally ready.
- Devices: Desktop and mobile web browsers (no native app).
- Language: English first, architected for i18n later.

## Key Capabilities
- Consistent design across an entire carousel.
- Strong editable typography.
- Global branding changes (colors, fonts, logo, handle).
- Useful text-overflow handling.
- Fast reuse of templates and brand settings.
- Reliable saving, recovery, and exports.

## Inputs & Outputs
- Inputs: topics, pasted text, uploaded documents, website URLs.
- Outputs: generated content, template-based designs, custom editable layouts, image assets.
- AI images: included in the product scope.
- Facts: source-only, general drafting, web research with sources.
- Generated text must remain editable. Generated images are image assets (not editable objects inside).

## Export
- User-selectable images (PNG/JPG/ZIP).
- PDF.
- PowerPoint (.pptx).
- Project JSON.

## The constraints
- Budget is ₹0. No paid infrastructure.
- Platform-funded generation disabled until funding exists.
- Mock adapters for development and automated tests must be clearly labeled.
- Keep manual editing functional when external services are unavailable.
