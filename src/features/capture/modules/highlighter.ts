import { updateScrollMap } from "./scroll_map";

export function clearHighlights() {
	const highlights = document.querySelectorAll(".threadmark-highlight");
	highlights.forEach((el) => {
		unwrapElement(el as HTMLElement);
	});
	updateScrollMap();
}

export function removeHighlight(text: string) {
	if (!text) return;
	const highlights = document.querySelectorAll(".threadmark-highlight");
	highlights.forEach((el) => {
		const content = el.textContent || "";
		if (text.includes(content) || content.includes(text)) {
			unwrapElement(el as HTMLElement);
		}
	});
	updateScrollMap();
}

export function unwrapElement(element: HTMLElement) {
	const parent = element.parentNode;
	if (!parent) return;
	while (element.firstChild) {
		parent.insertBefore(element.firstChild, element);
	}
	parent.removeChild(element);
	parent.normalize();
}

export function findAndHighlight(
	text: string,
	context: { prefix?: string; suffix?: string; occurrence?: number } = {},
	scroll = true,
): boolean {
	if (!text) return false;

	// 1. Try exact match first using the robust finder
	let candidates = findRanges(document.body, text, false, context);

	// 2. If not found, try normalizing whitespace (collapse spaces/newlines)
	if (candidates.length === 0) {
		candidates = findRanges(document.body, text, true, context);
	}

	if (candidates.length === 0) {
		// console.log("WARN: Threadmark: Could not find text to highlight."); // Quiet this down
		return false;
	}

	// If occurrence is specified and valid, prioritize it
	if (context.occurrence !== undefined && candidates[context.occurrence]) {
		const target = candidates[context.occurrence];
		const maxScore = Math.max(...candidates.map((c) => c.score));

		if (target.score >= maxScore || maxScore === 0) {
			candidates = [target];
		}
	}

	// Pick the best candidate based on score
	candidates.sort((a, b) => b.score - a.score);
	const bestMatch = candidates[0];
	const createdSpans = highlightRange(bestMatch.range);

	if (scroll && createdSpans.length > 0) {
		const targetSpan = createdSpans[0];
		targetSpan.scrollIntoView({ behavior: "smooth", block: "center" });
		targetSpan.style.transition = "box-shadow 0.3s";
		targetSpan.style.boxShadow = "0 0 0 4px rgba(255, 215, 0, 0.5)";
		setTimeout(() => {
			targetSpan.style.boxShadow = "none";
		}, 1000);
	}

	// Update scroll map
	setTimeout(updateScrollMap, 100);

	return true;
}

function highlightRange(range: Range): HTMLElement[] {
	const newNode = document.createElement("span");
	newNode.className = "threadmark-highlight";
	newNode.style.backgroundColor = "#ffff0040";
	newNode.style.borderBottom = "2px solid #ffd700";
	newNode.style.borderRadius = "2px";

	try {
		range.surroundContents(newNode);
		return [newNode];
	} catch (_e) {
		const fragment = range.extractContents();
		range.insertNode(fragment);

		const safeWalker = document.createTreeWalker(
			range.commonAncestorContainer,
			NodeFilter.SHOW_TEXT,
			{
				acceptNode: (node) => {
					if (range.intersectsNode(node)) return NodeFilter.FILTER_ACCEPT;
					return NodeFilter.FILTER_REJECT;
				},
			},
		);

		const nodesToWrap: { node: Text; start: number; end: number }[] = [];
		let currentNode: Node | null;
		// biome-ignore lint/suspicious/noAssignInExpressions: standard walker
		while ((currentNode = safeWalker.nextNode())) {
			const textNode = currentNode as Text;
			const start = textNode === range.startContainer ? range.startOffset : 0;
			const end =
				textNode === range.endContainer ? range.endOffset : textNode.length;

			if (end > start) {
				nodesToWrap.push({ node: textNode, start, end });
			}
		}

		const created: HTMLElement[] = [];
		for (const { node, start, end } of nodesToWrap) {
			const rangePart = document.createRange();
			rangePart.setStart(node, start);
			rangePart.setEnd(node, end);
			const span = newNode.cloneNode(false) as HTMLElement;
			rangePart.surroundContents(span);
			created.push(span);
		}
		return created;
	}
}

