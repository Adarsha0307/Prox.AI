# Prox: AI Carousel Editor

An AI-assisted carousel creation platform built with React, TypeScript, Vite, Node.js, and SQLite.

## Overview

Prox is a complete tool that supports the entire lifecycle of creating stunning carousels for educational creators, LinkedIn professionals, and marketers. It allows users to go from a raw idea or source material (URL/PDF) to an editable outline, AI-generated draft, manual visual refinement, and finally, exporting to multiple formats.

## Key Features

### 🎨 Visual Editor & Design System
- **Drag-and-Drop Canvas:** Full WYSIWYG editor for text, images, and shapes.
- **Template Families & Custom Layouts:** Start with beautiful built-in templates (Minimal, Bold, Playful) or save your own slides as reusable custom layouts.
- **Smart Theme Engine:** Extract brand colors directly from an uploaded logo or image, and seamlessly propagate theme tokens (colors, typography) across all slides.
- **Auto-Layout Correction:** Intelligent validation ensures elements stay within safe margins, text doesn't overflow, and overlapping elements are corrected.

### 🤖 AI Generation & Assistance
- **Content from Anywhere:** Generate cohesive, multi-slide carousels from a simple prompt, a pasted URL, or an uploaded PDF document.
- **AI Image Generation:** Seamlessly generate contextual slide images using DALL-E 3 directly from the editor.
- **Bring Your Own Key (BYOK):** Users can plug in their own OpenAI API key for unlimited generation, bypassing platform billing.
- **Platform Funded Usage:** A robust built-in credit system lets users generate content using platform credits when they don't have their own API key.

### ☁️ Cloud Sync & Persistence
- **Offline-First Architecture:** Changes are instantly saved locally (IndexedDB) and lazily synced to the cloud.
- **Conflict Resolution:** Robust multi-device syncing ensures newer cloud revisions gracefully merge with local changes, with visual indicators for sync states.
- **Authentication:** Secure JWT-based user accounts and workspaces keep projects isolated and private.

### 📤 Exports
- Export your finished carousels to **PNG** archives, multi-page **PDFs**, and fully editable **PPTX** presentations.

## Repository Structure

- `client/` - Frontend application (Vite, React, Zustand, Tailwind CSS, Lucide)
- `server/` - Backend application (Node.js, Express, Better-SQLite3, Drizzle ORM)
- `docs/` - Original documentation and implementation plans

## Getting Started & Development Setup

### Prerequisites
- Node.js (v18+)
- npm or pnpm

### Environment Variables & AI Provider Configuration
Create a `.env` file in the `server` directory (`server/.env`):
```env
# Authentication
AUTH_SECRET="your_long_random_secret_string" # Required for JWT signing

# AI Configuration
OPENAI_API_KEY="sk-..."                      # Platform-funded API key (optional if MOCK or BYOK used)
ENABLE_PLATFORM_FUNDING="true"               # Set to 'false' to require users to provide their own key
MOCK_AI_PROVIDER="false"                     # Set to 'true' to use a mock AI provider for local dev (bypasses costs)

# Server Config
CORS_ORIGIN="http://localhost:5173, http://127.0.0.1:5173"
PORT="3000"
```

### Database Migrations
Prox uses SQLite and Drizzle ORM. Before running the backend for the first time, push the database schema:
```bash
cd server
npm run db:push
```

### Running Locally

1. **Start the Backend:**
   ```bash
   cd server
   npm install
   npm run dev
   ```

2. **Start the Frontend:**
   ```bash
   cd client
   npm install
   npm run dev
   ```

3. Open `http://localhost:5173` in your browser.

## Testing & Building

### Running Tests
Integration tests for the API, user registration, project isolation, and billing logic are written in native `node:test`.
```bash
cd server
npm run test
```
*Note: The frontend currently relies on manual QA workflows and type checking for validation.*

### Building for Production
The client and server must be built separately before deployment.

**Build Client (Static Vite Output):**
```bash
cd client
npm run build
# Outputs to client/dist/
```

**Build Server (Compiled Node App):**
```bash
cd server
npm run build
# Outputs to server/dist/
```

## Deployment Requirements
1. **Node.js Environment:** The backend requires a Node.js runtime (v18+).
2. **Persistent Storage:** SQLite (`sqlite.db`) and the `server/uploads/` directory must be stored on a persistent volume. If deployed on ephemeral containers (like Heroku or standard Docker without volumes), uploaded images and the database will be lost on restart.
3. **Static File Hosting:** The frontend `dist` directory should be hosted on a CDN or static web host (like Vercel, Netlify, or Nginx).
4. **Environment Variables:** Ensure `AUTH_SECRET` and CORS origins are securely configured in your production environment.
