# Phase 5 – Search, Filters, and Tagging

## Milestone 5.1 – Tag Creation & Assignment

**Goal:** Add tags and see them in the side panel.

**Acceptance criteria**

* When saving a bookmark, you can add one or more tags (e.g., “infra”, “prompt”, “design”).
* Tags are visible on each bookmark row.
* You can edit tags for existing bookmarks.

**Definition of Done**

* `tags` field exists on bookmark records (simple array of strings is fine).
* Side panel provides a minimal tag editor:

  * Add/remove tags.
* A separate tag collection is created only if you want to drive tag suggestions; otherwise free-form is acceptable.

---

## Milestone 5.2 – Search

**Goal:** Search across bookmarks from the side panel.

**Acceptance criteria**

* Side panel has a search input.
* Typing a word filters bookmarks by:

  * Snippet text.
  * Notes.
  * Tags.
* Clearing the search shows all bookmarks again.

**Definition of Done**

* Search logic is implemented in a predictable way:

  * Case-insensitive,
  * Reasonable handling of multiple terms (e.g., simple AND).
* Search performs acceptably with a realistic large set of bookmarks.

---

## Milestone 5.3 – Filters & Sorting

**Goal:** Ability to filter and sort bookmarks for skimming.

**Acceptance criteria**

* You can filter bookmarks by:

  * Chat (select from list of threads).
  * Date range (e.g., simple quick filters: Today, This Week, Older).
* You can sort by:

  * Date created (asc/desc).
* UI shows active filters and lets you clear them.

**Definition of Done**

* Side panel filter UI is wired to data filtering logic.
* Combined search + filters behave sensibly (filters applied on top of search results or vice versa, as long as it’s consistent and intuitive).
* No obviously broken states (e.g., filter claiming results when none are shown).
