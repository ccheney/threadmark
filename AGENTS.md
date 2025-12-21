# Threadmark

> **Browser Extension for robust ChatGPT bookmarking.**

## Project Overview

**Threadmark** (formerly "ChatGPT Clipbook") is a Chrome Extension designed to help users capture, organize, and recall specific text snippets within ChatGPT conversations. It addresses the difficulty of finding specific information in long chat histories by providing precision highlighting and robust re-anchoring.

**Key Features:**
*   **Capture:** Highlight text in `chatgpt.com` and save it with tags/notes.
*   **Re-anchoring:** Robustly locating specific text snippets even after page reloads or lazy-loading.
*   **Organization:** Side panel UI for searching, filtering, and managing bookmarks.
*   **Storage:** Local-first data storage using IndexedDB.

## Tech Stack & Environment

*   **Runtime & Package Manager:** [Bun](https://bun.sh/) (v1.3.3+)
*   **Language:** TypeScript
*   **Platform:** Chrome Extension (Manifest V3)
*   **Linting & Formatting:** [Biome](https://biomejs.dev/)
*   **Database:** IndexedDB (using `idb` wrapper)

## Architecture

The codebase follows a feature-based architecture in `src/`:

*   `src/background.ts`: Service worker for orchestration.
*   `src/manifest.json`: Extension configuration.
*   `src/features/`: Isolated feature modules.
    *   `capture/`: Content scripts for text selection and bookmarking UI.
    *   `sidepanel/`: The main review and search interface.
    *   `settings/`: Options page and configuration logic.
*   `src/shared/`: Shared utilities, database access, and type definitions.
*   `scripts/`: Build and maintenance scripts (e.g., `build.ts`).

## Development Workflow

### Prerequisites
*   **Bun** must be installed.

### Key Commands

| Task | Command | Description |
| :--- | :--- | :--- |
| **Install Deps** | `bun install` | Install project dependencies. |
| **Build** | `bun run build` | Compiles `src/` to `dist/` for loading into Chrome. |
| **Watch Mode** | `bun run dev` | Watches for changes and rebuilds automatically. |
| **Lint/Check** | `bun run check` | Runs Biome to check for linting/formatting errors. |
| **Format** | `bun run fix` | Runs Biome to automatically fix formatting issues. |
| **Typecheck** | `bun run typecheck` | Runs `tsc` to verify types without emitting files. |

### Loading in Chrome
1.  Run `bun run build`.
2.  Open `chrome://extensions`.
3.  Enable **Developer mode**.
4.  Click **Load unpacked** and select the `dist/` directory.

### Iteration
After making changes:
1.  Ensure the build has completed (or `bun run build`).
2.  Reload the extension in `chrome://extensions` (circular arrow icon).
3.  Reload the `chatgpt.com` tab.

## Standards & Conventions

*   **Style:** Biome is the single source of truth for formatting (tabs, double quotes).
*   **Imports:** Organized automatically by Biome.
*   **Types:** Strict TypeScript usage; avoid `any`.
*   **Async/Await:** Preferred over raw promises.
*   **Components:** (If applicable) Functional components with hooks.
