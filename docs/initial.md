# ChatGPT Bookmarking Chrome Extension – Technical Plan

> **Note:** This is the same plan as before, reformatted as Markdown and with explicit links/references.

---

## 0. One-Page Summary

* **Core user action:**
  Select text inside a ChatGPT conversation on `chatgpt.com`. A lightweight popup appears near the selection. Click **Bookmark** (optionally add tags/notes).

* **How we re-find it later:**
  For each bookmark we store multiple “anchors”:

  * Selected string
  * TextQuote + TextPosition selectors (Web Annotation style) ([W3C][1])
  * Message index + message fingerprint
  * DOM and geometric hints
  * Optional Scroll-to-Text Fragment (`#:~:text=`) deep-link ([GitHub][2])

  When you reopen the chat, the extension re-anchors to the best match, lazy-loads older messages if needed, scrolls to it, and highlights it using the CSS Custom Highlight API. ([MDN Web Docs][3])

* **Where you review bookmarks:**
  A **Chrome Side Panel** UI (plus an Options page) lists all bookmarks, with:

  * Fast search & filters
  * Tags and notes
  * Jump-to-bookmark actions
    (Using `chrome.sidePanel`.) ([Chrome for Developers][4])

* **Storage:**
  Bookmarks are stored in **IndexedDB**, and the extension requests **persistent storage** via `navigator.storage.persist()` and checks `navigator.storage.persisted()` to reduce eviction risk. ([MDN Web Docs][5])

* **Chrome APIs used (Manifest V3):**

  * `chrome.sidePanel` – review UI ([Chrome for Developers][4])
  * `chrome.contextMenus` – “Bookmark selection” in right-click menu ([Chrome for Developers][6])
  * `chrome.scripting` – inject content script / styles dynamically ([Chrome for Developers][7])
  * Background **service worker** – storage, indexing, messaging ([Chrome for Developers][8])
  * `chrome.offscreen` (optional) – offscreen document for DOM-based tasks (e.g., thumbnails) ([Chrome for Developers][9])
  * `chrome.storage` – user settings and light state ([Chrome for Developers][10])

* **Reliability playbook:**

  * Web Annotation-style selectors (TextQuote/TextPosition) ([W3C][1])
  * Fuzzy re-anchoring, inspired by Hypothesis’s fuzzy anchoring ([Hypothesis][11])
  * CSS Custom Highlight API for visual marking ([MDN Web Docs][3])
  * Scroll-to-Text Fragments as an optimization, not a dependency ([TIL Simon Willison][12])

---

## 1. Goals, Constraints, Assumptions

### 1.1 Goals

* Bookmark specific snippets of ChatGPT conversations with minimal friction.
* Make it trivial to get back to the **exact** snippet later.
* Provide a **slick review UI**:

  * Structured search (text, tags, date, source chat)
  * Easy scanning (titles, previews)
  * Batch operations

### 1.2 Constraints & Realities

* ChatGPT conversation UI is a SPA and **lazy-loads** older messages as you scroll.
* DOM structure and CSS classes may change without notice.
* Scroll-to-Text Fragment:

  * Powerful but not guaranteed (depends on visible content, browser support). ([GitHub][2])
* Storage:

  * Even with persistence, data can be evicted under extreme conditions; we must treat persistence as **best effort**, not a guarantee. ([MDN Web Docs][5])

### 1.3 Assumptions

* Primary target is `https://chatgpt.com/*`.
* Local-first; no backend required.
* You’re okay manually exporting/importing for backup.

---

## 2. Architecture Overview (Manifest V3)

### 2.1 Components

1. **Background service worker**

   * Central dispatcher for messages between:

     * Content scripts
     * Side Panel
     * Options page
     * (Optional) offscreen document
   * Handles:

     * Bookmark CRUD in IndexedDB
     * Search index updates
     * Opening/focusing ChatGPT tabs
   * Must respect MV3 service worker lifecycle (short-lived, event-driven). ([Chrome for Developers][8])

