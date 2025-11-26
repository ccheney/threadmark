import { findAndHighlight } from "./highlighter";
import type { PendingHighlight } from "./types";

const pendingQueue: PendingHighlight[] = [];
let highlightObserver: MutationObserver | null = null;
let highlightDebounce: ReturnType<typeof setTimeout> | null = null;

export function addToPendingQueue(item: PendingHighlight) {
	pendingQueue.push(item);
}

export function clearPendingQueue() {
	pendingQueue.length = 0;
}

export function getPendingQueueLength() {
	return pendingQueue.length;
}

export function startHighlightObserver() {
	if (highlightObserver) return;

	console.log("Threadmark: Starting MutationObserver for highlights");
	highlightObserver = new MutationObserver((_mutations) => {
		// Debounce checks to avoid performance hit on rapid changes
		if (highlightDebounce) clearTimeout(highlightDebounce);
		highlightDebounce = setTimeout(() => {
			if (pendingQueue.length > 0) {
				processPendingHighlights();
			}
		}, 500);
	});

	highlightObserver.observe(document.body, {
		childList: true,
		subtree: true,
		characterData: true, // text changes
	});
}

export function processPendingHighlights() {
	if (pendingQueue.length === 0) return;

	const now = Date.now();
	// Filter out expired items
	const validItems = pendingQueue.filter((item) => item.expiresAt > now);
	const expiredCount = pendingQueue.length - validItems.length;
	if (expiredCount > 0) {
		console.log(
			`Threadmark: Pruned ${expiredCount} expired pending highlights.`,
		);
	}

	// Update queue to only valid items
	pendingQueue.length = 0;
	pendingQueue.push(...validItems);

	console.log(
		`Threadmark: Processing ${pendingQueue.length} pending highlights...`,
	);

	// Iterate backwards so we can remove items as we find them
	for (let i = pendingQueue.length - 1; i >= 0; i--) {
		const item = pendingQueue[i];
		const context = {
			prefix: item.prefix,
			suffix: item.suffix,
			occurrence: item.occurrence,
		};

		// Attempt highlight
		if (findAndHighlight(item.text, context, item.scroll)) {
			console.log(
				"Threadmark: Successfully highlighted pending item:",
				item.text.substring(0, 20),
			);
			pendingQueue.splice(i, 1); // Remove from queue
		}
	}

	if (pendingQueue.length === 0) {
		console.log("Threadmark: All pending highlights applied.");
	}
}
