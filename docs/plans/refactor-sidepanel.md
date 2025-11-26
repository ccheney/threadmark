# Refactoring Plan: `src/features/sidepanel/sidepanel.ts`

## Objective
Decompose the monolithic `sidepanel.ts` file into modular components to improve maintainability, readability, and separation of concerns.

## Current Responsibilities
1.  **Initialization**: Setup on `DOMContentLoaded`.
2.  **Options Management**: Theme application, auto-highlight toggle, UI wiring (`options-panel`), and "Purge" functionality.
3.  **Bookmark Management**: fetching from IndexedDB, filtering (search/date/chat), rendering the list, and deleting items.
4.  **Navigation**: Opening bookmarks in tabs, handling retries.
5.  **Utilities**: HTML escaping, string truncation, theme helpers.

## Proposed Structure
We will create a `modules` directory within `src/features/sidepanel/`.

```text
src/features/sidepanel/
├── sidepanel.ts            # Entry point (Orchestration)
└── modules/
    ├── utils.ts            # Helpers: escapeHtml, truncate, sendMessageWithRetry
    ├── theme.ts            # Theme logic: applyTheme, updateShowAllButton
    ├── navigation.ts       # Navigation: openBookmark
    ├── bookmarks.ts        # Core Logic: loadBookmarks, renderList, delete, purge, filters
    └── options.ts          # UI Wiring: initOptionsPanel
```

## Module Details

### 1. `modules/utils.ts`
*   **Exports**: `escapeHtml`, `truncate`, `sendMessageWithRetry`.
*   **Dependencies**: None.

### 2. `modules/theme.ts`
*   **Exports**: `applyTheme`, `updateShowAllButton`.
*   **Dependencies**: Imports `Settings` type.

### 3. `modules/navigation.ts`
*   **Exports**: `openBookmark`.
*   **Dependencies**: Imports `sendMessageWithRetry` from `utils.ts`.

### 4. `modules/bookmarks.ts`
*   **Exports**: 
    *   `loadBookmarks` (Main render function)
    *   `populateChatFilter`
    *   `purgePageBookmarks` (Extracted from the purge button click handler)
    *   `deleteBookmark` (Internal usage, but maybe exported if needed)
*   **Internal**: `renderBookmarkItem` (helper), `filterBookmarks` (helper).
*   **Dependencies**: 
    *   `../../shared/db` (initDB)
    *   `utils.ts` (escapeHtml, truncate)
    *   `navigation.ts` (openBookmark)
    *   `theme.ts` (types/helpers if needed, or just DOM manipulation)

### 5. `modules/options.ts`
*   **Exports**: `initOptionsPanel`.
*   **Dependencies**: 
    *   `../settings/storage` (saveSettings, getSettings)
    *   `theme.ts` (applyTheme)
    *   `bookmarks.ts` (purgePageBookmarks, loadBookmarks)

### 6. `sidepanel.ts` (Entry Point)
*   Imports `initOptionsPanel` from `modules/options`.
*   Imports `loadBookmarks`, `populateChatFilter` from `modules/bookmarks`.
*   Sets up the global event listeners (Search input, Filter changes, `BOOKMARK_SAVED` message).
*   Initializes the options panel.

## Execution Steps
1.  Create directory `src/features/sidepanel/modules/`.
2.  Create `utils.ts`.
3.  Create `theme.ts`.
4.  Create `navigation.ts`.
5.  Create `bookmarks.ts` (This will be the largest extraction).
6.  Create `options.ts`.
7.  Refactor `sidepanel.ts` to wire everything together.
8.  Verify build with `bun run build`.
9.  Lint check.

## Logic extraction notes
*   **Purge Logic**: The "Purge" button logic in `sidepanel.ts` is currently inline. It performs DB operations and DOM updates. This will be moved to `bookmarks.ts` as `purgePageBookmarks` to keep `options.ts` focused on UI wiring.
*   **Circular Dependencies**: 
    *   `options` -> `bookmarks` (for purge/load). 
    *   `bookmarks` -> `navigation` (for open).
    *   `bookmarks` -> `utils`.
    *   `navigation` -> `utils`.
    *   No cycles detected.

## Verification
*   Ensure "Show All", "Options", "Purge", "Delete", "Search", and "Filter" functionalities persist.