2. **Content script (ChatGPT pages)**

  * Runs on `chatgpt.com`.
   * Responsibilities:

     * Detect text selections.
     * Show selection popup UI.
     * Capture all anchor data (TextQuote, TextPosition, message fingerprints, etc.).
     * Handle re-anchoring + on-page highlighting + lazy-scroll.
   * Injected via `chrome.scripting` to keep manifest simple and flexible. ([Chrome for Developers][7])

3. **Side Panel UI**

   * Built using `chrome.sidePanel`. ([Chrome for Developers][4])
   * Host for:

     * Bookmark list, search, filters, bulk actions
     * Quick jump to snippet

4. **Options page**

  * Configuration:

     * Behavior toggles (auto-highlight, etc.)
     * Request persistent storage
     * Debug information

5. **Offscreen document (optional)**

   * Provided by `chrome.offscreen`. ([Chrome for Developers][9])
   * Use cases:

     * DOM-dependent tasks not tied to a visible tab (e.g., rendering a thumbnail image).
   * DOM access only; only `chrome.runtime` API allowed.

---

## 3. User Flows

### 3.1 Saving a Bookmark

1. User selects text in a ChatGPT conversation.

2. Content script detects `window.getSelection()` and:

   * Shows a small **floating bubble** near the selection.

3. User clicks **Bookmark** (or uses context menu / keyboard shortcut).

4. Content script gathers:

   * **Text data:**

     * `exactText` – original selection string.
     * `normalizedText` – case-folded, whitespace-normalized.

   * **Contextual selectors (Web Annotation style):** ([W3C][1])

     * `TextQuoteSelector`:

       * `exact` – selection
       * `prefix` – e.g., up to N chars preceding
       * `suffix` – e.g., up to N chars following
     * `TextPositionSelector`:

       * `start` / `end` offsets inside the **message text** where the selection lives.

   * **Message metadata:**

     * `message.role` – `user` or `assistant`.
     * `message.index` – 0-based index among visible message blocks.
     * `message.fingerprint` – stable hash of **full message text**.

   * **DOM hints:**

     * `domHint.cssPath` – robust, high-level selector for the message container (avoid brittle class chains).

   * **Geometry & scroll hints:**

     * Bounding rect of selection (`top`, `height`, etc.).
     * `scrollTop` and `scrollHeight` at capture time.
     * Derived `scrollFraction = scrollTop/scrollHeight`.

   * **URL & thread data:**

     * Current tab URL (e.g., `https://chatgpt.com/c/<id>`).
     * Current visible chat title (top-left title; fallback to document title).
       Note ChatGPT’s **shared links** feature uses special public URLs; we treat those separately and don’t depend on them for private bookmarks. ([OpenAI Help Center][13])

   * **Optional:**

     * `note` – user-entered note.
     * `tags[]`.
     * `model` – if visible (“GPT-5.1 Thinking”, etc.).
     * `deepLink.textFragment` – a pre-computed `#:~:text=` representation, best effort. ([GitHub][2])

5. Content script sends this payload to the service worker via messaging.

6. Service worker:

   * Stores bookmark in IndexedDB.
   * Updates local search index (if using an in-memory/indexed structure).

7. UI feedback:

   * Toast: “Bookmark saved ✓” with **Undo**.
   * Optional inline highlight via CSS Custom Highlight API. ([MDN Web Docs][3])

### 3.2 Opening a Bookmark (Re-anchoring & Navigation)

From the Side Panel:

1. User clicks a bookmark item.

2. Side Panel asks service worker to:

   * Open / focus a tab at the stored chat URL.

3. Fast path: **Scroll-to-Text Fragment**

   * If we have a `textFragment` string, append `#:~:text=...` to the URL and navigate there. ([TIL Simon Willison][12])
   * If that succeeds (text fragment visible and highlighted by browser), we’re done.

