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
