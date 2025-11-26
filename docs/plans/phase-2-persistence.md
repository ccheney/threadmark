# Phase 2 – Local Persistence (IndexedDB) & Data Model

## Milestone 2.1 – IndexedDB Setup & Schema

**Goal:** Have a stable IndexedDB schema for threads and bookmarks.

**Acceptance criteria**

* A database is created for the extension (using whatever library or direct API you choose).
* You can insert a bookmark record via background and retrieve it by ID.
* Basic relationships are in place:

  * Threads table/store.
  * Bookmarks table/store with a `threadId` field.

**Definition of Done**

* Schema includes:

  * `threads` store with fields like `threadId`, `url`, `title`, timestamps.
  * `bookmarks` store with fields like `bookmarkId`, `threadId`, `exactText`, `prefix`, `suffix`, timestamps.
* IndexedDB versioning is handled in one place so you can evolve schema later.
* There is a small internal doc snippet explaining the schema and upgrade strategy.

---

## Milestone 2.2 – Bookmark Save End-to-End

**Goal:** Clicking “Bookmark” actually writes a real bookmark record to IndexedDB.

**Acceptance criteria**

* When you click the bubble:

  * A new bookmark record is created in IndexedDB.
* You can see multiple bookmarks written from one or more chats.
* Basic data in DB matches what you see on screen (text, URL, etc.).

**Definition of Done**

* Background service worker provides a “save bookmark” handler that:

  * Validates required fields.
  * Inserts both `Thread` (if new) and `Bookmark`.
* Content script does not know about DB; it only sends messages.
* Any obvious error paths (e.g., DB unavailable) are at least logged somewhere human-readable.

---

## Milestone 2.3 – Persistent Storage Request

**Goal:** Ask the browser to treat storage as persistent and surface status.

**Acceptance criteria**

* Options page or simple UI shows whether persistent storage has been granted.
* There’s a user-visible control/indicator to re-check or request it again.

**Definition of Done**

* Background or options page calls `navigator.storage.persist()` and `persisted()` from a visible context.
* Result (granted/denied) is stored in settings and displayed somewhere (e.g., “Storage status: Persistent / Not persistent”).
