import { urlsReferToSameThread } from "../../shared/chatgpt";
import { initDB } from "../../shared/db";
import {
	loadBookmarks,
	setBookmarkScope,
	syncSidepanelWithTab,
} from "./modules/bookmarks";
import { initOptionsPanel } from "./modules/options";

document.addEventListener("DOMContentLoaded", async () => {
	// Initialize Options Panel
	await initOptionsPanel();

	// Initial Sync
	await syncSidepanelWithTab();

	// --- Listeners for Tab Changes ---
	chrome.tabs.onActivated.addListener(() => {
		syncSidepanelWithTab();
	});

	chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
		if (changeInfo.status === "complete" && tab.active) {
			syncSidepanelWithTab();
		}
	});

	// --- Global Event Listeners ---

	// Search Input
	const searchInput = document.getElementById(
		"search-input",
	) as HTMLInputElement | null;
	if (searchInput) {
		searchInput.addEventListener("input", (e) => {
			const query = (e.target as HTMLInputElement).value;
			loadBookmarks(query);
		});
	}

	// Filters
	const filterDate = document.getElementById(
		"filter-date",
	) as HTMLSelectElement;
	const filterChat = document.getElementById(
		"filter-chat",
	) as HTMLSelectElement;

	if (filterDate) {
		filterDate.addEventListener("change", () => loadBookmarks());
	}
	if (filterChat) {
		filterChat.addEventListener("change", () => loadBookmarks());
	}

	// Scope Switch
	document
		.getElementById("scope-current")
		?.addEventListener("click", () => setBookmarkScope("current"));
	document
		.getElementById("scope-library")
		?.addEventListener("click", () => setBookmarkScope("library"));
	document
		.getElementById("back-to-current-btn")
		?.addEventListener("click", () => setBookmarkScope("current"));

	// Filter Popover
	const filterPopover = document.getElementById("filter-popover");
	const filterToggleBtn = document.getElementById("filter-toggle-btn");
	if (filterPopover && filterToggleBtn) {
		filterToggleBtn.addEventListener("click", () => {
			filterPopover.hidden = !filterPopover.hidden;
			filterToggleBtn.setAttribute(
				"aria-expanded",
				String(!filterPopover.hidden),
			);
		});
	}

	// Highlight All Button
	document
		.getElementById("show-all-btn")
		?.addEventListener("click", async () => {
			const db = await initDB();
			const bookmarks = await db.getAll("bookmarks");

			// We need current tab URL to filter
			chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
				const currentTab = tabs[0];
				if (!currentTab || !currentTab.url) return;

				const currentUrl = currentTab.url;
				const tabId = currentTab.id;

				// Filter bookmarks for this thread (approx by URL)
				const relevantBookmarks = bookmarks.filter((b) =>
					urlsReferToSameThread(currentUrl, b.threadId),
				);

				if (relevantBookmarks.length > 0 && tabId !== undefined) {
					chrome.tabs.sendMessage(tabId, {
						type: "HIGHLIGHT_BATCH",
						payload: { bookmarks: relevantBookmarks },
					});
				}
			});
		});
});

// Listen for new bookmarks to refresh list automatically
chrome.runtime.onMessage.addListener((message) => {
	if (message.type === "BOOKMARK_SAVED") {
		loadBookmarks(undefined, true);
	}
});
