# Refactoring Plan: `src/features/capture/content.ts`

## Objective
Decompose the monolithic `content.ts` file into smaller, single-responsibility modules to improve maintainability and readability, while preserving exact functionality.

## Current Responsibilities
1.  **Initialization**: Connection check, settings load, initial bookmark fetch.
2.  **Messaging**: Handling `HIGHLIGHT_REQUESTED`, `HIGHLIGHT_BATCH`, `REMOVE_HIGHLIGHT`.
3.  **Highlighting**: Text search (`findRanges`), DOM manipulation (`highlightRange`), cleanup.
4.  **Observer**: `MutationObserver` for dynamic content and `pendingQueue` management.
5.  **UI/Bubble**: Selection handling, "Save" bubble, context capture.
6.  **Scroll Map**: Visualizing highlights on a side scroll bar.

## Proposed Structure
We will create a `modules` directory within `src/features/capture/` to house the logic.

```text
src/features/capture/
├── content.ts              # Entry point (Initialization & Wiring)
└── modules/
    ├── types.ts            # Shared interfaces (PendingHighlight, etc.)
    ├── scroll_map.ts       # Scroll map visualization logic
    ├── highlighter.ts      # Text search and DOM highlighting logic
    ├── observer.ts         # MutationObserver and PendingQueue logic
    ├── bubble.ts           # Selection bubble and interaction
    └── messaging.ts        # Message listeners
```

## Module Details

### 1. `modules/types.ts`
*   `interface PendingHighlight`
*   `interface Window` (global declaration)

### 2. `modules/scroll_map.ts`
*   **Exports**: `initScrollMap`, `updateScrollMap`.
*   **Dependencies**: None (interacts with DOM).

### 3. `modules/highlighter.ts`
*   **Exports**: `findAndHighlight`, `clearHighlights`, `removeHighlight`, `unwrapElement`.
*   **Internal**: `findRanges`, `highlightRange`, `mapStrippedToReal`.
*   **Dependencies**: Imports `updateScrollMap` from `scroll_map.ts`.

### 4. `modules/observer.ts`
*   **Exports**: `startHighlightObserver`, `processPendingHighlights`, `addToPendingQueue` (helper).
*   **Internal**: `pendingQueue`, `highlightObserver`.
*   **Dependencies**: Imports `findAndHighlight` from `highlighter.ts`.

### 5. `modules/bubble.ts`
*   **Exports**: `initBubbleListener` (sets up event listeners).
*   **Internal**: `handleSelectionChange`, `showBubble`, `handleBookmarkClick`, `captureContext`.
*   **Dependencies**: Imports `findAndHighlight` from `highlighter.ts`.

### 6. `modules/messaging.ts`
*   **Exports**: `initMessageListener`.
*   **Dependencies**: 
    *   `highlighter.ts` (`findAndHighlight`, `clearHighlights`, `removeHighlight`)
    *   `observer.ts` (`addToPendingQueue`, `startHighlightObserver`)

### 7. `content.ts` (Entry Point)
*   Imports and calls `initBubbleListener`, `initMessageListener`.
*   Performs the initial `PING`, Settings Load, and `GET_BOOKMARKS_FOR_URL` flow.
*   Imports `addToPendingQueue` and `startHighlightObserver` to handle initial bookmarks.

## Execution Steps
1.  Create `src/features/capture/modules/types.ts`.
2.  Create `src/features/capture/modules/scroll_map.ts`.
3.  Create `src/features/capture/modules/highlighter.ts`.
4.  Create `src/features/capture/modules/observer.ts`.
5.  Create `src/features/capture/modules/bubble.ts`.
6.  Create `src/features/capture/modules/messaging.ts`.
7.  Refactor `src/features/capture/content.ts` to use the new modules.
8.  Verify build using `bun run build`.

## Notes
*   **Circular Dependencies**: `highlighter` updates `scroll_map`. `observer` calls `highlighter`. `messaging` calls both. `bubble` calls `highlighter`. The dependency graph is acyclic:
    *   `messaging` -> `observer` -> `highlighter` -> `scroll_map`
    *   `bubble` -> `highlighter`
*   **State**: `pendingQueue` will reside in `observer.ts`.
