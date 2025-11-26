# Phase 3 – Side Panel & Basic Bookmark List

## Milestone 3.1 – Side Panel Shell

**Goal:** Side panel loads and can display static content.

**Acceptance criteria**

* Extension can open a side panel via toolbar icon or programmatic call.
* Side panel shows a simple placeholder UI.

**Definition of Done**

* Manifest wired to use `chrome.sidePanel`.
* Side panel has a basic layout component (header + content area).
* No bookmark data yet; just static text to confirm wiring.

---

## Milestone 3.2 – Live Bookmark List

**Goal:** Side panel lists bookmarks from IndexedDB.

**Acceptance criteria**

* Opening side panel shows:

  * A list of all bookmarks in reverse chronological order.
  * For each bookmark: snippet text, chat title (if available), timestamp.
* Creating a new bookmark and reopening the panel shows it in the list.

**Definition of Done**

* Side panel UI can query IndexedDB (directly or via background).
* No filters or search yet; pure list view.
* Smooth enough for a realistic number of bookmarks (hundreds) without obvious lag.

---

## Milestone 3.3 – Open Chat from Bookmark

**Goal:** Clicking a bookmark opens or focuses the associated chat tab.

**Acceptance criteria**

* Clicking a bookmark row:

  * If chat tab exists: brings it to foreground.
  * If not: opens a new tab to the stored URL.

**Definition of Done**

* Clear navigation behavior:

  * Single source of truth: `thread.url`.
* Minimal guardrails:

  * If URL is missing or malformed, the UI shows some kind of “can’t open chat” indication instead of silently failing.