4. If not, run **lazy-load & re-anchor** pipeline:

   1. **Ensure content is loaded:**

      * If the bookmark is likely “far up” (based on `scrollFraction` and message index), programmatically scroll upwards in increments to trigger ChatGPT’s lazy loading, with a max attempt/time budget.

   2. **Locate candidate message:**

      * Search the DOM for a message whose fingerprint matches `message.fingerprint`.
      * Fallback: nearest message by `message.index` if fingerprint fails.

   3. **Apply Web Annotation selectors:** ([W3C][1])

      * Within the identified message text, try:

        * Exact match of `TextQuoteSelector.exact`.
        * Context-aware match with prefix/suffix.
      * If exact fails, use fuzzy matching (see §7).

   4. **DOM hint fallback:**

      * Use `domHint.cssPath` to find the approximate node, then run text search inside it.

5. Once we create a `Range` for the match:

   * Scroll to it (`Range.startContainer`’s element) with a smooth scroll.
   * Use CSS Custom Highlight API to highlight the selection. ([MDN Web Docs][3])

6. Optional:

   * Show a small overlay indicating confidence (“Exact match / High / Medium / Low”).

### 3.3 Reviewing & Managing Bookmarks (Side Panel)

* **List view:**
  Each row shows:

  * First line: snippet preview, with exact selection bolded.
  * Second line: chat title + tags + date.
* **Filters:**

  * By chat (thread).
  * By tag.
  * By date range.
  * By role (user/assistant).
  * By presence of note.
* **Search:**

  * Full-text on:

    * `exactText`, `note`, and `tags`.
  * Fuzzy and prefix matching.
* **Batch operations:**

  * Add/remove tags.
  * Delete.

---

## 4. Data Model

> This is conceptual; treat it as schema, not literal code.

### 4.1 Thread (Chat Conversation)

* `threadId` – canonical ID from URL path, or generated UUID.
* `url` – canonical ChatGPT URL (e.g., `https://chatgpt.com/c/<id>`).
* `title` – latest known title.
* `titleHistory[]` – previous titles (optional).
* `sourceDomain` – `chatgpt.com`.
* `createdAt`, `updatedAt`.

### 4.2 Bookmark

* Identification:

  * `bookmarkId` – UUID.
  * `threadId` – FK to Thread.
  * `createdAt`, `updatedAt`.

* User content:

  * `exactText`
  * `normalizedText` – for search.
  * `note` – free-form note.
  * `tags[]`
  * `model` (optional)

* Anchors:

  * `textQuote` (Web Annotation): ([W3C][1])

    * `exact`
    * `prefix`
    * `suffix`
  * `textPosition`:

    * `start`
    * `end` (offsets within message text)
  * `message`:

    * `role` – `user` / `assistant`
    * `index` – message order at bookmark time
    * `fingerprint` – stable hash of full message text
  * `domHint`:

    * `cssPath` – robust selector to message container
  * `geometry`:

    * `scrollFraction`
    * `selectionRect` → `top`, `height`, `pageHeight`
  * `deepLink`:

    * `textFragment` – Scroll-to-Text Fragment string, best effort ([GitHub][2])

* Diagnostics:

  * `lastAnchorConfidence` – last match confidence score.
  * `history[]` – events (“created”, “updated”, “re-anchored with medium confidence,” etc.).

### 4.3 Tag

* `tagId`
* `name`
* `color` (UI only)
* `createdAt`, `updatedAt`

### 4.4 Settings

* Behavior:

  * `autoHighlightOnLoad`
  * `showSidePanelOnSave`
  * `maxLazyScrollAttempts`
  * `fuzzyMatchStrength`
* Storage:

  * `storage.persisted` – bool
  * `storage.lastPersistCheck` – timestamp ([MDN Web Docs][5])

---

## 5. Storage Design (IndexedDB + Persistent Storage)

### 5.1 Stores & Indexes

* Stores:

  * `threads`, `bookmarks`, `tags`, `settings`, `ftsIndex` (if using a pre-computed text index)
* Example indexes:

  * `bookmarks.byThreadId`
  * `bookmarks.byCreatedAt`
  * `bookmarks.byNormalizedText`
  * `bookmarks.byTags`
  * `bookmarks.byMessageFingerprint`
  * `threads.byTitle`
  * `tags.byName`

### 5.2 Persistent Storage Strategy

