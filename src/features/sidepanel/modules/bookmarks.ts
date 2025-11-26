import { type Bookmark, initDB, type Thread } from "../../../shared/db";
import { openBookmark } from "./navigation";
import { decodeHtmlEntities, escapeHtml, truncate } from "./utils";

export async function populateChatFilter(threads: Thread[]) {
	const filterChat = document.getElementById(
		"filter-chat",
	) as HTMLSelectElement;
	if (!filterChat) return;

	// Keep "All Chats"
	const currentVal = filterChat.value;
	// Clear others
	while (filterChat.options.length > 1) {
		filterChat.remove(1);
	}

	// Sort threads by recency
	const sortedThreads = [...threads].sort((a, b) => b.updatedAt - a.updatedAt);

	sortedThreads.forEach((t) => {
		const option = document.createElement("option");
		option.value = t.threadId;
		option.text = truncate(decodeHtmlEntities(t.title || "Untitled Chat"), 30);
		filterChat.add(option);
	});

	filterChat.value = currentVal;
	if (filterChat.selectedIndex === -1) {
		filterChat.value = "all";
	}
}

export async function syncSidepanelWithTab() {
	const db = await initDB();
	const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
	const currentTab = tabs[0];
	const currentUrl = currentTab?.url;

	const threads = await db.getAll("threads");
	const bookmarks = await db.getAll("bookmarks");

	// Filter active threads
	const activeThreadIds = new Set(bookmarks.map((b) => b.threadId));
	const activeThreads = threads.filter((t) => activeThreadIds.has(t.threadId));

	populateChatFilter(activeThreads);

	const filterChat = document.getElementById(
		"filter-chat",
	) as HTMLSelectElement;

	if (currentUrl) {
		// Find thread
		const matchedThread = activeThreads.find(
			(t) => currentUrl.includes(t.url) || t.url === currentUrl,
		);
		if (matchedThread) {
			filterChat.value = matchedThread.threadId;
		} else {
			// No match. User wants to see "nothing" (context awareness).
			const option = document.createElement("option");
			option.value = "__current_empty__";
			option.text = "Current Page (No Bookmarks)";
			filterChat.add(option);
			filterChat.value = "__current_empty__";
		}
	} else {
		filterChat.value = "all";
	}

	loadBookmarks();
}

export async function loadBookmarks(query?: string, forceReload = false) {
	if (forceReload) {
		// We might need to re-sync context if forced
		await syncSidepanelWithTab();
		return;
	}

	const db = await initDB();
	const listElement = document.getElementById("bookmark-list");
	const emptyState = document.getElementById("empty-state");
	const filterDate = document.getElementById(
		"filter-date",
	) as HTMLSelectElement;
	const filterChat = document.getElementById(
		"filter-chat",
	) as HTMLSelectElement;
	const searchInput = document.getElementById(
		"search-input",
	) as HTMLInputElement;

	if (!listElement || !emptyState) {
		console.error("Sidepanel elements not found");
		return;
	}

	const rawQuery = query !== undefined ? query : searchInput?.value || "";

	// Fetch all bookmarks
	const bookmarks = await db.getAll("bookmarks");
	const threads = await db.getAll("threads");

	// Create a map of threadId -> Thread for easy lookup
	const threadMap = new Map<string, Thread>();
	for (const t of threads) {
		threadMap.set(t.threadId, t);
	}

	// Note: We do NOT call populateChatFilter here anymore to avoid resetting context.

	const dateFilterVal = filterDate ? filterDate.value : "all";
	const chatFilterVal = filterChat ? filterChat.value : "all";

	const now = Date.now();
	const oneDay = 24 * 60 * 60 * 1000;

	// Filter
	const lowerQuery = rawQuery.toLowerCase().trim();
	const filteredBookmarks = bookmarks.filter((b) => {
		// 1. Text Search
		let matchesQuery = true;
		if (lowerQuery) {
			const thread = threadMap.get(b.threadId);
			const threadTitle = thread ? thread.title.toLowerCase() : "";
			matchesQuery =
				b.text.toLowerCase().includes(lowerQuery) ||
				threadTitle.includes(lowerQuery) ||
				b.tags?.some((t) => t.toLowerCase().includes(lowerQuery));
		}
		if (!matchesQuery) return false;

		// 2. Chat Filter
		if (chatFilterVal === "__current_empty__") {
			return false; // Explicitly show nothing
		}
		if (chatFilterVal !== "all" && b.threadId !== chatFilterVal) {
			return false;
		}

		// 3. Date Filter
		if (dateFilterVal !== "all") {
			const age = now - b.createdAt;
			if (dateFilterVal === "today" && age > oneDay) return false;
			if (dateFilterVal === "7days" && age > 7 * oneDay) return false;
			if (dateFilterVal === "30days" && age > 30 * oneDay) return false;
		}

		return true;
	});

	// Sort reverse chronological
	filteredBookmarks.sort((a, b) => b.createdAt - a.createdAt);

	listElement.innerHTML = "";

	if (filteredBookmarks.length === 0) {
		emptyState.style.display = "block";
		emptyState.innerText = "No matching bookmarks found.";
		return;
	}
	emptyState.style.display = "none";

	filteredBookmarks.forEach((bookmark) => {
		const thread = threadMap.get(bookmark.threadId);
		const li = renderBookmarkItem(bookmark, thread);
		listElement.appendChild(li);
	});
}

