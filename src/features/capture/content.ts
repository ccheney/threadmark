import type { Bookmark } from "../../shared/db";
import type { Settings } from "../settings/storage";
import { initBubbleListener } from "./modules/bubble";
import { initMessageListener } from "./modules/messaging";
import {
	addToPendingQueue,
	processPendingHighlights,
	startHighlightObserver,
} from "./modules/observer";

declare global {
	interface Window {
		find(
			aString?: string,
			aCaseSensitive?: boolean,
			aBackwards?: boolean,
			aWrapAround?: boolean,
			aWholeWord?: boolean,
			aSearchInFrames?: boolean,
			aShowDialog?: boolean,
		): boolean;
	}
}

console.log(
	"%c Threadmark: Content script loaded on ChatGPT. ",
	"background: #222; color: #bada55",
);

// --- Initialization ---

// Initialize Modules
initBubbleListener();
initMessageListener();

// Basic Hello Flow
chrome.runtime.sendMessage({ type: "PING" }, (response: unknown) => {
	if (chrome.runtime.lastError) {
		console.error(
			"Threadmark: Connection error:",
			chrome.runtime.lastError.message,
		);
		return;
	}

	if (
		response &&
		typeof response === "object" &&
		(response as { type: string }).type === "PONG"
	) {
		console.log(
			"Threadmark: Received PONG from background script. Connection established.",
		);

		console.log("Threadmark: Checking auto-highlight setting...");
		chrome.storage.local.get("settings", (data: { settings?: Settings }) => {
			if (chrome.runtime.lastError) {
				console.error("Threadmark: Storage error:", chrome.runtime.lastError);
				return;
			}
			console.log("Threadmark: Settings loaded:", data);
			const settings = data.settings || { autoHighlight: true };
			if (settings.autoHighlight !== false) {
				chrome.runtime.sendMessage(
					{ type: "GET_BOOKMARKS_FOR_URL", url: window.location.href },
					(response: { bookmarks?: Bookmark[] }) => {
						if (response?.bookmarks) {
							console.log(
								`Threadmark: Auto-highlighting ${response.bookmarks.length} items.`,
							);

							response.bookmarks.forEach((b: Bookmark) => {
								// Add to pending queue with 30s expiry
								addToPendingQueue({
									text: b.text,
									prefix: b.prefix,
									suffix: b.suffix,
									occurrence: b.occurrence,
									expiresAt: Date.now() + 30000,
									scroll: false,
								});
							});

							// Start observing and processing
							startHighlightObserver();
							processPendingHighlights();
						}
					},
				);
			} else {
				console.log("Threadmark: Auto-highlight disabled by user.");
			}
		});
	} else {
		console.log("WARN: Threadmark: Received unexpected response:", response);
	}
});
