# Threadmark Data Model & Persistence

## Storage Strategy
We use **IndexedDB** (via the `idb` library wrapper) for storing local data. This allows for structured storage of threads and bookmarks, capable of handling larger datasets than `chrome.storage.local`.

## Schema (Version 1)

### `threads` Store
Stores metadata about a conversation (chat).
*   **Key:** `threadId` (string) - Currently the URL of the chat.
*   **Indexes:** 
    *   `by-url` (for future flexibility if threadId != url)

| Field | Type | Description |
| :--- | :--- | :--- |
| `threadId` | string | Unique ID for the thread. |
| `url` | string | The URL where the thread was accessed. |
| `title` | string | Title of the chat (from document.title). |
| `createdAt` | number | Timestamp of first bookmark in this thread. |
| `updatedAt` | number | Timestamp of last activity. |

### `bookmarks` Store
Stores individual saved text selections.
*   **Key:** `bookmarkId` (string) - UUID.
*   **Indexes:**
    *   `by-threadId` (to list all bookmarks for a thread)

| Field | Type | Description |
| :--- | :--- | :--- |
| `bookmarkId` | string | Unique UUID. |
| `threadId` | string | Foreign key linking to `threads` store. |
| `text` | string | The exact text selected. |
| `prefix` | string | Context text immediately preceding the selection (up to 150 chars). |
| `suffix` | string | Context text immediately following the selection (up to 150 chars). |
| `createdAt` | number | Timestamp when saved. |

## Database Upgrades
The `initDB` function in `src/db.ts` handles schema upgrades. Increment `DB_VERSION` and add logic to the `upgrade` callback when modifying the schema.