function renderBookmarkItem(bookmark: Bookmark, thread?: Thread): HTMLElement {
	const li = document.createElement("li");
	li.className = "bookmark-item";

	const dateStr = new Date(bookmark.createdAt).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});

	const threadTitle = thread ? thread.title : "Unknown Chat";

	// Render Tags
	const tagsHtml =
		bookmark.tags && bookmark.tags.length > 0
			? `<div style="margin-top: 4px;">${bookmark.tags.map((t) => `<span class="bookmark-tag">#${t}</span>`).join("")}</div>`
			: "";

	li.innerHTML = `
      <div class="bookmark-content" style="flex-grow: 1;">
        <div class="bookmark-text">${escapeHtml(bookmark.text)}</div>
        ${tagsHtml}
        <div class="bookmark-meta">
            <span title="${escapeHtml(threadTitle)}">${truncate(threadTitle, 25)}</span>
            <span>${dateStr}</span>
        </div>
      </div>
      <button class="delete-btn" style="background: none; border: none; cursor: pointer; padding: 4px; color: #999; opacity: 0; transition: opacity 0.2s;" title="Delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>
    `;

	// Hover effect for delete button
	li.style.display = "flex";
	li.style.justifyContent = "space-between";
	li.style.alignItems = "flex-start";
	li.addEventListener("mouseenter", () => {
		const btn = li.querySelector(".delete-btn") as HTMLElement;
		if (btn) btn.style.opacity = "1";
	});
	li.addEventListener("mouseleave", () => {
		const btn = li.querySelector(".delete-btn") as HTMLElement;
		if (btn) btn.style.opacity = "0";
	});

	li.addEventListener("click", () => openBookmark(bookmark, thread));

	const deleteBtn = li.querySelector(".delete-btn");
	deleteBtn?.addEventListener("click", (e) => {
		e.stopPropagation();
		if (confirm("Delete this bookmark?")) {
			deleteBookmark(bookmark.bookmarkId);
		}
	});

	return li;
}

async function deleteBookmark(bookmarkId: string) {
	const db = await initDB();
	const bookmark = await db.get("bookmarks", bookmarkId);

	if (bookmark) {
		await db.delete("bookmarks", bookmarkId);

		// Notify current tab to remove highlight if applicable
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			const currentTab = tabs[0];
			if (currentTab?.id) {
				chrome.tabs.sendMessage(currentTab.id, {
					type: "REMOVE_HIGHLIGHT",
					payload: { text: bookmark.text },
				});
			}
		});
	}

	loadBookmarks(undefined, true); // Refresh list
}

export async function purgeAllBookmarks() {
	if (
		!confirm(
			"Are you sure you want to delete ALL bookmarks across ALL pages? This action cannot be undone.",
		)
	) {
		return;
	}

	const db = await initDB();
	const tx = db.transaction(["bookmarks", "threads"], "readwrite");
	await Promise.all([
		tx.objectStore("bookmarks").clear(),
		tx.objectStore("threads").clear(),
		tx.done,
	]);

	// Notify current tab to remove highlights if applicable
	chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
		const currentTab = tabs[0];
		if (currentTab?.id) {
			chrome.tabs.sendMessage(currentTab.id, {
				type: "HIGHLIGHT_BATCH",
				payload: { bookmarks: [] }, // Clear all
			});
		}
	});

	loadBookmarks(undefined, true);
	alert("All bookmarks have been deleted.");
}

export async function purgePageBookmarks() {
	if (
		!confirm(
			"Are you sure you want to delete all bookmarks for the current conversation?",
		)
	) {
		return;
	}

	chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
		const currentTab = tabs[0];
		if (!currentTab || !currentTab.url) {
			alert("Could not determine current page URL.");
			return;
		}

		const currentUrl = currentTab.url;
		const db = await initDB();
		const bookmarks = await db.getAll("bookmarks");

		// Filter bookmarks for this thread
		const relevantBookmarks = bookmarks.filter(
			(b) => currentUrl.includes(b.threadId) || b.threadId === currentUrl,
		);

		if (relevantBookmarks.length === 0) {
			alert("No bookmarks found for this page.");
			return;
		}

		// Delete them
		const tx = db.transaction("bookmarks", "readwrite");
		await Promise.all([
			...relevantBookmarks.map((b) => tx.store.delete(b.bookmarkId)),
			tx.done,
		]);

		// Clear visual highlights
		if (currentTab.id) {
			chrome.tabs.sendMessage(currentTab.id, {
				type: "HIGHLIGHT_BATCH",
				payload: { bookmarks: [] },
			});
		}

		loadBookmarks(undefined, true);
		alert(`Deleted ${relevantBookmarks.length} bookmarks.`);
	});
}