export function findRanges(
	root: Node,
	targetText: string,
	aggressive = false,
	context: { prefix?: string; suffix?: string } = {},
): { range: Range; score: number }[] {
	const candidates: { range: Range; score: number }[] = [];
	const textNodes: Text[] = [];
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

	// biome-ignore lint/suspicious/noImplicitAnyLet: standard walker
	let node;
	// biome-ignore lint/suspicious/noAssignInExpressions: standard walker
	while ((node = walker.nextNode())) {
		textNodes.push(node as Text);
	}

	// Build a map of global offsets to nodes
	let fullText = "";
	const nodeOffsets: {
		node: Text;
		start: number;
		end: number;
		originalText: string;
	}[] = [];

	for (const tNode of textNodes) {
		const val = tNode.nodeValue || "";
		const currentText = aggressive ? val.replace(/\s+/g, "") : val;

		if (currentText.length > 0) {
			nodeOffsets.push({
				node: tNode,
				start: fullText.length,
				end: fullText.length + currentText.length,
				originalText: val,
			});
			fullText += currentText;
		}
	}

	const searchFor = aggressive ? targetText.replace(/\s+/g, "") : targetText;
	const contextPrefix =
		aggressive && context.prefix
			? context.prefix.replace(/\s+/g, "")
			: context.prefix || "";
	const contextSuffix =
		aggressive && context.suffix
			? context.suffix.replace(/\s+/g, "")
			: context.suffix || "";

	let searchIndex = 0;
	while (true) {
		const matchIndex = fullText.indexOf(searchFor, searchIndex);
		if (matchIndex === -1) break;

		const startInfo = nodeOffsets.find(
			(n) => matchIndex >= n.start && matchIndex < n.end,
		);
		const endIndex = matchIndex + searchFor.length;
		const endInfo = nodeOffsets.find(
			(n) => endIndex - 1 >= n.start && endIndex - 1 < n.end,
		);

		if (startInfo && endInfo) {
			const range = document.createRange();

			const startStrippedOffset = matchIndex - startInfo.start;
			const startRealOffset = aggressive
				? mapStrippedToReal(startInfo.originalText, startStrippedOffset)
				: startStrippedOffset;

			const endStrippedOffset = endIndex - endInfo.start;
			const endRealOffset = aggressive
				? mapStrippedToReal(endInfo.originalText, endStrippedOffset)
				: endStrippedOffset;

			try {
				range.setStart(startInfo.node, startRealOffset);
				range.setEnd(endInfo.node, endRealOffset);

				let score = 0;
				if (contextPrefix) {
					const docPrefix = fullText.substring(
						Math.max(0, matchIndex - contextPrefix.length),
						matchIndex,
					);
					if (docPrefix === contextPrefix) score += 10;
					else if (contextPrefix.endsWith(docPrefix)) score += 5;
				}
				if (contextSuffix) {
					const docSuffix = fullText.substring(
						endIndex,
						endIndex + contextSuffix.length,
					);
					if (docSuffix === contextSuffix) score += 10;
					else if (contextSuffix.startsWith(docSuffix)) score += 5;
				}

				candidates.push({ range, score });
			} catch (_e) {
				console.log("WARN: Threadmark: Range creation error", _e);
			}
		}

		searchIndex = matchIndex + 1;
	}

	return candidates;
}

function mapStrippedToReal(original: string, strippedOffset: number): number {
	let nonSpaceCount = 0;
	for (let i = 0; i < original.length; i++) {
		if (!/\s/.test(original[i])) {
			if (nonSpaceCount === strippedOffset) return i;
			nonSpaceCount++;
		}
	}
	return original.length;
}