* Use `navigator.storage.persisted()` and `navigator.storage.persist()` from a visible page (Side Panel or Options page) to request persistence and report the result to the user. ([MDN Web Docs][5])
* Make it explicit in UI:

  * “Your data is / isn’t protected by persistent storage.”
  * Explain that eviction is still possible, but less likely.

## 6. Robust Anchoring & Re-Anchoring

### 6.1 Selector Stack

1. **TextQuoteSelector** – `exact`, `prefix`, `suffix` ([W3C][1])
2. **TextPositionSelector** – numeric offsets within message text.
3. **Message fingerprint + index** – to narrow the search to a specific message. ([Hypothesis][11])
4. **DOM hint** – CSS selector to message container.
5. **Scroll-to-Text Fragment** – independent deep-link path where supported. ([TIL Simon Willison][12])

### 6.2 Fuzzy Re-Anchoring (Hypothesis-style)

* If exact matching fails, use Hypothesis-like **fuzzy anchoring**: ([Hypothesis][11])

  * Context-first fuzzy:

    * Search around expected start (from `TextPositionSelector`) for `prefix` with fuzzy search.
    * From there, search for `suffix` with fuzzy search.
  * Selector-only fuzzy:

    * Fuzzy search the `exact` text across the message or local area.
  * Compute a confidence score (edit distance, match length, context alignment).

* If confidence < threshold:

  * Offer to show **nearest** match with “low confidence” indicator.

### 6.3 Highlighting (CSS Custom Highlight API)

* Use `CSS Custom Highlight API` + `Highlight`:

  * Create `Highlight` from the resolved `Range`.
  * Register it on `CSS.highlights`.
  * Style via `::highlight(bookmarks-current)` in CSS. ([MDN Web Docs][3])
* Benefits:

  * No DOM mutations (no extra `<span>` elements).
  * Play nicely with ChatGPT’s React/SPA environment.

### 6.4 Lazy-Load Navigation

* When you open a bookmark in an older part of a long chat:

  * Scroll upward in small increments.
  * After each increment:

    * Wait for new messages to load.
    * Attempt re-anchoring.
  * Cap total attempts/time to keep UX responsive.

---

## 7. Full-Text Search & Ranking

* Maintain a lightweight **full-text index** over:

  * `exactText`, `note`, `tags`, and maybe `threadTitle`.
* Features:

  * Tokenization (simple word split).
  * Case-insensitive search.
  * Prefix matching.
  * Optional fuzzy matching (e.g., Levenshtein threshold).
* Ranking signals:

  * Text score (term frequency).
  * Recency.
  * Tag match presence.
  * Thread title match.

Implementation can use any embedded JS FTS approach (no requirement to expose code here).

---

## 8. UI / UX Specification

### 8.1 In-Page Capture UI

* **Selection bubble:**

  * Appears near the highlighted selection.
  * Actions:

    * **Bookmark**
    * **Add/Manage Tags**
    * **Add Note**
    * “Open Side Panel”

* **Context menu:**

  * Add a `chrome.contextMenus` item:

    * “Bookmark selection in ChatGPT”. ([Chrome for Developers][6])

* **Keyboard shortcut:**

  * Chrome `commands` (e.g., `Alt/Option + B`) to bookmark current selection.

* **Feedback:**

  * Toast notification with Undo.

### 8.2 Side Panel UI

Uses Chrome’s Side Panel API. ([Chrome for Developers][4])

* **Header:**

  * Search bar.
  * Quick filter chips: (Today, This Week, Tagged, Has notes).

* **Main list:**

  * Virtualized list for performance.
  * Each row:

    * Snippet (exact selection emphasized).
    * Chat title.
    * Tags.
    * Date/time.

* **Per-bookmark actions:**

  * Open (jump to chat + highlight).
  * Copy text.
  * Copy chat URL.
  * Copy text fragment deep link (if available).
  * Edit (note/tags).
  * Delete.

* **Filters panel:**

  * By thread.
  * By tag.
  * By date range.
  * By role (user/assistant).
  * By model.
  * By text length (e.g., long vs short clips).

