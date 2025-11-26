# Phase 6 – Settings & Persistence

## Milestone 6.1 – Settings UI

**Goal:** Central place to adjust extension behavior and surface storage health.

**Acceptance criteria**

* Options page shows:

  * Storage status (persistent or not).
  * At least one behavior toggle (e.g., auto-highlight on load).
* Changing a setting affects runtime behavior after a reload or reasonable refresh.

**Definition of Done**

* Settings are stored and retrieved from a single source of truth.
* Side panel and content scripts read settings consistently (e.g., via background).
