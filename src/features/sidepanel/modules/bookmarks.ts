import { urlsReferToSameThread } from "../../../shared/chatgpt";
import { type Bookmark, initDB, type Thread } from "../../../shared/db";
import { openBookmark } from "./navigation";
import { updateShowAllButton } from "./theme";
import { decodeHtmlEntities, escapeHtml, truncate } from "./utils";

type BookmarkScope = "current" | "library";

let activeScope: BookmarkScope = "current";
let currentThreadTitle = "No chat selected";
let currentTabUrl: string | null = null;
let hasCurrentChatContext = false;
let currentBookmarkCount = 0;
let libraryBookmarkCount = 0;

export async function setBookmarkScope(scope: BookmarkScope) {
	activeScope = scope;
	updateScopeControls();
	await loadBookmarks();
}

export function getBookmarkScope() {
	return activeScope;
}

export async function populateChatFilter(threads: Thread[]) {
	const filterChat = document.getElementById(
		"filter-chat",
	) as HTMLSelectElement;
	if (!filterChat) return;

	const currentVal = filterChat.value;
	while (filterChat.options.length > 1) {
		filterChat.remove(1);
	}

	const sortedThreads = [...threads].sort((a, b) => b.updatedAt - a.updatedAt);

	sortedThreads.forEach((t) => {
		const option = document.createElement("option");
		option.value = t.threadId;
		option.text = truncate(decodeHtmlEntities(t.title || "Untitled chat"), 30);
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
	currentTabUrl = currentTab?.url ?? null;

	const threads = await db.getAll("threads");
	const bookmarks = await db.getAll("bookmarks");

	const activeThreadIds = new Set(bookmarks.map((b) => b.threadId));
	const activeThreads = threads.filter((t) => activeThreadIds.has(t.threadId));

	populateChatFilter(activeThreads);

	const matchedThread = currentTabUrl
		? activeThreads.find(
				(t) =>
					urlsReferToSameThread(currentTabUrl ?? "", t.threadId) ||
					urlsReferToSameThread(currentTabUrl ?? "", t.url),
			)
		: undefined;

	hasCurrentChatContext = Boolean(currentTabUrl?.includes("chatgpt.com"));

	if (matchedThread) {
		currentThreadTitle = decodeHtmlEntities(
			matchedThread.title || "Untitled chat",
		);
	} else if (hasCurrentChatContext) {
		currentThreadTitle = "This chat has no bookmarks";
	} else {
		currentThreadTitle = "Open a ChatGPT conversation";
	}

	refreshBookmarkCounts(bookmarks);
	updateScopeControls();
	loadBookmarks();
}

export async function loadBookmarks(query?: string, forceReload = false) {
	if (forceReload) {
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
	const bookmarks = await db.getAll("bookmarks");
	const threads = await db.getAll("threads");
	const threadMap = new Map<string, Thread>();
	for (const t of threads) {
		threadMap.set(t.threadId, t);
	}

	refreshBookmarkCounts(bookmarks);
	updateScopeControls();

	const dateFilterVal = filterDate ? filterDate.value : "all";
	const chatFilterVal = filterChat ? filterChat.value : "all";
	const now = Date.now();
	const oneDay = 24 * 60 * 60 * 1000;
	const lowerQuery = rawQuery.toLowerCase().trim();

	const filteredBookmarks = bookmarks.filter((bookmark) => {
		if (activeScope === "current") {
			if (
				!currentTabUrl ||
				!urlsReferToSameThread(currentTabUrl, bookmark.threadId)
			) {
				return false;
			}
		} else if (chatFilterVal !== "all" && bookmark.threadId !== chatFilterVal) {
			return false;
		}

		if (lowerQuery) {
			const thread = threadMap.get(bookmark.threadId);
			const threadTitle = thread?.title.toLowerCase() ?? "";
			const matchesQuery =
				bookmark.text.toLowerCase().includes(lowerQuery) ||
				threadTitle.includes(lowerQuery) ||
				(bookmark.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery)) ??
					false);

			if (!matchesQuery) return false;
		}

		if (dateFilterVal !== "all") {
			const age = now - bookmark.createdAt;
			if (dateFilterVal === "today" && age > oneDay) return false;
			if (dateFilterVal === "7days" && age > 7 * oneDay) return false;
			if (dateFilterVal === "30days" && age > 30 * oneDay) return false;
		}

		return true;
	});

	filteredBookmarks.sort((a, b) => b.createdAt - a.createdAt);
	listElement.innerHTML = "";

	if (filteredBookmarks.length === 0) {
		emptyState.hidden = false;
		emptyState.innerText = getEmptyStateMessage(Boolean(lowerQuery));
		return;
	}

	emptyState.hidden = true;
	if (activeScope === "library") {
		renderGroupedBookmarks(filteredBookmarks, threadMap, listElement);
	} else {
		filteredBookmarks.forEach((bookmark) => {
			const thread = threadMap.get(bookmark.threadId);
			listElement.appendChild(renderBookmarkItem(bookmark, thread));
		});
	}
}

function refreshBookmarkCounts(bookmarks: Bookmark[]) {
	libraryBookmarkCount = bookmarks.length;
	currentBookmarkCount = currentTabUrl
		? bookmarks.filter((bookmark) =>
				urlsReferToSameThread(currentTabUrl ?? "", bookmark.threadId),
			).length
		: 0;
}

function updateScopeControls() {
	const currentButton = document.getElementById("scope-current");
	const libraryButton = document.getElementById("scope-library");
	const currentCount = document.getElementById("current-count");
	const libraryCount = document.getElementById("library-count");
	const scopeLabel = document.getElementById("scope-label");
	const scopeHeading = document.getElementById("scope-heading");
	const backToCurrentButton = document.getElementById(
		"back-to-current-btn",
	) as HTMLButtonElement | null;
	const filterChatRow = document.getElementById("filter-chat-row");
	const actionRow = document.querySelector(".action-row") as HTMLElement | null;
	const showAllButton = document.getElementById(
		"show-all-btn",
	) as HTMLButtonElement | null;

	currentButton?.classList.toggle("is-active", activeScope === "current");
	libraryButton?.classList.toggle("is-active", activeScope === "library");
	currentButton?.setAttribute(
		"aria-selected",
		String(activeScope === "current"),
	);
	libraryButton?.setAttribute(
		"aria-selected",
		String(activeScope === "library"),
	);

	if (currentCount) currentCount.textContent = String(currentBookmarkCount);
	if (libraryCount) libraryCount.textContent = String(libraryBookmarkCount);

	if (activeScope === "library") {
		if (scopeLabel) scopeLabel.textContent = "Recent bookmarks";
		if (scopeHeading) {
			scopeHeading.textContent =
				libraryBookmarkCount === 1
					? "1 saved bookmark"
					: `${libraryBookmarkCount} saved bookmarks`;
		}
	} else {
		if (scopeLabel) scopeLabel.textContent = "Current chat";
		if (scopeHeading) scopeHeading.textContent = currentThreadTitle;
	}

	if (backToCurrentButton) {
		backToCurrentButton.hidden =
			activeScope !== "library" || !hasCurrentChatContext;
	}
	if (filterChatRow) {
		filterChatRow.hidden = activeScope === "current";
	}
	if (actionRow) {
		actionRow.hidden = activeScope === "library";
	}
	if (showAllButton) {
		updateShowAllButton(
			showAllButton,
			hasCurrentChatContext && currentBookmarkCount > 0,
		);
	}
}

function getEmptyStateMessage(hasQuery: boolean) {
	if (activeScope === "library") {
		if (libraryBookmarkCount === 0) {
			return "No bookmarks in your library yet. Select text in ChatGPT to save your first one.";
		}
		return hasQuery
			? "No library bookmarks match your search."
			: "No bookmarks match these filters.";
	}

	if (!hasCurrentChatContext) {
		return "Open a ChatGPT conversation to see bookmarks for the current chat.";
	}
	if (currentBookmarkCount === 0) {
		return "No bookmarks in this chat yet. Select text in ChatGPT to save one.";
	}
	return hasQuery
		? "No bookmarks in this chat match your search."
		: "No bookmarks in this chat match these filters.";
}

function renderGroupedBookmarks(
	bookmarks: Bookmark[],
	threadMap: Map<string, Thread>,
	listElement: HTMLElement,
) {
	const groups = new Map<string, Bookmark[]>();
	for (const bookmark of bookmarks) {
		const group = groups.get(bookmark.threadId);
		if (group) {
			group.push(bookmark);
		} else {
			groups.set(bookmark.threadId, [bookmark]);
		}
	}

	const sortedGroups = [...groups.entries()].sort(
		([, a], [, b]) => (b[0]?.createdAt ?? 0) - (a[0]?.createdAt ?? 0),
	);

	for (const [threadId, groupBookmarks] of sortedGroups) {
		const thread = threadMap.get(threadId);
		listElement.appendChild(renderThreadHeading(thread));

		for (const bookmark of groupBookmarks) {
			listElement.appendChild(renderBookmarkItem(bookmark, thread));
		}
	}
}

function renderThreadHeading(thread?: Thread): HTMLElement {
	const li = document.createElement("li");
	li.className = "thread-group-heading";
	li.textContent = decodeHtmlEntities(thread?.title || "Unknown chat");
	return li;
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

	const threadTitle = decodeHtmlEntities(thread?.title || "Unknown chat");
	const tagsHtml =
		bookmark.tags && bookmark.tags.length > 0
			? `<div class="bookmark-tags">${bookmark.tags.map((tag) => `<span class="bookmark-tag">#${escapeHtml(tag)}</span>`).join("")}</div>`
			: "";

	li.innerHTML = `
		<div class="bookmark-content">
			<div class="bookmark-text">${escapeHtml(bookmark.text)}</div>
			${tagsHtml}
			<div class="bookmark-meta">
				<span class="bookmark-thread" title="${escapeHtml(threadTitle)}">${escapeHtml(threadTitle)}</span>
				<span>${dateStr}</span>
			</div>
		</div>
		<div class="bookmark-actions">
			<button class="bookmark-icon-btn open-btn" type="button" title="Open bookmark" aria-label="Open bookmark">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M7 17 17 7"></path>
					<path d="M7 7h10v10"></path>
				</svg>
			</button>
			<button class="bookmark-icon-btn delete-btn" type="button" title="Delete bookmark" aria-label="Delete bookmark">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<polyline points="3 6 5 6 21 6"></polyline>
					<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
				</svg>
			</button>
		</div>
	`;

	li.addEventListener("click", () => openBookmark(bookmark, thread));

	const openBtn = li.querySelector(".open-btn");
	openBtn?.addEventListener("click", (event) => {
		event.stopPropagation();
		openBookmark(bookmark, thread);
	});

	const deleteBtn = li.querySelector(".delete-btn");
	deleteBtn?.addEventListener("click", (event) => {
		event.stopPropagation();
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

	loadBookmarks(undefined, true);
}

export async function purgeAllBookmarks() {
	if (
		!confirm(
			"Delete all bookmarks across all conversations? This action cannot be undone.",
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

	chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
		const currentTab = tabs[0];
		if (currentTab?.id) {
			chrome.tabs.sendMessage(currentTab.id, {
				type: "HIGHLIGHT_BATCH",
				payload: { bookmarks: [] },
			});
		}
	});

	loadBookmarks(undefined, true);
	alert("All bookmarks have been deleted.");
}

export async function purgePageBookmarks() {
	if (
		!confirm(
			"Delete all bookmarks for the current conversation? This action cannot be undone.",
		)
	) {
		return;
	}

	chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
		const currentTab = tabs[0];
		if (!currentTab?.url) {
			alert(
				"Open a ChatGPT conversation before deleting this chat's bookmarks.",
			);
			return;
		}

		const db = await initDB();
		const bookmarks = await db.getAll("bookmarks");
		const relevantBookmarks = bookmarks.filter((bookmark) =>
			urlsReferToSameThread(currentTab.url ?? "", bookmark.threadId),
		);

		if (relevantBookmarks.length === 0) {
			alert("No bookmarks found for this chat.");
			return;
		}

		const tx = db.transaction("bookmarks", "readwrite");
		await Promise.all([
			...relevantBookmarks.map((bookmark) =>
				tx.store.delete(bookmark.bookmarkId),
			),
			tx.done,
		]);

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
