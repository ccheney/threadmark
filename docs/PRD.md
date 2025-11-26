# PRD: ChatGPT Bookmarking Chrome Extension

**Product name (working):** ChatGPT Clipbook
**Owner:** TBD
**Status:** Draft
**Last updated:** 2025-11-26

---

## 1. Summary

ChatGPT Clipbook is a Chrome extension for `chatgpt.com` that lets users:

* Highlight any text in a ChatGPT conversation.
* Save it as a “bookmark” with optional tags and notes.
* Later, quickly re-open the original chat and jump back to that exact snippet, even when the chat is long, lazy-loads content, or the UI has changed.

Core ideas:

* Capture strong anchors at save time (text, context, position, message identity).
* Re-anchor robustly when the chat is reopened (fuzzy matching, lazy-loading).
* Provide a side-panel UI to browse, search, and manage bookmarks.

---

## 2. Problem Statement

### 2.1 User problem

* ChatGPT conversations are long, multi-topic, and often revisited.
* The built-in conversation history UI is:

  * Organized by whole chats, not the specific blocks of text users care about.
  * Hard to skim for “that one paragraph” you remember.
  * Limited search and no concept of “highlights” or saved excerpts.

Users currently:

* Scroll and manually skim long chats.
* Copy/paste snippets into external tools (Notes, Notion, etc.).
* Lose context and waste time trying to rediscover important sections.

### 2.2 Why now

* ChatGPT usage is deep and multi-session; users treat it like a long-term workspace.
* The complexity and length of chats are increasing.
* Chrome and the web platform now have:

  * Side Panel API
  * CSS Custom Highlight
  * Scroll-to-Text Fragments
  * Web Annotation model as a reference

…making a robust, polished bookmarking tool more achievable.

---

## 3. Goals & Non-Goals

### 3.1 Goals

1. **Fast capture:**
   Highlight → click bookmark button (or shortcut) → done.

2. **Reliable return:**
   From a bookmark, open the chat and scroll/highlight the exact snippet with high reliability, even across reloads and lazy-loading.

3. **Powerful review UI:**
   Side panel that allows:

   * Browsing a list of saved snippets.
   * Filtering by chat, tags, date, etc.
   * Full-text search over snippet text and notes.

4. **Local-first, safe storage:**
  All data stored locally (IndexedDB) with an attempt to get persistent storage.

5. **Developer-friendly architecture:**
   Clear separation between:

   * Content scripts (UI + anchoring)
   * Background service worker (storage + orchestration)
   * Side panel (review experience)
   * Options page (settings, backup)

### 3.2 Non-Goals

* Not a general clipboard manager for the entire web.
  **Scope is only `chatgpt.com`.**
* No cloud sync or multi-device sync—ever.
* No team collaboration / shared bookmark sets.
* No custom AI summarization of bookmarks (future idea, not v1).

---

## 4. Target Users & Personas

### 4.1 Primary persona

**“Power user / builder”**

* Heavy ChatGPT user (dev, designer, founder, researcher, etc.).
* Uses ChatGPT for specs, code snippets, explanations, and strategy.
* Needs to:

  * Reuse certain answers and prompts.
  * Compare past ideas across chats.
  * Keep a curated set of “golden snippets.”

### 4.2 Secondary persona

**“Long-running learner”**

* Uses ChatGPT like a study partner.
* Keeps long multi-week chats.
* Needs to:

  * Save key explanations, formulas, and examples.
  * Quickly jump back to those anchor points.

---

## 5. User Stories

### 5.1 Capture

* As a user, when I highlight part of an answer in ChatGPT, I want a small popup to bookmark it with one click, so I don’t lose it.
* As a user, I want to optionally tag or annotate the selected text when I bookmark it, so I can group and recall it later.

### 5.2 Navigation & Re-anchoring

* As a user, from the bookmark list, I want to click a snippet and have the extension:

  * Open the associated chat.
  * Scroll to the right location.
  * Highlight the exact text (or as close as possible).
* As a user, if the exact snippet can’t be found, I want to see the closest match and be told the match is approximate.

### 5.3 Review & Search

* As a user, I want a compact UI (side panel) with:

  * A list of all saved snippets.
  * Chat titles and dates to give context.
* As a user, I want to search by:

  * Words in the snippet text.
  * Words in my notes.
  * Tags.
* As a user, I want to filter bookmarks by:

  * Chat.
  * Time ranges (today, this week, older).
  * Role (user message vs assistant response).

