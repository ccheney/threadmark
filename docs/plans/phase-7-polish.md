# Phase 7 – Extras & Polish

## Milestone 7.1 – Show All Highlights in Chat

**Goal:** See all bookmarks as highlights when viewing a chat.

**Acceptance criteria**

* When you open a chat and toggle “Show highlights”:

  * Every saved snippet from that chat is highlighted.
* Highlights coexist without visually destroying the page.

**Definition of Done**

* On page load or toggle:

  * Extension queries bookmarks by `threadId`.
  * Applies highlights for each snippet.
* It’s clear how to disable this overlay.

---

## Milestone 7.2 – Scroll Map / Gutter Markers

**Goal:** Visual map of where bookmarks are in the chat.

**Acceptance criteria**

* A vertical strip or simple UI on the side shows markers corresponding to bookmark positions.
* Clicking a marker scrolls roughly to that portion of the chat.

**Definition of Done**

* Each bookmark in a chat has a derived `scrollFraction` or similar metric for vertical position.
* Gutter UI converts these to clickable markers.
* Scroll behavior is reasonable and doesn’t fight ChatGPT’s own scrolling.

---

## Milestone 7.3 – Final Cleanup & Self-Review

**Goal:** Make the project maintainable and pleasant to tweak later.

**Acceptance criteria**

* Codebase is understandable when revisited after a gap.
* Obvious dead code or debug-only hacks are removed or clearly flagged.

**Definition of Done**

* Minimal docs:

  * High-level architecture overview.
  * How to add a new feature or field.
* Comments cover any non-obvious anchoring logic or tricky DOM assumptions.
* Manifest, permissions, and host matches are trimmed to only what’s actually needed.
