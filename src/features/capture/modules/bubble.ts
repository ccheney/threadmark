import { findAndHighlight, findRanges } from "./highlighter";

interface BookmarkCapture {
	text: string;
	prefix: string;
	suffix: string;
	occurrence?: number;
}

interface ToolbarTarget {
	toolbar: HTMLElement;
	referenceButton: HTMLElement;
	referenceChild: HTMLElement;
}

interface LanguageModelSession {
	prompt(
		input: string,
		options?: {
			responseConstraint?: unknown;
			omitResponseConstraintInput?: boolean;
		},
	): Promise<string>;
	destroy?: () => void;
}

interface LanguageModelFactory {
	availability: (options?: unknown) => Promise<string>;
	create: (options?: unknown) => Promise<LanguageModelSession>;
}

interface SummarizerSession {
	summarize(input: string, options?: { context?: string }): Promise<string>;
	destroy?: () => void;
}

interface SummarizerFactory {
	availability: (options?: unknown) => Promise<string>;
	create: (options?: unknown) => Promise<SummarizerSession>;
}

interface BuiltInAiGlobal {
	LanguageModel?: LanguageModelFactory;
	Summarizer?: SummarizerFactory;
}

let fallbackButtonElement: HTMLElement | null = null;
let nativeButtonElement: HTMLElement | null = null;
let tagTrayElement: HTMLElement | null = null;
let toolbarObserver: MutationObserver | null = null;
let fallbackTimer: number | null = null;
let observerStopTimer: number | null = null;
let escapeHandler: ((e: KeyboardEvent) => void) | null = null;

const NATIVE_TOOLBAR_LABELS = ["Ask ChatGPT", "Start writing"];

export function initBubbleListener() {
	document.addEventListener("mouseup", handleSelectionChange);
	document.addEventListener("keyup", handleSelectionChange);
	document.addEventListener("mousedown", handleOutsideClick);
}

function handleSelectionChange(event?: Event) {
	const eventTarget = event?.target;
	if (
		eventTarget instanceof HTMLElement &&
		eventTarget.closest("[data-threadmark-ui='true']")
	) {
		return;
	}

	const selection = window.getSelection();

	if (
		!selection ||
		selection.isCollapsed ||
		selection.toString().trim() === ""
	) {
		removeThreadmarkUi();
		return;
	}

	if (isEditingText()) {
		return;
	}

	const anchorNode = selection.anchorNode;
	if (
		!anchorNode?.parentElement?.closest("article, [data-message-author-role]")
	) {
		removeThreadmarkUi();
		return;
	}

	const text = selection.toString().trim();
	if (text.length === 0) return;

	const capture = createBookmarkCapture(text, selection);
	removeTagTray();
	removeNativeButton();
	removeFallbackButton();
	attachToNativeToolbar(capture);
	watchForNativeToolbar(capture, selection);
}

function handleOutsideClick(event: MouseEvent) {
	const target = event.target as Node;
	if (
		fallbackButtonElement?.contains(target) ||
		nativeButtonElement?.contains(target) ||
		tagTrayElement?.contains(target)
	) {
		return;
	}

	removeTagTray();
	removeFallbackButton();
}

function isEditingText() {
	const activeElement = document.activeElement;
	return (
		activeElement instanceof HTMLInputElement ||
		activeElement instanceof HTMLTextAreaElement ||
		activeElement?.getAttribute("contenteditable") === "true"
	);
}

function watchForNativeToolbar(capture: BookmarkCapture, selection: Selection) {
	stopToolbarObserver();

	toolbarObserver = new MutationObserver(() => {
		if (attachToNativeToolbar(capture)) {
			clearFallbackTimer();
		}
	});

	toolbarObserver.observe(document.body, {
		childList: true,
		subtree: true,
	});

	fallbackTimer = window.setTimeout(() => {
		if (!nativeButtonElement?.isConnected) {
			showFallbackButton(selection, capture);
		}
	}, 350);

	observerStopTimer = window.setTimeout(stopToolbarObserver, 3000);
}

function attachToNativeToolbar(capture: BookmarkCapture) {
	const target = findNativeToolbarTarget();
	if (!target) return false;

	if (nativeButtonElement?.isConnected) {
		return true;
	}

	const button = createNativeThreadmarkButton(target.referenceButton, capture);
	target.referenceChild.insertAdjacentElement("afterend", button);
	nativeButtonElement = button;
	return true;
}