### 5.4 Data & Portability

* As a user, I want my bookmarks to be stored locally and to keep working offline.

### 5.5 Control & Preferences

* As a user, I want to control:

  * Whether highlights automatically appear when I open a chat.
  * Whether the side panel opens after I save a bookmark.
  * Keyboard shortcuts for bookmarking.

---

## 6. UX / Interaction Overview

### 6.1 Capture Flow

* The user highlights text inside a ChatGPT conversation.
* A small floating bubble appears near the selection with:

  * **Bookmark**
  * (Optional) **Add tags**
  * (Optional) **Add note**
* On click:

  * A toast confirms “Bookmark saved” with **Undo**.
  * The selection can be highlighted in-place (subtle color).

Alternate entry:

* Context menu item: “Bookmark selection in ChatGPT”.
* Keyboard shortcut: e.g. ⌥/Alt + B.

### 6.2 Review Flow (Side Panel)

* Side panel opens via:

  * Extension toolbar icon.
  * Custom shortcut (if desired).
* Side panel layout:

  * Top: Search input + quick filters (Today, This Week, Tagged, Has Notes).
  * Left/secondary: Optional filters for chat, tags, date range.
  * Main: List of bookmarks.
* Each bookmark row shows:

  * Snippet text (1–2 lines, with selected portion emphasized).
  * Chat title.
  * Tags.
  * Date/time.

Row actions:

* Primary click: Open chat and re-anchor.
* Secondary actions:

  * Copy text.
  * Copy chat URL.
  * Copy “text fragment link” (when available).
  * Edit note/tags.
  * Delete.

### 6.3 Navigation Flow (from bookmark → chat)

* User clicks a bookmark in the side panel.
* Workflow:

  1. Ensure the appropriate chat tab is open (open or focus existing).
  2. Try deep-link via Scroll-to-Text fragment if available.
  3. If not found, run lazy-load & fuzzy re-anchoring.
  4. Scroll to and highlight the best match.

### 6.4 Optional UI Enhancements

* “Show my highlights in this chat” toggle:

  * When enabled, all snippets from that chat are highlighted.
* Scroll map/gutter:

  * Vertical mini-map on the right showing markers where bookmarks exist; clicking a marker scrolls to that region.

---

## 7. Functional Requirements

### 7.1 Capture & Bookmark Creation

**FR-1**: The extension MUST detect text selection events in ChatGPT conversations.
**FR-2**: When a selection is made, a capture UI SHOULD appear near the selection.
**FR-3**: The user MUST be able to save the selection as a bookmark with a single click.
**FR-4**: Bookmarks MUST store at least:

* Exact selected text.
* Context (prefix/suffix).
* Chat URL.
* Timestamp.
  **FR-5**: Bookmarks SHOULD also store:
* Chat title.
* Tags.
* Optional user note.
* Role (user/assistant).
* Message index & fingerprint.
* Position and DOM hints for anchoring.

### 7.2 Storage & Data Model

**FR-6**: Bookmarks MUST be stored in local IndexedDB.
**FR-7**: The extension MUST attempt to request persistent storage (StorageManager API) and surface the result to the user.
**FR-8**: The data model MUST support:

* Threads/chats.
* Bookmarks.
* Tags.
* Settings.

### 7.3 Search & Browsing

**FR-9**: Side panel MUST list bookmarks in reverse chronological order by default.
**FR-10**: Side panel MUST provide full-text search over:

* Bookmark text.
* Notes.
* Tags.
  **FR-11**: Side panel MUST provide filters by:
* Chat.
* Date range.
  **FR-12**: Side panel SHOULD support filtering by:
* Role (user vs assistant).
* Tags (one or multiple).

### 7.4 Navigation & Re-anchoring

**FR-13**: Clicking a bookmark MUST open or focus the associated chat tab.
**FR-14**: The extension MUST attempt to scroll and highlight the exact snippet, not just the top of the chat.
**FR-15**: The re-anchoring process MUST:

* Use multiple anchors (text quote, position, message fingerprint, DOM hints).
* Be resilient to lazy-loading and minor DOM changes.
  **FR-16**: If a bookmark cannot be anchored exactly, the extension MUST:
* Show the closest match.
* Indicate that the match is approximate (e.g., via a label or tooltip).

### 7.5 Settings & Preferences

**FR-20**: The extension MUST offer a settings UI (Options page).
**FR-21**: Settings MUST include:

