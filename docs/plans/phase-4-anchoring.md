# Phase 4 – Anchoring & Highlight in Chat

## Milestone 4.1 – Basic On-Page Highlight API Integration

**Goal:** Given a known text range in the DOM, apply a highlight.

**Acceptance criteria**

* On a simple page (test scenario you control), you can:

  * Identify a specific element and character offsets.
  * Create a `Range`.
  * Apply a highlight that visually marks it.

**Definition of Done**

* Content script has a utility that:

  * Accepts locators (e.g., node + offsets) and returns a visual highlight.
* Highlighting API usage is encapsulated so you can later plug in CSS Custom Highlight or a fallback style.

---

## Milestone 4.2 – Simple Re-anchoring (Same Session)

**Goal:** While already on the same chat page, clicking a bookmark triggers an in-page highlight of the stored text.

**Acceptance criteria**

* Flow:

  * Open chat.
  * Create a new bookmark.
  * Without reloading, click that bookmark from the side panel.
  * The previously saved snippet is highlighted in the chat.
* Works for normal assistant/user text (not worrying about tricky multi-node or code blocks yet).

**Definition of Done**

* Bookmarks now store enough info to derive a `Range` when the DOM is unchanged:

  * A way to find the message node (e.g., via a stable selector or current DOM assumptions).
  * Offsets within that message text.
* The system can detect that it’s already on the correct chat and skip opening a new tab.

---

## Milestone 4.3 – Re-anchoring after Reload / Navigation

**Goal:** Re-anchoring survives a page reload.

**Acceptance criteria**

* Flow:

  * Create bookmarks.
  * Reload the chat.
  * From the side panel, click the bookmark.
  * Extension highlights the correct snippet again.
* Works for multiple bookmarks in the same chat.

**Definition of Done**

* Bookmark records now contain:

  * Text-based anchors (exact text and some context).
  * Message-level identifiers.
* Re-anchoring logic:

  * Locates the correct message by text or fingerprint.
  * Within that message, finds the exact selection again.
* Handles typical DOM changes due to re-render on reload without breaking.

---

## Milestone 4.4 – Lazy-Load Handling

**Goal:** Re-anchoring can bring in older parts of the conversation that are not initially in the DOM.

**Acceptance criteria**

* Flow:

  * Use a long chat with lazy-loading (older messages load as you scroll).
  * Create a bookmark near the top.
  * Reload the page so you start in the middle or bottom.
  * Click bookmark in side panel.
  * Extension scrolls up, triggers lazy-loading, then eventually highlights the snippet.

**Definition of Done**

* You have a controlled scroll loop that:

  * Scrolls stepwise toward the top.
  * After each step, looks for a match.
  * Stops either when the bookmark is found or a defined maximum is reached.
* UI communicates if the bookmark cannot be found even after scrolling.
