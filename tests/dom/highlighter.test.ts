import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import {
	clearHighlights,
	findAndHighlight,
	findRanges,
	removeHighlight,
} from "../../src/features/capture/modules/highlighter";

class NoopResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}

function installDom(html: string) {
	const window = new Window({
		url: "https://chatgpt.com/c/highlighter-test",
	});

	window.document.body.innerHTML = html;

	Object.assign(globalThis, {
		document: window.document,
		window,
		Node: window.Node,
		NodeFilter: window.NodeFilter,
		Range: window.Range,
		Text: window.Text,
		HTMLElement: window.HTMLElement,
		ResizeObserver: NoopResizeObserver,
	});
}

describe("highlighter anchoring", () => {
	beforeEach(() => {
		installDom(`
			<main>
				<article>
					<p id="first">Before duplicate answer after.</p>
					<p id="second">Before better duplicate answer after.</p>
				</article>
			</main>
		`);
	});

	test("scores matches with matching prefix and suffix context", () => {
		const candidates = findRanges(document.body, "duplicate answer", false, {
			prefix: "Before ",
			suffix: " after.",
		});

		expect(candidates).toHaveLength(2);
		expect(candidates[0]?.score).toBe(20);
		expect(candidates[1]?.score).toBe(10);
	});

	test("uses occurrence when duplicate text appears multiple times", () => {
		const highlighted = findAndHighlight(
			"duplicate answer",
			{ occurrence: 1 },
			false,
		);

		expect(highlighted).toBe(true);
		expect(
			document.querySelector("#second .threadmark-highlight")?.textContent,
		).toBe("duplicate answer");
		expect(document.querySelector("#first .threadmark-highlight")).toBeNull();
	});

	test("falls back to whitespace-normalized matching", () => {
		installDom(`
			<article>
				<p>The anchored
					answer survives
					layout whitespace.</p>
			</article>
		`);

		const highlighted = findAndHighlight(
			"The anchored answer survives layout whitespace.",
			{},
			false,
		);

		expect(highlighted).toBe(true);
		expect(document.querySelector(".threadmark-highlight")).not.toBeNull();
	});

	test("highlights a single word inside current ChatGPT message markup", () => {
		installDom(`
			<div data-message-author-role="assistant">
				<p>The visible answer calls it a water hose bib.</p>
			</div>
		`);

		expect(findAndHighlight("bib", {}, false)).toBe(true);
		expect(document.querySelector(".threadmark-highlight")?.textContent).toBe(
			"bib",
		);
	});

	test("highlights symbol-heavy snippets exactly", () => {
		installDom(`
			<article>
				<p>Shell symbols: $@, C++, &&, ->, /tmp/threadmark, [ok].</p>
			</article>
		`);

		const text = "$@, C++, &&, ->, /tmp/threadmark, [ok]";

		expect(findAndHighlight(text, {}, false)).toBe(true);
		expect(document.querySelector(".threadmark-highlight")?.textContent).toBe(
			text,
		);
	});

	test("uses context to choose between repeated single-word matches", () => {
		installDom(`
			<div data-message-author-role="assistant">
				<p>First spigot is unrelated.</p>
				<p>The balcony spigot is the one to keep.</p>
				<p>Final spigot is another duplicate.</p>
			</div>
		`);

		expect(
			findAndHighlight(
				"spigot",
				{ prefix: "The balcony ", suffix: " is the one" },
				false,
			),
		).toBe(true);
		expect(
			document.querySelector(".threadmark-highlight")?.parentElement
				?.textContent,
		).toContain("balcony");
	});

	test("highlights text spanning inline formatting nodes", () => {
		installDom(`
			<div data-message-author-role="assistant">
				<p>Inline <strong>multi-node</strong> answer survives markup splits.</p>
			</div>
		`);

		expect(findAndHighlight("Inline multi-node answer", {}, false)).toBe(true);
		expect(
			Array.from(document.querySelectorAll(".threadmark-highlight"))
				.map((node) => node.textContent)
				.join(""),
		).toBe("Inline multi-node answer");
	});

	test("highlights text spanning multiple paragraphs", () => {
		installDom(`
			<div data-message-author-role="assistant"><p>First paragraph closes.</p><p>Second paragraph opens.</p></div>
		`);

		expect(
			findAndHighlight(
				"First paragraph closes.Second paragraph opens.",
				{},
				false,
			),
		).toBe(true);
		expect(document.querySelectorAll(".threadmark-highlight").length).toBe(2);
		expect(
			Array.from(document.querySelectorAll(".threadmark-highlight"))
				.map((node) => node.textContent)
				.join(""),
		).toBe("First paragraph closes.Second paragraph opens.");
	});

	test("clears and removes selected highlights without losing text", () => {
		installDom(`
			<article>
				<p>Keep this exact removable phrase in the document.</p>
			</article>
		`);

		expect(findAndHighlight("removable phrase", {}, false)).toBe(true);
		removeHighlight("removable phrase");
		expect(document.querySelector(".threadmark-highlight")).toBeNull();
		expect(document.body.textContent).toContain("removable phrase");

		expect(findAndHighlight("Keep this exact", {}, false)).toBe(true);
		clearHighlights();
		expect(document.querySelector(".threadmark-highlight")).toBeNull();
		expect(document.body.textContent).toContain("Keep this exact");
	});
});
