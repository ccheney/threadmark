import { urlsReferToSameThread } from "../../../shared/chatgpt";
import type { Bookmark, Thread } from "../../../shared/db";
import { sendMessageWithRetry } from "./utils";

export function openBookmark(bookmark: Bookmark, thread?: Thread) {
	if (!thread || !thread.url) {
		console.error("Cannot open bookmark: missing thread URL");
		return;
	}

	const url = thread.url;
	const highlightMessage = {
		type: "HIGHLIGHT_REQUESTED",
		payload: {
			text: bookmark.text,
			prefix: bookmark.prefix,
			suffix: bookmark.suffix,
			occurrence: bookmark.occurrence,
		},
	};

	// Check if tab is already open
	chrome.tabs.query({}, (tabs) => {
		// Simple matching: exact URL or starts with URL
		const existingTab = tabs.find(
			(t) => t.url && urlsReferToSameThread(t.url, url),
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
				sendMessageWithRetry(tabId, highlightMessage);
			}, 300);
		} else {
			chrome.tabs.create({ url: url }, (tab) => {
				if (tab.id === undefined) return;
				const tabId = tab.id;
				const sendWhenLoaded = (
					updatedTabId: number,
					changeInfo: { status?: string },
				) => {
					if (updatedTabId !== tabId || changeInfo.status !== "complete") {
						return;
					}

					chrome.tabs.onUpdated.removeListener(sendWhenLoaded);
					sendMessageWithRetry(tabId, highlightMessage, 10);
				};

				chrome.tabs.onUpdated.addListener(sendWhenLoaded);
			});
		}
	});
}
