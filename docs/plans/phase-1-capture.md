# Phase 1 – Selection Capture & Bookmark Message Pipeline

## Milestone 1.1 – Selection Detection

**Goal:** Capture user text selection in a ChatGPT conversation and surface a UI entry point.

**Acceptance criteria**

* When you select text inside a chat, the content script detects the selection.
* A small floating bubble appears near the selection with at least one active button (e.g., “Bookmark”).
* Clicking outside the selection dismisses the bubble.

**Definition of Done**

* Selection logic:

  * Correctly reads `window.getSelection()` and handles multi-node selections reasonably (for now, simplest case: inline text).
* Bubble:

  * Stays within viewport.
  * Doesn’t overlap annoyingly with ChatGPT UI elements in obvious cases.
* No persistent data is stored yet; on click, the content script just sends a “bookmarkRequested” message to background.

---

## Milestone 1.2 – Raw Bookmark Payload Construction

**Goal:** Build and send a complete, raw bookmark payload from the page to background.

**Acceptance criteria**

* Clicking “Bookmark” constructs a payload that includes:

  * Exact selected text.
  * Some prefix/suffix context.
  * Current tab URL.
  * Basic chat metadata (document title, visible chat title if present).
* Payload is visible in background logs and looks structurally like what you expect for the future schema.

**Definition of Done**

* Content script collects and sends:

  * `exactText`
  * `prefix`/`suffix` (fixed window around selection)
  * URL
  * Timestamp
* Background service worker receives a well-structured object and logs it.
* No persistence yet; only logging.
