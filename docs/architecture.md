# Architecture

## Technical Foundation

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Canvas Rendering:** Fabric.js (subject to prototyping validation)
- **State Management:** Centralized editor-state store (e.g., Zustand or Context API)
- **Local Persistence:** IndexedDB (for device projects and recovery)
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL (for account and project records)
- **Storage:** Private object storage for assets

## Application Architecture

The architecture separates the following concerns:
- **Editor document model:** A JSON schema that represents the document structure.
- **Canvas rendering adapter:** Renders the document schema onto the Fabric.js canvas.
- **Interface state:** UI toggles, open panels, zoom level, etc.
- **Undo/redo history:** Stack of document transactions.
- **Persistence and synchronization:** Saving to IndexedDB and later Cloud via API.
- **Asset management:** Handling image uploads and URL references.
- **Export adapters:** Generating PNG/JPG/PDF/PPTX from the document schema.
- **AI provider adapters:** Communicating with AI services for drafting.
- **Billing and usage accounting:** Tracking AI token usage.

## Document Schema

An application-owned, versioned document schema. It supports:
- Project metadata: ID, title, timestamps, dimensions, revision, schema version.
- Theme tokens and local overrides.
- Ordered slides with stable IDs.
- Ordered elements with stable IDs.
- Element types: Text, images, rectangles, circles, lines.
- Element properties: Position, dimensions, rotation, opacity, lock state.
- Semantic roles: Heading, body, image, footer.
- Asset references.
- Accessibility: Post caption and per-slide descriptions.
- Source references for AI facts.

*(Secrets, selected elements, open panels, and temporary object URLs are strictly kept out of project documents).*