* **Batch actions:**

  * Multi-select mode for tags and delete.

* **Settings (gear menu inside Side Panel):**

  * Auto-highlight on page load.
  * Fuzzy match strength.
  * Lazy-load scroll budget.
  * Persistent storage status.

### 8.3 Options Page

* **Storage & backups:**

  * Show whether persistent storage is granted.
  * “Request persistent storage” button (calls `navigator.storage.persist()` w/ explanation). ([MDN Web Docs][5])

* **Shortcuts:**

  * Display Chrome’s current shortcut mapping; instructions on editing them.

* **Advanced:**

  * Toggle offscreen features.
  * Enable debug overlay for re-anchor diagnostics.

### 8.4 Optional On-Page Enhancements

* **Scroll map / gutter markers:**

  * Thin vertical strip showing dots at relative positions of bookmarks in the current chat; click to scroll.

* **“Show my highlights” toggle:**

  * When enabled, highlight all bookmarked snippets in that chat using CSS Custom Highlight API. ([MDN Web Docs][3])

---

## 9. ChatGPT SPA Integration

* **Routing:**

  * Listen for URL changes (History API) to detect when a new chat has loaded.
  * When a chat is entered:

    * Fetch all bookmarks for its `threadId`.
    * Optionally auto-highlight them.

* **Message detection:**

  * Identify message blocks as top-level units (user vs assistant).
  * For each message:

    * Extract plaintext content.
    * Generate fingerprint (hash).
  * Keep structural assumptions minimal; rely primarily on text.

* **Shared links:**

  * ChatGPT shared links create separate, possibly static URLs for shared conversations.
    Use them only when the user explicitly bookmarks from a shared page. ([OpenAI Help Center][13])

---

## 10. Performance, Reliability, Safety

* **Highlighting:**

  * CSS Custom Highlight avoids DOM mutations and plays nicely with large documents. ([MDN Web Docs][3])

* **Storage:**

  * IndexedDB + persistent storage request reduces risk of eviction. ([MDN Web Docs][5])

* **Service worker:**

  * Keep it stateless between events and avoid long-running tasks (move those to Side Panel / Options). ([Chrome for Developers][8])

* **Offscreen document:**

  * Use `chrome.offscreen` only when needed (e.g., thumbnails); obey constraints:

    * Single offscreen document at a time.
    * Only `chrome.runtime` API available. ([Chrome for Developers][9])

* **Storage quota / eviction:**

  * Educate user that persistent storage reduces, but doesn’t eliminate, eviction risk. ([MDN Web Docs][14])

---

## 11. Privacy & Security

* All data remains **local-only** by default.
* No remote telemetry or sync.
* Clear host permissions: restrict to ChatGPT domains.
* User control:

  * Delete all data.
  * Optional encryption-at-rest (passphrase-based, with documented trade-offs for search).

---

## 12. Edge Cases & Heuristics

* **Repeated text:**
  Use combination of message fingerprint, text position, and context to disambiguate. ([W3C][1])

* **Edited or regenerated messages:**
  Fuzzy match `exactText` and context; show low confidence warnings when match is approximate. ([Hypothesis][11])

* **Multi-node selections (spanning elements):**
  Normalize text with consistent whitespace; store per-node offsets if needed for precise Ranges.

* **Code blocks / tables:**
  Treat plain text representation as anchor text; annotate `contentKind` = `code` / `table` for UX.

* **Language / scripts (CJK/RTL):**
  Normalize Unicode (e.g., NFKC), be careful with word boundaries and direction.

* **Orphaned bookmarks:**
  If anchoring fails even after fuzzy search and lazy-load:

  * Mark bookmark as “orphaned” and show it in a special list (Hypothesis does similar). ([Hypothesis][15])

---

## 14. Roadmap

* **v1.0 (MVP)**

  * Selection bubble + context menu + keyboard shortcut.
  * Bookmark storage with TextQuote/TextPosition and message fingerprints.
  * Side Panel with list + basic search/filter.
  * Exact + basic fuzzy re-anchoring.
  * IndexedDB + persistent storage request.