* Toggle for “Show highlights automatically on chat open”.
* Storage status (whether persistent storage is granted).
  **FR-22**: Settings SHOULD include:
* Configurable fuzzy match strength.
* Configurable lazy-loading scroll budget.
* Toggles for secondary features (thumbnails, scroll map, etc.).

---

## 8. Non-Functional Requirements

### 8.1 Performance

* **NFR-1**: Bookmark creation should complete in under 150ms in typical usage (no perceivable lag).
* **NFR-2**: Opening the side panel and listing up to 1,000 bookmarks should feel instantaneous (<200ms to initial render).
* **NFR-3**: Re-anchoring a bookmark in a long chat should typically complete within 1–2 seconds after the chat is loaded (excluding user’s network/ChatGPT latency).

### 8.2 Reliability

* **NFR-4**: Re-anchoring should succeed (exact or high-confidence match) in at least 95% of cases where the snippet still exists in the chat content.
* **NFR-5**: The extension must not break or disrupt ChatGPT’s own UI interactions (no interfering event handlers; minimal DOM mutation).
* **NFR-6**: The extension should be robust to minor DOM changes and new ChatGPT layouts (relying primarily on text-based anchoring).

### 8.3 Compatibility

* **NFR-7**: Works on latest stable Chrome on macOS, Windows, and Linux.
* **NFR-8**: Behavior on Chrome-based browsers (Edge, Brave) is best-effort; Side Panel availability may differ and should gracefully fall back (e.g., to a normal tab UI) where needed.

### 8.4 Accessibility

* **NFR-9**: All primary actions (bookmarking, navigation, search) must be usable via keyboard alone.
* **NFR-10**: Highlight colors and side panel UI should meet basic contrast guidelines.
* **NFR-11**: Motion (e.g., smooth scrolling) should respect reduced motion preferences where possible.

---

## 9. Technical Approach (High Level)

### 9.1 Platform & APIs

* Manifest V3 extension.
* Key Chrome APIs:

  * `sidePanel` – review UI.
  * `contextMenus` – right-click bookmark entry.
  * `scripting` – dynamic injection of content scripts/styles.
  * Background service worker – central orchestrator.
  * `storage` – settings & small state.
  * IndexedDB – bookmark store.
  * Optional `offscreen` – rendering tasks if needed.

### 9.2 Core Patterns

* **Anchoring:**
  Save Web Annotation–style TextQuote and TextPosition selectors plus message identity and DOM hints; on revisit, run a re-anchoring algorithm with fuzzy matching.

* **Highlighting:**
  Use CSS Custom Highlight API with Ranges for visual marking without altering DOM structure.

* **Lazy loading:**
  Programmatically scroll to trigger older messages loading until the snippet is found or a configured budget is exhausted.

* **Service worker:**
  Keep heavy work (indexing, searching) within UI contexts (side panel/options); service worker handles messaging and simple storage operations.

---

## 10. Security & Privacy

* No external network calls.
* All data stored locally in IndexedDB.
* Clear messaging in Options page about:

  * What is stored.
  * That storage is local-only.
* Ability to:

  * Delete all data.

Future (not v1): optional local passphrase-based encryption at rest (trade-off: limited search over encrypted data).

---

## 11. Metrics & Success Criteria

### 11.1 Leading indicators

(If local-only, these may be manual/user-reported.)

* Number of bookmarks created per active user per week.
* Number of bookmarks opened per user per week.
* Ratio of successful re-anchors vs approximate/orphaned.

### 11.2 Qualitative

* User feedback:

  * “I don’t lose important ChatGPT snippets anymore.”
  * “I can actually navigate my old chats efficiently now.”
* Reduced need for external note-taking for ChatGPT responses.

### 11.3 Hard success criteria for v1

* At least 95% of non-edited snippets re-anchor correctly during internal validation.
* Minimal reports of UI breakage on ChatGPT.

---

## 12. Rollout Plan

1. **Dev / internal alpha**

   * Basic capture, list, and re-anchoring.
  * Hands-on validation across multiple long chats.

2. **Private beta**

  * Invite a small set of power users.
  * Collect UX and reliability feedback.
  * Adjust fuzzy matching thresholds and lazy-load behaviors.

3. **Public launch**

   * Publish to Chrome Web Store.
   * Provide clear onboarding:

     * How to bookmark.
     * How to open the side panel.
     * How to back up data.

---
