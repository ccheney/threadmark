import { initDB, saveBookmark } from "./shared/db";

// Enable side panel on action click
chrome.sidePanel
	.setPanelBehavior({ openPanelOnActionClick: true })
	.catch((error) => console.error(error));

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	console.log("Threadmark: Background received message", message);

	if (message.type === "PING") {
		console.log("Threadmark: Sending PONG.");
		sendResponse({ type: "PONG" });
	} else if (message.type === "GET_BOOKMARKS_FOR_URL") {
		const url = message.url;
		initDB().then(async (db) => {
			const bookmarks = await db.getAll("bookmarks");
			// Filter by threadId (which is currently the URL)
			const matched = bookmarks.filter(
				(b) => url.includes(b.threadId) || b.threadId === url,
			);

			sendResponse({ bookmarks: matched });
		});
		return true; // Async response
	} else if (message.type === "BOOKMARK_REQUESTED") {
		console.log(
			"Threadmark: Background received BOOKMARK_REQUESTED",
			message.payload,
		);

		saveBookmark(message.payload)
			.then((bookmark) => {
				console.log(
					"Threadmark: Bookmark saved successfully:",
					bookmark.bookmarkId,
				);
				// Notify UI to refresh
				chrome.runtime.sendMessage(
					{ type: "BOOKMARK_SAVED", bookmarkId: bookmark.bookmarkId },
					(_response) => {
						if (chrome.runtime.lastError) {
							console.warn(
								"Threadmark: Could not broadcast BOOKMARK_SAVED (no listeners?):",
								chrome.runtime.lastError.message,
							);
						} else {
							console.log("Threadmark: Broadcasted BOOKMARK_SAVED");
						}
					},
				);
				sendResponse({ success: true, bookmarkId: bookmark.bookmarkId });
			})
			.catch((err) => {
				console.error("Threadmark: Failed to save bookmark", err);
				sendResponse({ success: false, error: err.message });
			});

		return true; // Keep channel open for async response
	}
	return true;
});