* **v1.1**

  * “Show all highlights” in chat (CSS Custom Highlight).
  * Scroll map/gutter markers.
  * Batch tagging & deletion.

* **v1.2**

  * Optional thumbnails (via offscreen document).
  * Richer diagnostics (confidence scores, debug overlays).

* **v1.3**

  * Optional local encryption at rest.
  * Smart “similar bookmarks in this chat” suggestions.

---

## 15. References

### Chrome Extension APIs

* Chrome Extensions API Reference – Chrome for Developers
  [https://developer.chrome.com/docs/extensions/reference/api](https://developer.chrome.com/docs/extensions/reference/api) ([Chrome for Developers][16])

* Side Panel API – Chrome for Developers
  [https://developer.chrome.com/docs/extensions/reference/api/sidePanel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) ([Chrome for Developers][4])

* “Create a side panel” – Chrome for Developers
  [https://developer.chrome.com/docs/extensions/develop/ui/create-a-side-panel](https://developer.chrome.com/docs/extensions/develop/ui/create-a-side-panel) ([Chrome for Developers][17])

* Context Menus API – Chrome for Developers
  [https://developer.chrome.com/docs/extensions/reference/api/contextMenus](https://developer.chrome.com/docs/extensions/reference/api/contextMenus) ([Chrome for Developers][6])

* Scripting API – Chrome for Developers
  [https://developer.chrome.com/docs/extensions/reference/api/scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting) ([Chrome for Developers][7])

* Storage API – Chrome for Developers
  [https://developer.chrome.com/docs/extensions/reference/api/storage](https://developer.chrome.com/docs/extensions/reference/api/storage) ([Chrome for Developers][10])

* Extension Service Worker Lifecycle – Chrome for Developers
  [https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) ([Chrome for Developers][8])

* “Migrate to a service worker” – Chrome for Developers
  [https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers) ([Chrome for Developers][18])

* Offscreen API – Chrome for Developers
  [https://developer.chrome.com/docs/extensions/reference/api/offscreen](https://developer.chrome.com/docs/extensions/reference/api/offscreen) ([Chrome for Developers][9])

### Web Platform APIs & Storage

* StorageManager: `persist()` – MDN Web Docs
  [https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist) ([MDN Web Docs][5])

* StorageManager: `persisted()` – MDN Web Docs
  [https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persisted](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persisted) ([MDN Web Docs][19])

* StorageManager (overview) – MDN Web Docs
  [https://developer.mozilla.org/en-US/docs/Web/API/StorageManager](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager) ([MDN Web Docs][20])

* Storage quotas and eviction criteria – MDN Web Docs
  [https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) ([MDN Web Docs][14])

* “Storage for the web” – web.dev
  [https://web.dev/articles/storage-for-the-web](https://web.dev/articles/storage-for-the-web) ([web.dev][21])

* “Persistent storage” – web.dev
  [https://web.dev/articles/persistent-storage](https://web.dev/articles/persistent-storage) ([web.dev][22])

* Browser storage limits and eviction criteria – MDN Web Docs
  [https://udn.realityripple.com/docs/Web/API/IndexedDB_API/Browser_storage_limits_and_eviction_criteria](https://udn.realityripple.com/docs/Web/API/IndexedDB_API/Browser_storage_limits_and_eviction_criteria) ([udn.realityripple.com][23])

* Updates to Storage Policy – WebKit blog
  [https://webkit.org/blog/14403/updates-to-storage-policy/](https://webkit.org/blog/14403/updates-to-storage-policy/) ([WebKit][24])

### Text Fragments & Scroll-to-Text

* URL Fragment Text Directives – WICG Spec
  [https://wicg.github.io/scroll-to-text-fragment/](https://wicg.github.io/scroll-to-text-fragment/) ([GitHub][2])

* URL Fragment Text Directives – MDN Web Docs
  [https://developer.mozilla.org/en-US/docs/Web/API/URL_Fragment_Text_Directives](https://developer.mozilla.org/en-US/docs/Web/API/URL_Fragment_Text_Directives) ([MDN Web Docs][25])

* Text fragments – MDN Web Docs
  [https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment/Text_fragments](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment/Text_fragments) ([MDN Web Docs][26])

* “Scroll to text fragments” – Simon Willison TIL
  [https://til.simonwillison.net/html/scroll-to-text](https://til.simonwillison.net/html/scroll-to-text) ([TIL Simon Willison][12])

* “Scroll to Text Fragments” – Jim Nielsen blog
  [https://blog.jim-nielsen.com/2022/scroll-to-text-fragments/](https://blog.jim-nielsen.com/2022/scroll-to-text-fragments/) ([blog.jim-nielsen.com][27])

### CSS Custom Highlight & Highlight API

* CSS Custom Highlight API – MDN Web Docs (Web API)
  [https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API) ([MDN Web Docs][3])

* CSS custom highlight API – MDN Web Docs (CSS guide)
  [https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Custom_highlight_API](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Custom_highlight_API) ([MDN Web Docs][28])

* Highlight interface – MDN Web Docs
  [https://developer.mozilla.org/en-US/docs/Web/API/Highlight](https://developer.mozilla.org/en-US/docs/Web/API/Highlight) ([MDN Web Docs][29])

* “How to Programmatically Highlight Text with the CSS Custom Highlight API” – freeCodeCamp
  [https://www.freecodecamp.org/news/how-to-programmatically-highlight-text-with-the-css-custom-highlight-api/](https://www.freecodecamp.org/news/how-to-programmatically-highlight-text-with-the-css-custom-highlight-api/) ([FreeCodeCamp][30])

### Web Annotation & Hypothesis

* Web Annotation Data Model – W3C Recommendation
  [https://www.w3.org/TR/annotation-model/](https://www.w3.org/TR/annotation-model/) ([W3C][1])

* Web Annotation Working Group – W3C
  [https://www.w3.org/annotation/](https://www.w3.org/annotation/) ([W3C][31])

* Web annotation (overview) – Wikipedia
  [https://en.wikipedia.org/wiki/Web_annotation](https://en.wikipedia.org/wiki/Web_annotation) ([Wikipedia][32])

* “Fuzzy Anchoring” – Hypothesis blog
  [https://web.hypothes.is/blog/fuzzy-anchoring/](https://web.hypothes.is/blog/fuzzy-anchoring/) ([Hypothesis][11])

* “Showing Orphaned Annotations” – Hypothesis blog
  [https://web.hypothes.is/blog/showing-orphaned-annotations/](https://web.hypothes.is/blog/showing-orphaned-annotations/) ([Hypothesis][15])

* `hypothesis/anchoring-test-tools` – GitHub
  [https://github.com/hypothesis/anchoring-test-tools](https://github.com/hypothesis/anchoring-test-tools) ([GitHub][33])

### ChatGPT-Specific

* ChatGPT Shared Links FAQ – OpenAI Help Center
  [https://help.openai.com/en/articles/7925741-chatgpt-shared-links-faq](https://help.openai.com/en/articles/7925741-chatgpt-shared-links-faq) ([OpenAI Help Center][13])

---

If you’d like, I can now turn this into a more PRD-style document (Problem / Goals / Non-Goals / Requirements / Acceptance Criteria) without adding any code.

[1]: https://www.w3.org/TR/annotation-model/?utm_source=chatgpt.com "Web Annotation Data Model"
[2]: https://github.com/WICG/scroll-to-text-fragment?utm_source=chatgpt.com "WICG/scroll-to-text-fragment: Proposal to allow specifying a ..."
[3]: https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API?utm_source=chatgpt.com "CSS Custom Highlight API - MDN Web Docs"
[4]: https://developer.chrome.com/docs/extensions/reference/api/sidePanel?utm_source=chatgpt.com "chrome.sidePanel | API - Chrome for Developers"
[5]: https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist?utm_source=chatgpt.com "StorageManager: persist() method - Web APIs | MDN"
[6]: https://developer.chrome.com/docs/extensions/reference/api/contextMenus?utm_source=chatgpt.com "chrome.contextMenus | API - Chrome for Developers"
[7]: https://developer.chrome.com/docs/extensions/reference/api/scripting?utm_source=chatgpt.com "chrome.scripting | API - Chrome for Developers"
[8]: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle?utm_source=chatgpt.com "The extension service worker lifecycle - Chrome for Developers"
[9]: https://developer.chrome.com/docs/extensions/reference/api/offscreen?utm_source=chatgpt.com "chrome.offscreen | API - Chrome for Developers"
[10]: https://developer.chrome.com/docs/extensions/reference/api/storage?utm_source=chatgpt.com "chrome.storage | API - Chrome for Developers"
[11]: https://web.hypothes.is/blog/fuzzy-anchoring/?utm_source=chatgpt.com "Fuzzy Anchoring - Hypothesis"
[12]: https://til.simonwillison.net/html/scroll-to-text?utm_source=chatgpt.com "Scroll to text fragments | Simon Willison's TILs"
[13]: https://help.openai.com/en/articles/7925741-chatgpt-shared-links-faq?utm_source=chatgpt.com "ChatGPT Shared Links FAQ"
[14]: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria?utm_source=chatgpt.com "Storage quotas and eviction criteria - Web APIs | MDN"
[15]: https://web.hypothes.is/blog/showing-orphaned-annotations/?utm_source=chatgpt.com "Showing Orphaned Annotations - Hypothesis"
[16]: https://developer.chrome.com/docs/extensions/reference/api?utm_source=chatgpt.com "API reference - Chrome for Developers"
[17]: https://developer.chrome.com/docs/extensions/develop/ui/create-a-side-panel?utm_source=chatgpt.com "Create a side panel - Chrome for Developers"
[18]: https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers?utm_source=chatgpt.com "Migrate to a service worker - Chrome for Developers"
[19]: https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persisted?utm_source=chatgpt.com "StorageManager: persisted() method - Web APIs | MDN"
[20]: https://developer.mozilla.org/en-US/docs/Web/API/StorageManager?utm_source=chatgpt.com "StorageManager - Web APIs | MDN"
[21]: https://web.dev/articles/storage-for-the-web?utm_source=chatgpt.com "Storage for the web | Articles"
[22]: https://web.dev/articles/persistent-storage?utm_source=chatgpt.com "Persistent storage | Articles"
[23]: https://udn.realityripple.com/docs/Web/API/IndexedDB_API/Browser_storage_limits_and_eviction_criteria?utm_source=chatgpt.com "Browser storage limits and eviction criteria - Web APIs"
[24]: https://webkit.org/blog/14403/updates-to-storage-policy/?utm_source=chatgpt.com "Updates to Storage Policy"
[25]: https://developer.mozilla.org/en-US/docs/Web/API/URL_Fragment_Text_Directives?utm_source=chatgpt.com "URL Fragment Text Directives - Web APIs | MDN"
[26]: https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment/Text_fragments?utm_source=chatgpt.com "Text fragments - URIs - MDN Web Docs"
[27]: https://blog.jim-nielsen.com/2022/scroll-to-text-fragments/?utm_source=chatgpt.com "Scroll to Text Fragments"
[28]: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Custom_highlight_API?utm_source=chatgpt.com "CSS custom highlight API - MDN Web Docs"
[29]: https://developer.mozilla.org/en-US/docs/Web/API/Highlight?utm_source=chatgpt.com "Highlight - Web APIs - MDN Web Docs - Mozilla"
[30]: https://www.freecodecamp.org/news/how-to-programmatically-highlight-text-with-the-css-custom-highlight-api/?utm_source=chatgpt.com "How to Programmatically Highlight Text with the CSS ..."
[31]: https://www.w3.org/annotation/?utm_source=chatgpt.com "Web Annotation Working Group"
[32]: https://en.wikipedia.org/wiki/Web_annotation?utm_source=chatgpt.com "Web annotation"
[33]: https://github.com/hypothesis/anchoring-test-tools?utm_source=chatgpt.com "hypothesis/anchoring-test-tools"