function findNativeToolbarTarget(): ToolbarTarget | null {
	const nativeButtons = Array.from(
		document.querySelectorAll<HTMLElement>("button, [role='button']"),
	).filter((element) => {
		if (element.closest("[data-threadmark-ui='true']")) return false;
		if (!isElementUsable(element)) return false;
		const label = normalizeText(element.textContent ?? "");
		return NATIVE_TOOLBAR_LABELS.some((nativeLabel) =>
			label.includes(nativeLabel.toLowerCase()),
		);
	});

	if (nativeButtons.length === 0) return null;

	const sortedButtons = nativeButtons.sort(
		(a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
	);
	const referenceButton = sortedButtons[sortedButtons.length - 1];
	if (!referenceButton) return null;

	const toolbar =
		findToolbarContainer(nativeButtons) ?? referenceButton.parentElement;
	if (!toolbar || toolbar === document.body) return null;

	const referenceChild =
		getDirectChild(toolbar, referenceButton) ?? referenceButton;

	return {
		toolbar,
		referenceButton,
		referenceChild,
	};
}

function findToolbarContainer(nativeButtons: HTMLElement[]) {
	const commonAncestor =
		nativeButtons.length > 1
			? getCommonAncestor(nativeButtons)
			: nativeButtons[0]?.parentElement;

	let element = commonAncestor;
	while (element && element !== document.body) {
		if (element instanceof HTMLElement && looksLikeToolbar(element)) {
			return element;
		}
		element = element.parentElement;
	}

	return nativeButtons[0]?.parentElement ?? null;
}

function looksLikeToolbar(element: HTMLElement) {
	const text = normalizeText(element.textContent ?? "");
	const labelCount = NATIVE_TOOLBAR_LABELS.filter((label) =>
		text.includes(label.toLowerCase()),
	).length;
	const controlCount = element.querySelectorAll(
		"button, [role='button']",
	).length;
	const rect = element.getBoundingClientRect();
	const height = rect.height || element.offsetHeight;

	return labelCount > 0 && controlCount <= 8 && height < 140;
}

function getCommonAncestor(elements: HTMLElement[]) {
	const [first, ...rest] = elements;
	if (!first) return null;

	let candidate: HTMLElement | null = first;
	while (candidate) {
		if (rest.every((element) => candidate?.contains(element))) {
			return candidate;
		}
		candidate = candidate.parentElement;
	}

	return null;
}

function getDirectChild(parent: HTMLElement, descendant: HTMLElement) {
	let child: HTMLElement | null = descendant;
	while (child?.parentElement && child.parentElement !== parent) {
		child = child.parentElement;
	}

	return child?.parentElement === parent ? child : null;
}

function isElementUsable(element: HTMLElement) {
	const style = window.getComputedStyle(element);
	return (
		element.isConnected &&
		style.display !== "none" &&
		style.visibility !== "hidden" &&
		style.pointerEvents !== "none"
	);
}

function createNativeThreadmarkButton(
	referenceButton: HTMLElement,
	capture: BookmarkCapture,
) {
	const button = document.createElement("button");
	button.id = "threadmark-native-button";
	button.type = "button";
	button.dataset.threadmarkUi = "true";
	button.dataset.threadmarkNativeButton = "true";
	button.title = "Save to Threadmark";
	button.setAttribute("aria-label", "Save to Threadmark");

	if (referenceButton.className) {
		button.className = referenceButton.className;
	}

	Object.assign(button.style, {
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		gap: "7px",
		whiteSpace: "nowrap",
	});

	const badge = document.createElement("span");
	badge.dataset.threadmarkUi = "true";
	badge.setAttribute("aria-hidden", "true");
	Object.assign(badge.style, {
		width: "16px",
		height: "16px",
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		borderRadius: "4px",
		background: "#f2b802",
		color: "#202123",
		fontSize: "10px",
		fontWeight: "800",
		lineHeight: "1",
		boxShadow: "inset 0 0 0 1px rgba(32, 33, 35, 0.18)",
	});
	badge.textContent = "T";

	const label = document.createElement("span");
	label.dataset.threadmarkUi = "true";
	label.textContent = "Threadmark";

	button.replaceChildren(badge, label);
	button.addEventListener("mousedown", (event) => {
		event.preventDefault();
		event.stopPropagation();
		showTagTray(capture, button);
	});
	button.addEventListener("click", (event) => {
		event.preventDefault();
		event.stopPropagation();
		showTagTray(capture, button);
	});

	return button;
}

function showFallbackButton(selection: Selection, capture: BookmarkCapture) {
	if (fallbackButtonElement) removeFallbackButton();

	const range = selection.getRangeAt(0);
	const rect = range.getBoundingClientRect();
	const button = document.createElement("button");
	button.id = "threadmark-bubble";
	button.type = "button";
	button.dataset.threadmarkUi = "true";
	button.title = "Save to Threadmark";
	button.setAttribute("aria-label", "Save to Threadmark");
	Object.assign(button.style, {
		position: "fixed",
		zIndex: "2147483647",
		display: "inline-flex",
		alignItems: "center",
		gap: "7px",
		background: "#202123",
		color: "#ffffff",
		border: "1px solid #565869",
		borderRadius: "10px",
		padding: "8px 11px",
		boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
		fontFamily:
			"Söhne, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif",
		fontSize: "14px",
		fontWeight: "600",
		cursor: "pointer",
	});

	const badge = document.createElement("span");
	badge.textContent = "T";
	Object.assign(badge.style, {
		width: "16px",
		height: "16px",
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		borderRadius: "4px",
		background: "#f2b802",
		color: "#202123",
		fontSize: "10px",
		fontWeight: "800",
	});
	const label = document.createElement("span");
	label.textContent = "Threadmark";
	button.replaceChildren(badge, label);

	const bubbleWidth = 136;
	const bubbleHeight = 40;
	const gap = 10;
	let top = rect.top + rect.height / 2 - bubbleHeight / 2;
	let left = rect.right + gap;

	if (left + bubbleWidth > window.innerWidth) {
		left = rect.left - bubbleWidth - gap;
	}
	if (top < 0) top = 10;
	if (top + bubbleHeight > window.innerHeight) {
		top = window.innerHeight - bubbleHeight - 10;
	}

	button.style.top = `${top}px`;
	button.style.left = `${left}px`;

	button.addEventListener("mousedown", (event) => {
		event.preventDefault();
		event.stopPropagation();
		showTagTray(capture, button);
	});
	button.addEventListener("click", (event) => {
		event.preventDefault();
		event.stopPropagation();
		showTagTray(capture, button);
	});

	document.body.appendChild(button);
	fallbackButtonElement = button;
}

function showTagTray(capture: BookmarkCapture, anchor: HTMLElement) {
	removeTagTray();

	const tray = document.createElement("div");
	tray.id = "threadmark-tag-tray";
	tray.dataset.threadmarkUi = "true";
	tray.setAttribute("role", "dialog");
	tray.setAttribute("aria-label", "Threadmark tags");
	Object.assign(tray.style, {
		position: "fixed",
		zIndex: "2147483647",
		width: "312px",
		boxSizing: "border-box",
		background: "#202123",
		color: "#ffffff",
		border: "1px solid #565869",
		borderRadius: "12px",
		padding: "10px",
		boxShadow: "0 14px 36px rgba(0,0,0,0.35)",
		fontFamily:
			"Söhne, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, sans-serif",
	});

	const selectedTags = new Set<string>();
	const input = document.createElement("input");
	input.type = "text";
	input.placeholder = "Tags, comma separated...";
	Object.assign(input.style, {
		flex: "1",
		minWidth: "0",
		backgroundColor: "#40414f",
		border: "1px solid #565869",
		borderRadius: "8px",
		color: "#fff",
		padding: "8px 10px",
		fontSize: "13px",
		outline: "none",
	});

	const row = document.createElement("div");
	Object.assign(row.style, {
		display: "flex",
		alignItems: "center",
		gap: "8px",
	});

	const saveButton = document.createElement("button");
	saveButton.type = "button";
	saveButton.textContent = "Save";
	Object.assign(saveButton.style, {
		backgroundColor: "#10a37f",
		color: "#fff",
		border: "none",
		borderRadius: "8px",
		padding: "8px 13px",
		fontSize: "13px",
		fontWeight: "700",
		cursor: "pointer",
	});

	const triggerSave = () => {
		saveBookmark(capture, parseTags(input.value));
	};

	input.addEventListener("mousedown", (event) => event.stopPropagation());
	input.addEventListener("keydown", (event) => {
		event.stopPropagation();
		if (event.key === "Enter") {
			triggerSave();
		}
	});
	saveButton.addEventListener("mousedown", (event) => {
		event.preventDefault();
		event.stopPropagation();
	});
	saveButton.addEventListener("click", (event) => {
		event.preventDefault();
		event.stopPropagation();
		triggerSave();
	});

	row.appendChild(input);
	row.appendChild(saveButton);
	tray.appendChild(row);

	document.body.appendChild(tray);
	positionTagTray(tray, anchor);
	tagTrayElement = tray;
	void populateAiTagSuggestions(capture, tray, row, input, selectedTags);
	input.focus();
	installEscapeHandler();
}

function positionTagTray(tray: HTMLElement, anchor: HTMLElement) {
	const anchorRect = anchor.getBoundingClientRect();
	const toolbarRect =
		findNativeToolbarTarget()?.toolbar.getBoundingClientRect() ?? anchorRect;
	const width = 312;
	const gap = 8;

	let left = toolbarRect.right - width;
	let top = toolbarRect.bottom + gap;

	if (left < 10) left = 10;
	if (left + width > window.innerWidth - 10) {
		left = window.innerWidth - width - 10;
	}
	if (top + 90 > window.innerHeight) {
		top = Math.max(10, toolbarRect.top - 98);
	}

	tray.style.left = `${left}px`;
	tray.style.top = `${top}px`;
}

function installEscapeHandler() {
	if (escapeHandler) return;

	escapeHandler = (event: KeyboardEvent) => {
		if (event.key === "Escape") {
			window.getSelection()?.removeAllRanges();
			removeThreadmarkUi();
		}
	};
	document.addEventListener("keydown", escapeHandler);
}

function createBookmarkCapture(
	text: string,
	selection: Selection,
): BookmarkCapture {
	const context = captureContext(selection);
	const occurrence = calculateOccurrenceIndex(text, selection);

	return {
		text,
		prefix: context.prefix,
		suffix: context.suffix,
		occurrence,
	};
}

function saveBookmark(capture: BookmarkCapture, tags: string[] = []) {
	console.log(
		"Threadmark: saveBookmark called. Text length:",
		capture.text.length,
	);

	const payload = {
		text: capture.text,
		prefix: capture.prefix,
		suffix: capture.suffix,
		url: window.location.href,
		title: document.title,
		timestamp: Date.now(),
		occurrence: capture.occurrence,
		tags,
	};

	console.log(
		"Threadmark: Sending BOOKMARK_REQUESTED message with payload:",
		payload,
	);

	findAndHighlight(
		capture.text,
		{
			prefix: capture.prefix,
			suffix: capture.suffix,
			occurrence: capture.occurrence,
		},
		false,
	);

	chrome.runtime.sendMessage(
		{
			type: "BOOKMARK_REQUESTED",
			payload,
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

	removeThreadmarkUi();
}

function calculateOccurrenceIndex(text: string, selection: Selection) {
	try {
		const allMatches = findRanges(document.body, text, false, {});
		if (allMatches.length <= 1) return undefined;

		const selectionRange = selection.getRangeAt(0);
		for (let i = 0; i < allMatches.length; i++) {
			const match = allMatches[i];
			if (!match) continue;
			const matchRange = match.range;
			if (
				matchRange.compareBoundaryPoints(
					Range.START_TO_START,
					selectionRange,
				) === 0
			) {
				return i;
			}
			if (
				matchRange.compareBoundaryPoints(Range.START_TO_END, selectionRange) ===
					-1 &&
				matchRange.compareBoundaryPoints(Range.END_TO_START, selectionRange) ===
					1
			) {
				return i;
			}
		}
	} catch (error) {
		console.error("Threadmark: Error calculating occurrence index:", error);
	}

	return undefined;
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
	} catch (error) {
		console.error("Threadmark: Error capturing context", error);
		return { prefix: "", suffix: "" };
	}
}

async function populateAiTagSuggestions(
	capture: BookmarkCapture,
	tray: HTMLElement,
	insertBefore: HTMLElement,
	input: HTMLInputElement,
	selectedTags: Set<string>,
) {
	const suggestions = await suggestTagsWithBuiltInAi(
		capture.text,
		document.title,
	);
	if (
		suggestions.length === 0 ||
		!tray.isConnected ||
		tagTrayElement !== tray
	) {
		return;
	}

	const chipRow = document.createElement("div");
	chipRow.dataset.threadmarkUi = "true";
	Object.assign(chipRow.style, {
		display: "flex",
		flexWrap: "wrap",
		gap: "6px",
		marginBottom: "8px",
	});

	for (const suggestion of suggestions) {
		chipRow.appendChild(createTagChip(suggestion, input, selectedTags));
	}

	tray.insertBefore(chipRow, insertBefore);
	positionTagTray(tray, nativeButtonElement ?? fallbackButtonElement ?? tray);
}

function createTagChip(
	suggestion: string,
	input: HTMLInputElement,
	selectedTags: Set<string>,
) {
	const chip = document.createElement("button");
	chip.type = "button";
	chip.dataset.threadmarkUi = "true";
	chip.textContent = `#${suggestion}`;
	Object.assign(chip.style, {
		border: "1px solid #565869",
		borderRadius: "999px",
		background: "#2f3038",
		color: "#ececf1",
		padding: "4px 8px",
		fontSize: "12px",
		fontWeight: "600",
		cursor: "pointer",
	});
	chip.addEventListener("mousedown", (event) => {
		event.preventDefault();
		event.stopPropagation();
	});
	chip.addEventListener("click", () => {
		if (selectedTags.has(suggestion)) {
			selectedTags.delete(suggestion);
			chip.style.background = "#2f3038";
			chip.style.borderColor = "#565869";
		} else {
			selectedTags.add(suggestion);
			chip.style.background = "#24483f";
			chip.style.borderColor = "#10a37f";
		}
		input.value = Array.from(selectedTags).join(", ");
		input.focus();
	});

	return chip;
}

async function suggestTagsWithBuiltInAi(text: string, title: string) {
	const promptTags = await suggestTagsWithPromptApi(text, title);
	if (promptTags.length > 0) return promptTags;

	return suggestTagsWithSummarizerApi(text, title);
}

async function suggestTagsWithPromptApi(text: string, title: string) {
	const languageModel = getBuiltInAiGlobal().LanguageModel;
	if (!languageModel) return [];

	const options = {
		expectedInputs: [{ type: "text", languages: ["en"] }],
		expectedOutputs: [{ type: "text", languages: ["en"] }],
	};
	if (!(await isAiModelAvailable(() => languageModel.availability(options)))) {
		return [];
	}

	let session: LanguageModelSession | null = null;
	try {
		session = await languageModel.create();
		const responseConstraint = {
			type: "array",
			minItems: 0,
			maxItems: 4,
			items: {
				type: "string",
			},
		};
		const prompt = [
			"Generate bookmark tags for the highlighted ChatGPT snippet.",
			"Return exactly a JSON array of up to 4 short tag strings.",
			"Prefer concrete nouns, technical terms, named things, and domain phrases.",
			"Avoid generic conversational words, verbs, pronouns, and adverbs.",
			"Use lowercase kebab-case without leading #.",
			`Conversation title: ${title}`,
			`Highlighted snippet: ${text}`,
		].join("\n");

		try {
			const constrainedResponse = await session.prompt(prompt, {
				responseConstraint,
				omitResponseConstraintInput: true,
			});
			return parseAiTags(constrainedResponse);
		} catch {
			const response = await session.prompt(`${prompt}\nReturn JSON only.`);
			return parseAiTags(response);
		}
	} catch (error) {
		console.debug("Threadmark: Prompt API tag suggestions unavailable", error);
		return [];
	} finally {
		session?.destroy?.();
	}
}

async function suggestTagsWithSummarizerApi(text: string, title: string) {
	const summarizerFactory = getBuiltInAiGlobal().Summarizer;
	if (!summarizerFactory) return [];

	const options = {
		type: "key-points",
		format: "plain-text",
		length: "short",
		sharedContext:
			"Generate concise bookmark tag phrases for a highlighted ChatGPT snippet.",
		expectedInputLanguages: ["en-US"],
		outputLanguage: "en-US",
	};
	if (
		!(await isAiModelAvailable(() => summarizerFactory.availability(options)))
	) {
		return [];
	}

	let summarizer: SummarizerSession | null = null;
	try {
		summarizer = await summarizerFactory.create(options);
		const summary = await summarizer.summarize(
			[`Conversation title: ${title}`, "Highlighted snippet:", text].join("\n"),
			{
				context:
					"Return up to 4 concise bookmark tags. Prefer concrete nouns, technical terms, and domain phrases. Avoid generic words.",
			},
		);
		return parseAiTags(summary);
	} catch (error) {
		console.debug(
			"Threadmark: Summarizer API tag suggestions unavailable",
			error,
		);
		return [];
	} finally {
		summarizer?.destroy?.();
	}
}

async function isAiModelAvailable(checkAvailability: () => Promise<string>) {
	try {
		const availability = await checkAvailability();
		return availability !== "unavailable";
	} catch {
		return false;
	}
}

function getBuiltInAiGlobal() {
	return globalThis as BuiltInAiGlobal;
}

function parseAiTags(rawResponse: string) {
	const jsonText = stripCodeFence(rawResponse).trim();
	const parsedTags = parseJsonTags(jsonText);
	if (parsedTags.length > 0) return normalizeAiTags(parsedTags);

	return normalizeAiTags(
		jsonText.split(/[\n,;]+/).map((line) =>
			line
				.replace(/^[-*•\d.\s]+/, "")
				.replace(/^tags?:/i, "")
				.trim(),
		),
	);
}

function parseJsonTags(jsonText: string) {
	try {
		const parsed = JSON.parse(jsonText) as unknown;
		if (Array.isArray(parsed)) {
			return parsed.filter((item): item is string => typeof item === "string");
		}
		if (
			parsed &&
			typeof parsed === "object" &&
			"tags" in parsed &&
			Array.isArray((parsed as { tags: unknown }).tags)
		) {
			return (parsed as { tags: unknown[] }).tags.filter(
				(item): item is string => typeof item === "string",
			);
		}
	} catch {
		return [];
	}

	return [];
}

function normalizeAiTags(tags: string[]) {
	const normalizedTags: string[] = [];
	for (const tag of tags) {
		const normalized = tag
			.toLowerCase()
			.replace(/^#+/, "")
			.replace(/[`"'()[\]{}]/g, "")
			.replace(/&/g, " and ")
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");

		if (
			normalized.length < 2 ||
			normalized.length > 32 ||
			normalizedTags.includes(normalized)
		) {
			continue;
		}

		normalizedTags.push(normalized);
		if (normalizedTags.length === 4) break;
	}

	return normalizedTags;
}

function stripCodeFence(text: string) {
	return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
}

function parseTags(rawTags: string) {
	return rawTags
		.split(",")
		.map((tag) => tag.trim().replace(/^#/, ""))
		.filter(Boolean);
}

function normalizeText(text: string) {
	return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function removeThreadmarkUi() {
	removeTagTray();
	removeNativeButton();
	removeFallbackButton();
	stopToolbarObserver();
	if (escapeHandler) {
		document.removeEventListener("keydown", escapeHandler);
		escapeHandler = null;
	}
}

function removeTagTray() {
	tagTrayElement?.remove();
	tagTrayElement = null;
	if (escapeHandler) {
		document.removeEventListener("keydown", escapeHandler);
		escapeHandler = null;
	}
}

function removeNativeButton() {
	nativeButtonElement?.remove();
	nativeButtonElement = null;
}

function removeFallbackButton() {
	fallbackButtonElement?.remove();
	fallbackButtonElement = null;
}

function clearFallbackTimer() {
	if (fallbackTimer !== null) {
		window.clearTimeout(fallbackTimer);
		fallbackTimer = null;
	}
}

function stopToolbarObserver() {
	clearFallbackTimer();
	if (observerStopTimer !== null) {
		window.clearTimeout(observerStopTimer);
		observerStopTimer = null;
	}
	toolbarObserver?.disconnect();
	toolbarObserver = null;
}
