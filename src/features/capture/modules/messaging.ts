import {
	clearHighlights,
	findAndHighlight,
	removeHighlight,
} from "./highlighter";
import {
	addToPendingQueue,
	clearPendingQueue,
	getPendingQueueLength,
	startHighlightObserver,
} from "./observer";

export function initMessageListener() {
	chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
		if (message.type === "HIGHLIGHT_REQUESTED") {
			const { text, prefix, suffix, occurrence } = message.payload;

			const context = { prefix, suffix, occurrence };
			const found = findAndHighlight(text, context, true);

			if (!found) {
				console.log(
					"Threadmark: Highlight not found immediately, adding to retry queue (30s).",
				);
				addToPendingQueue({
					text,
					prefix,
					suffix,
					occurrence,
					expiresAt: Date.now() + 30000, // 30s timeout
					scroll: true, // This was a user request, so scroll to it when found
				});
				startHighlightObserver();
			}

			sendResponse({ success: found });
		} else if (message.type === "HIGHLIGHT_BATCH") {
			const bookmarks = message.payload.bookmarks || [];
			const texts = message.payload.texts || []; // Fallback

			console.log(
				`Threadmark: Received HIGHLIGHT_BATCH with ${bookmarks.length || texts.length} items.`,
			);

			clearHighlights();
			// Clear pending queue on new batch? usually yes
			clearPendingQueue();

			let foundCount = 0;

			if (bookmarks.length > 0) {
				bookmarks.forEach(
					(b: {
						text: string;
						prefix?: string;
						suffix?: string;
						occurrence?: number;
					}) => {
						const context = {
							prefix: b.prefix,
							suffix: b.suffix,
							occurrence: b.occurrence,
						};
						if (findAndHighlight(b.text, context, false)) {
							foundCount++;
						} else {
							// Add to pending
							addToPendingQueue({
								text: b.text,
								...context,
								expiresAt: Date.now() + 30000,
								scroll: false,
							});
						}
					},
				);
			} else {
				texts.forEach((text: string) => {
					if (findAndHighlight(text, {}, false)) {
						foundCount++;
					} else {
						addToPendingQueue({
							text,
							expiresAt: Date.now() + 30000,
							scroll: false,
						});
					}
				});
			}

			if (getPendingQueueLength() > 0) {
				startHighlightObserver();
			}

			sendResponse({ success: true, count: foundCount });
		} else if (message.type === "REMOVE_HIGHLIGHT") {
			const { text } = message.payload;
			console.log("Threadmark: Removing highlight for text:", text);
			removeHighlight(text);
			sendResponse({ success: true });
		}
	});
}
