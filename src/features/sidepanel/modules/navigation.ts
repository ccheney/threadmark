import type { Bookmark, Thread } from "../../../shared/db";
import { sendMessageWithRetry } from "./utils";

export function openBookmark(bookmark: Bookmark, thread?: Thread) {
	if (!thread || !thread.url) {
		console.error("Cannot open bookmark: missing thread URL");
		return;
	}

	const url = thread.url;

	// Check if tab is already open
	chrome.tabs.query({}, (tabs) => {
		// Simple matching: exact URL or starts with URL
		const existingTab = tabs.find(
			(t) => t.url && (t.url === url || t.url.startsWith(url)),
		);

		if (existingTab?.id !== undefined) {
			const tabId = existingTab.id;
			chrome.tabs.update(tabId, { active: true });
			if (existingTab.windowId) {
				chrome.windows.update(existingTab.windowId, { focused: true });
			}

			// Send highlight request
			// Wait a brief moment for tab switch, use retry
			setTimeout(() => {
				sendMessageWithRetry(tabId, {
					type: "HIGHLIGHT_REQUESTED",
					payload: { text: bookmark.text },
				});
			}, 300);
		} else {
			chrome.tabs.create({ url: url }, (_tab) => {
				// Listener for new tab load would go here in a full implementation
			});
		}
	});
}
