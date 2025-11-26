# Phase 0 – Project Scaffolding & Basic Wiring

## Milestone 0.1 – Extension Skeleton

**Goal:** Have a bare-bones MV3 extension that loads in Chrome and injects a content script into `chatgpt.com`.

**Acceptance criteria**

* Extension appears in `chrome://extensions` and can be loaded in developer mode.
* Content script runs on `https://chatgpt.com/*` pages (verify via console logs).
* Background service worker starts and receives a simple ping from content script.

**Definition of Done**

* Manifest includes:

  * Minimal required extension metadata.
  * MV3 config with background service worker.
  * Permissions for `scripting`, `activeTab`, and host permissions for `chatgpt.com`.
* Content script and background are wired via message passing (basic hello flow).
* A short internal note/docs file exists describing:

  * Folder structure.
  * How to load/unload/reload the extension.
