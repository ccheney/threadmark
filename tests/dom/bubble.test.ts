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

describe("capture bubble", () => {
	beforeEach(() => {
		installDom(`
			<main>
				<div data-message-author-role="assistant">
					<p>The selected authenticated ChatGPT text appears here.</p>
				</div>
				<section id="outside">Outside text should not show a bubble.</section>
			</main>
		`);
		initBubbleListener();
	});

	test("appears for selections inside current ChatGPT message markup", () => {
		selectText("[data-message-author-role='assistant']", "authenticated");

		expect(document.querySelector("#threadmark-bubble")).not.toBeNull();
		expect(document.querySelector("#threadmark-bubble")?.textContent).toContain(
			"Save",
		);
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
