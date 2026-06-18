import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { initBubbleListener } from "../../src/features/capture/modules/bubble";

class NoopResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}

function installDom(html: string) {
	const window = new Window({
		url: "https://chatgpt.com/c/bubble-test",
	});

	window.document.body.innerHTML = html;

	Object.assign(globalThis, {
		document: window.document,
		window,
		Node: window.Node,
		NodeFilter: window.NodeFilter,
		Range: window.Range,
		Selection: window.Selection,
		Text: window.Text,
		HTMLElement: window.HTMLElement,
		HTMLInputElement: window.HTMLInputElement,
		HTMLTextAreaElement: window.HTMLTextAreaElement,
		KeyboardEvent: window.KeyboardEvent,
		MouseEvent: window.MouseEvent,
		ResizeObserver: NoopResizeObserver,
	});
	Reflect.deleteProperty(globalThis, "LanguageModel");
	Reflect.deleteProperty(globalThis, "Summarizer");

	if (!window.Range.prototype.getBoundingClientRect) {
		window.Range.prototype.getBoundingClientRect = () =>
			new window.DOMRect(10, 10, 70, 10);
	}
}

function selectText(selector: string, selectedText: string) {
	const element = document.querySelector(selector);
	const walker = document.createTreeWalker(
		element ?? document.body,
		NodeFilter.SHOW_TEXT,
	);
	let currentNode = walker.nextNode();

	while (currentNode) {
		const node = currentNode as Text;
		const start = node.textContent?.indexOf(selectedText) ?? -1;
		if (start >= 0) {
			const range = document.createRange();
			range.setStart(node, start);
			range.setEnd(node, start + selectedText.length);
			window.getSelection()?.removeAllRanges();
			window.getSelection()?.addRange(range);
			document.dispatchEvent(
				new MouseEvent("mouseup", { bubbles: true, cancelable: true }),
			);
			return;
		}
		currentNode = walker.nextNode();
	}

	throw new Error(`Could not find text: ${selectedText}`);
}

function installPromptTags(tags: string[]) {
	Object.assign(globalThis, {
		LanguageModel: {
			availability: async () => "available",
			create: async () => ({
				prompt: async () => JSON.stringify(tags),
				destroy: () => {},
			}),
		},
	});
}

function installSummarizerTags(summary: string) {
	Object.assign(globalThis, {
		LanguageModel: {
			availability: async () => "unavailable",
			create: async () => {
				throw new Error("Prompt API should not be used");
			},
		},
		Summarizer: {
			availability: async () => "available",
			create: async () => ({
				summarize: async () => summary,
				destroy: () => {},
			}),
		},
	});
}

async function waitFor(assertion: () => void) {
	const start = Date.now();
	let lastError: unknown;

	while (Date.now() - start < 1000) {
		try {
			assertion();
			return;
		} catch (error) {
			lastError = error;
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
	}

	throw lastError;
}

describe("capture bubble", () => {
	beforeEach(() => {
		installDom(`
			<main>
				<div data-message-author-role="assistant">
					<p>The selected authenticated ChatGPT text appears here.</p>
				</div>
				<div id="chatgpt-selection-toolbar">
					<button type="button">Ask ChatGPT</button>
					<button type="button">Start writing</button>
				</div>
				<section id="outside">Outside text should not show a bubble.</section>
			</main>
		`);
		initBubbleListener();
	});

	test("adds a Threadmark button to ChatGPT's native selection toolbar", () => {
		selectText("[data-message-author-role='assistant']", "authenticated");

		expect(document.querySelector("#threadmark-native-button")).not.toBeNull();
		expect(
			document.querySelector("#chatgpt-selection-toolbar")?.textContent,
		).toContain("Ask ChatGPT");
		expect(
			document.querySelector("#chatgpt-selection-toolbar")?.textContent,
		).toContain("Start writing");
		expect(
			document.querySelector("#chatgpt-selection-toolbar")?.textContent,
		).toContain("Threadmark");
		expect(document.querySelector("#threadmark-bubble")).toBeNull();
	});

	test("opens a compact tag tray without local fallback suggestions", () => {
		selectText("[data-message-author-role='assistant']", "authenticated");

		(
			document.querySelector("#threadmark-native-button") as HTMLButtonElement
		).click();

		expect(document.querySelector("#threadmark-tag-tray")).not.toBeNull();
		expect(
			document.querySelector("#threadmark-tag-tray")?.textContent,
		).toContain("Save");
		expect(
			document.querySelector("#threadmark-tag-tray")?.textContent,
		).not.toContain("#authenticated");
	});

	test("uses the Prompt API for suggested chips", async () => {
		installPromptTags(["hose-bib", "quick-connect", "gas-grill"]);
		selectText("[data-message-author-role='assistant']", "authenticated");

		(
			document.querySelector("#threadmark-native-button") as HTMLButtonElement
		).click();

		await waitFor(() => {
			expect(
				document.querySelector("#threadmark-tag-tray")?.textContent,
			).toContain("#quick-connect");
		});
	});

	test("falls back to the Summarizer API for suggested chips", async () => {
		installSummarizerTags("- hose bib\n- quick connect\n- gas grill");
		selectText("[data-message-author-role='assistant']", "authenticated");

		(
			document.querySelector("#threadmark-native-button") as HTMLButtonElement
		).click();

		await waitFor(() => {
			expect(
				document.querySelector("#threadmark-tag-tray")?.textContent,
			).toContain("#hose-bib");
		});
	});

	test("does not appear for selections outside chat messages", () => {
		selectText("#outside", "Outside");

		expect(document.querySelector("#threadmark-bubble")).toBeNull();
	});

	test("does not appear while editing input text", () => {
		installDom(`
			<div data-message-author-role="assistant">
				<input id="composer" value="selected input text">
			</div>
		`);
		initBubbleListener();
		const input = document.querySelector("#composer") as HTMLInputElement;
		input.focus();
		input.setSelectionRange(0, "selected".length);
		document.dispatchEvent(
			new MouseEvent("mouseup", { bubbles: true, cancelable: true }),
		);

		expect(document.querySelector("#threadmark-bubble")).toBeNull();
	});
});
