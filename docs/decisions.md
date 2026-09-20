# Decisions Log

1. **Framework Choice:** React + TypeScript + Vite. Provides a fast developer experience and strong typing for complex state.
2. **Styling:** Tailwind CSS. Allows rapid prototyping and unified design tokens.
3. **Canvas Engine:** Fabric.js chosen for text rendering capabilities, object manipulation, and ease of exporting to images. Subject to prototype validation in Milestone A.
4. **Backend Engine:** Node.js + Express. Simple, scalable, and shares TypeScript interfaces with the frontend.
5. **Local Storage First:** IndexedDB is used initially for persistence to guarantee operation without cloud connectivity or active billing.
