import { findAndHighlight, findRanges } from "./highlighter";

let bubbleElement: HTMLElement | null = null;
let escapeHandler: ((e: KeyboardEvent) => void) | null = null;

export function initBubbleListener() {
	document.addEventListener("mouseup", handleSelectionChange);
	document.addEventListener("keyup", handleSelectionChange);
	document.addEventListener("mousedown", handleOutsideClick);
}

function handleSelectionChange() {
	const selection = window.getSelection();

	if (
		!selection ||
		selection.isCollapsed ||
		selection.toString().trim() === ""
	) {
		return;
	}

	const text = selection.toString().trim();
	if (text.length > 0) {
		showBubble(selection, text);
	}
}

function handleOutsideClick(event: MouseEvent) {
	if (bubbleElement && !bubbleElement.contains(event.target as Node)) {
		removeBubble();
	}
}

function showBubble(selection: Selection, text: string) {
	if (bubbleElement) removeBubble();

	const range = selection.getRangeAt(0);
	const rect = range.getBoundingClientRect();

	const bubble = document.createElement("div");
	bubble.id = "threadmark-bubble";
	Object.assign(bubble.style, {
		position: "fixed",
		zIndex: "2147483647",
		backgroundColor: "#202123",
		color: "#ffffff",
		border: "1px solid #565869",
		borderRadius: "6px",
		padding: "6px",
		boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
		fontFamily:
			"Söhne, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif",
		fontSize: "14px",
		display: "flex",
		alignItems: "center",
		gap: "8px",
	});

	const tagInput = document.createElement("input");
	tagInput.type = "text";
	tagInput.placeholder = "Tags (optional)...";
	Object.assign(tagInput.style, {
		backgroundColor: "#40414f",
		border: "1px solid #565869",
		borderRadius: "4px",
		color: "#fff",
		padding: "4px 8px",
		fontSize: "12px",
		outline: "none",
		width: "120px",
	});
	tagInput.addEventListener("mousedown", (e) => e.stopPropagation());
	tagInput.addEventListener("keydown", (e) => {
		e.stopPropagation();
		if (e.key === "Enter") {
			triggerSave();
		}
	});

	const saveBtn = document.createElement("button");
	saveBtn.innerText = "Save";
	Object.assign(saveBtn.style, {
		backgroundColor: "#10a37f",
		color: "#fff",
		border: "none",
		borderRadius: "4px",
		padding: "4px 10px",
		fontSize: "12px",
		fontWeight: "500",
		cursor: "pointer",
	});
	saveBtn.addEventListener("mouseenter", () => {
		saveBtn.style.backgroundColor = "#1a7f64";
	});
	saveBtn.addEventListener("mouseleave", () => {
		saveBtn.style.backgroundColor = "#10a37f";
	});

	const triggerSave = () => {
		const rawTags = tagInput.value.trim();
		const tags = rawTags
			? rawTags
					.split(",")
					.map((t) => t.trim())
					.filter(Boolean)
			: [];
		handleBookmarkClick(text, selection, tags);
	};

	saveBtn.addEventListener("mousedown", (e) => {
		console.log("Threadmark: Save button mousedown");
		e.preventDefault();
		e.stopPropagation();
		triggerSave();
	});

	bubble.appendChild(tagInput);
	bubble.appendChild(saveBtn);

	const bubbleHeight = 45;
	const bubbleWidth = 200;
	const gap = 10;

	let top = rect.top + rect.height / 2 - bubbleHeight / 2;
	let left = rect.right + gap;

	if (left + bubbleWidth > window.innerWidth) {
		left = rect.left - bubbleWidth - gap;
	}

	if (top < 0) top = 10;
	if (top + bubbleHeight > window.innerHeight)
		top = window.innerHeight - bubbleHeight - 10;

	bubble.style.top = `${top}px`;
	bubble.style.left = `${left}px`;

	document.body.appendChild(bubble);
	bubbleElement = bubble;

	// Add escape key listener
	escapeHandler = (e: KeyboardEvent) => {
		if (e.key === "Escape") {
			removeBubble();
		}
	};
	document.addEventListener("keydown", escapeHandler);
}

function removeBubble() {
	if (escapeHandler) {
		document.removeEventListener("keydown", escapeHandler);
		escapeHandler = null;
	}
	if (bubbleElement) {
		bubbleElement.remove();
		bubbleElement = null;
	}
}

function handleBookmarkClick(
	text: string,
	selection: Selection,
	tags: string[] = [],
) {
	console.log(
		"Threadmark: handleBookmarkClick called. Text length:",
		text.length,
	);

	let context: { prefix: string; suffix: string };
	try {
		context = captureContext(selection);
		console.log("Threadmark: Context captured:", context);
	} catch (error) {
		console.error("Threadmark: Error capturing context:", error);
		context = { prefix: "", suffix: "" };
	}

	let occurrenceIndex: number | undefined;
	try {
		const allMatches = findRanges(document.body, text, false, {});
		if (allMatches.length > 1) {
			const selRange = selection.getRangeAt(0);
			for (let i = 0; i < allMatches.length; i++) {
				const m = allMatches[i].range;
				if (m.compareBoundaryPoints(Range.START_TO_START, selRange) === 0) {
					occurrenceIndex = i;
					break;
				}
				if (
					m.compareBoundaryPoints(Range.START_TO_END, selRange) === -1 &&
					m.compareBoundaryPoints(Range.END_TO_START, selRange) === 1
				) {
					occurrenceIndex = i;
					break;
				}
			}
			console.log(
				`Threadmark: Identified occurrence index: ${occurrenceIndex} (of ${allMatches.length})`,
			);
		}
	} catch (e) {
		console.error("Threadmark: Error calculating occurrence index:", e);
	}

	const payload = {
		text: text,
		prefix: context.prefix,
		suffix: context.suffix,
		url: window.location.href,
		title: document.title,
		timestamp: Date.now(),
		occurrence: occurrenceIndex,
		tags: tags,
	};

	console.log(
		"Threadmark: Sending BOOKMARK_REQUESTED message with payload:",
		payload,
	);

	findAndHighlight(text, { ...context, occurrence: occurrenceIndex }, false);

	chrome.runtime.sendMessage(
		{
			type: "BOOKMARK_REQUESTED",
			payload: payload,
		},
		(response) => {
			if (chrome.runtime.lastError) {
				console.error(
					"Threadmark: sendMessage error:",
					chrome.runtime.lastError,
				);
			} else {
				console.log("Threadmark: sendMessage response:", response);
			}
		},
	);
	removeBubble();
}

function captureContext(selection: Selection): {
	prefix: string;
	suffix: string;
} {
	try {
		const range = selection.getRangeAt(0);
		const contextLength = 150;

		let prefix = "";
		const startContainer = range.startContainer;
		if (
			startContainer.nodeType === Node.TEXT_NODE &&
			startContainer.textContent
		) {
			const startOffset = range.startOffset;
			prefix = startContainer.textContent.substring(0, startOffset);
			if (prefix.length > contextLength) {
				prefix = `...${prefix.substring(prefix.length - contextLength)}`;
			}
		}

		let suffix = "";
		const endContainer = range.endContainer;
		if (endContainer.nodeType === Node.TEXT_NODE && endContainer.textContent) {
			const endOffset = range.endOffset;
			suffix = endContainer.textContent.substring(endOffset);
			if (suffix.length > contextLength) {
				suffix = `${suffix.substring(0, contextLength)}...`;
			}
		}

		return { prefix, suffix };
	} catch (e) {
		console.error("Threadmark: Error capturing context", e);
		return { prefix: "", suffix: "" };
	}
}
