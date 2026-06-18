import { expect, test } from "./fixtures";

const chatUrl = "https://chatgpt.com/c/playwright-thread?model=gpt-4o";
const sameThreadUrl = "https://chatgpt.com/c/playwright-thread?temporary=true";
const edgeThreadOneUrl = "https://chatgpt.com/c/playwright-edge-one";
const edgeThreadTwoUrl = "https://chatgpt.com/c/playwright-edge-two";

const chatFixture = `<!doctype html>
<html>
	<head>
		<title>Playwright Chat Fixture</title>
	</head>
	<body>
		<main>
			<div data-testid="conversation-turn" data-message-author-role="assistant">
				<p id="answer">Before important regression answer after.</p>
				<p>Another turn with repeated text for anchoring checks.</p>
			</div>
		</main>
	</body>
</html>`;

const edgeFixtures: Record<string, string> = {
	"/c/playwright-edge-one": `<!doctype html>
<html>
	<head>
		<title>Edge Conversation One</title>
	</head>
	<body>
		<main>
			<div data-message-author-role="assistant">
				<p>Single word target: spigot.</p>
				<p>Symbol-heavy target: C++ && $@ -> /tmp/threadmark [ok].</p>
				<p>Inline <strong>multi-node</strong> answer crosses formatting.</p>
			</div>
		</main>
	</body>
</html>`,
	"/c/playwright-edge-two": `<!doctype html>
<html>
	<head>
		<title>Edge Conversation Two</title>
	</head>
	<body>
		<main>
			<div data-message-author-role="assistant">
				<p>First paragraph closes.</p><p>Second paragraph opens.</p>
				<p>Repeated anchor belongs here.</p>
				<p>Repeated anchor belongs elsewhere.</p>
			</div>
		</main>
	</body>
</html>`,
};

async function selectTextById(
	page: import("@playwright/test").Page,
	id: string,
	text: string,
) {
	await page.evaluate(
		({ id, text }) => {
			const element = document.getElementById(id);
			const node = element?.firstChild;
			if (!node || node.nodeType !== Node.TEXT_NODE || !node.textContent) {
				throw new Error(`Could not select text in #${id}`);
			}

			const start = node.textContent.indexOf(text);
			if (start < 0) throw new Error(`Text not found in #${id}: ${text}`);

			const range = document.createRange();
			range.setStart(node, start);
			range.setEnd(node, start + text.length);

			const selection = window.getSelection();
			selection?.removeAllRanges();
			selection?.addRange(range);

			document.dispatchEvent(
				new MouseEvent("mouseup", { bubbles: true, cancelable: true }),
			);
		},
		{ id, text },
	);
}

async function selectTextInDocument(
	page: import("@playwright/test").Page,
	text: string,
	occurrence = 0,
) {
	await page.evaluate(
		({ occurrence, text }) => {
			const nodes: Text[] = [];
			const walker = document.createTreeWalker(
				document.body,
				NodeFilter.SHOW_TEXT,
			);
			let currentNode = walker.nextNode();

			while (currentNode) {
				nodes.push(currentNode as Text);
				currentNode = walker.nextNode();
			}

			const fullText = nodes.map((node) => node.nodeValue ?? "").join("");
			let start = -1;
			let searchFrom = 0;
			for (let i = 0; i <= occurrence; i++) {
				start = fullText.indexOf(text, searchFrom);
				if (start < 0) throw new Error(`Text not found: ${text}`);
				searchFrom = start + text.length;
			}

			const end = start + text.length;
			let offset = 0;
			let startNode: Text | undefined;
			let endNode: Text | undefined;
			let startOffset = 0;
			let endOffset = 0;

			for (const node of nodes) {
				const nodeLength = node.nodeValue?.length ?? 0;
				const nodeStart = offset;
				const nodeEnd = offset + nodeLength;

				if (!startNode && start >= nodeStart && start <= nodeEnd) {
					startNode = node;
					startOffset = start - nodeStart;
				}

				if (!endNode && end >= nodeStart && end <= nodeEnd) {
					endNode = node;
					endOffset = end - nodeStart;
					break;
				}

				offset = nodeEnd;
			}

			if (!startNode || !endNode) {
				throw new Error(`Could not map text to DOM range: ${text}`);
			}

			const range = document.createRange();
			range.setStart(startNode, startOffset);
			range.setEnd(endNode, endOffset);

			const selection = window.getSelection();
			selection?.removeAllRanges();
			selection?.addRange(range);

			document.dispatchEvent(
				new MouseEvent("mouseup", { bubbles: true, cancelable: true }),
			);
		},
		{ occurrence, text },
	);
}

async function saveSelectedText(
	page: import("@playwright/test").Page,
	text: string,
	tag: string,
	occurrence = 0,
) {
	await selectTextInDocument(page, text, occurrence);
	await expect(page.locator("#threadmark-bubble")).toBeVisible();
	await page.locator("#threadmark-bubble input").fill(tag);
	const saved = await page.evaluate(() => {
		const button = document.querySelector("#threadmark-bubble button");
		button?.dispatchEvent(
			new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
		);
		return Boolean(button);
	});
	expect(saved).toBe(true);
	await expect(page.locator("#threadmark-bubble")).toHaveCount(0);
}

async function highlightedText(page: import("@playwright/test").Page) {
	return page.evaluate(() =>
		Array.from(document.querySelectorAll(".threadmark-highlight"))
			.map((node) => node.textContent ?? "")
			.join(""),
	);
}

test("captures, persists, re-anchors, and reopens a ChatGPT bookmark", async ({
	context,
	extensionId,
}) => {
	await context.route("https://chatgpt.com/**", async (route) => {
		await route.fulfill({
			status: 200,
			contentType: "text/html",
			body: chatFixture,
		});
	});

	const page = await context.newPage();
	const pageMessages: string[] = [];
	page.on("console", (message) => {
		pageMessages.push(message.text());
	});
	await page.goto(chatUrl);

	await expect(
		page.locator("[data-message-author-role='assistant']"),
	).toContainText("important regression answer");

	await selectTextById(page, "answer", "important regression answer");
	await expect(page.locator("#threadmark-bubble")).toBeVisible();
	await page.locator("#threadmark-bubble input").fill("regression, playwright");
	await page.locator("#threadmark-bubble button", { hasText: "Save" }).click();

	await expect(page.locator(".threadmark-highlight")).toContainText(
		"important regression answer",
	);

	const sidepanel = await context.newPage();
	await sidepanel.goto(
		`chrome-extension://${extensionId}/features/sidepanel/sidepanel.html`,
	);

	await page.bringToFront();
	await expect(sidepanel.locator(".bookmark-item")).toContainText(
		"important regression answer",
	);
	await expect(
		sidepanel.locator(".bookmark-tag", { hasText: "#regression" }),
	).toBeVisible();

	await page.goto(sameThreadUrl);
	await expect(page.locator(".threadmark-highlight")).toContainText(
		"important regression answer",
	);

	await page.evaluate(() => {
		for (const highlight of document.querySelectorAll(
			".threadmark-highlight",
		)) {
			const parent = highlight.parentNode;
			if (!parent) continue;
			while (highlight.firstChild) {
				parent.insertBefore(highlight.firstChild, highlight);
			}
			parent.removeChild(highlight);
			parent.normalize();
		}
	});
	await expect(page.locator(".threadmark-highlight")).toHaveCount(0);

	await sidepanel.evaluate(() => {
		return new Promise<void>((resolve, reject) => {
			chrome.tabs.query({}, (tabs) => {
				const chatTab = tabs.find((tab) =>
					tab.url?.includes("/c/playwright-thread"),
				);
				if (!chatTab?.id) {
					reject(new Error("Could not find ChatGPT fixture tab"));
					return;
				}

				chrome.tabs.update(chatTab.id, { active: true }, () => {
					if (chrome.runtime.lastError) {
						reject(new Error(chrome.runtime.lastError.message));
						return;
					}

					resolve();
				});
			});
		});
	});
	const activeTabUrl = await sidepanel.evaluate(() => {
		return new Promise<string | undefined>((resolve) => {
			chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
				resolve(tab?.url);
			});
		});
	});
	expect(activeTabUrl).toContain("/c/playwright-thread");
	const buttonClicked = await sidepanel.evaluate(() => {
		const button = document.getElementById("show-all-btn");
		return (
			button?.dispatchEvent(
				new MouseEvent("click", { bubbles: true, cancelable: true }),
			) ?? false
		);
	});
	expect(buttonClicked).toBe(true);
	await expect
		.poll(() =>
			pageMessages.some((message) => message.includes("HIGHLIGHT_BATCH")),
		)
		.toBe(true);
	await expect(page.locator(".threadmark-highlight")).toContainText(
		"important regression answer",
	);

	await page.evaluate(() => {
		for (const highlight of document.querySelectorAll(
			".threadmark-highlight",
		)) {
			const parent = highlight.parentNode;
			if (!parent) continue;
			while (highlight.firstChild) {
				parent.insertBefore(highlight.firstChild, highlight);
			}
			parent.removeChild(highlight);
			parent.normalize();
		}
	});
	await expect(page.locator(".threadmark-highlight")).toHaveCount(0);

	await sidepanel.locator(".bookmark-item").click();
	await expect(page.locator(".threadmark-highlight")).toContainText(
		"important regression answer",
	);
});

test("captures and re-anchors varied snippets across conversations", async ({
	context,
}) => {
	await context.route("https://chatgpt.com/**", async (route) => {
		const url = new URL(route.request().url());
		const body = edgeFixtures[url.pathname];
		if (!body) {
			await route.fallback();
			return;
		}

		await route.fulfill({
			status: 200,
			contentType: "text/html",
			body,
		});
	});

	const page = await context.newPage();

	await page.goto(edgeThreadOneUrl);
	await saveSelectedText(page, "spigot", "single-word");
	await saveSelectedText(page, "C++ && $@ -> /tmp/threadmark [ok]", "symbols");
	await saveSelectedText(page, "Inline multi-node answer", "inline");

	await expect
		.poll(() => highlightedText(page))
		.toContain(
			"spigotC++ && $@ -> /tmp/threadmark [ok]Inline multi-node answer",
		);

	await page.goto(`${edgeThreadOneUrl}?rehydrate=true`);
	await expect
		.poll(() => highlightedText(page))
		.toContain(
			"spigotC++ && $@ -> /tmp/threadmark [ok]Inline multi-node answer",
		);

	await page.goto(edgeThreadTwoUrl);
	await saveSelectedText(
		page,
		"First paragraph closes.Second paragraph opens.",
		"paragraphs",
	);
	await saveSelectedText(page, "Repeated anchor", "repeated", 1);

	await expect
		.poll(() => highlightedText(page))
		.toContain("First paragraph closes.Second paragraph opens.Repeated anchor");

	await page.goto(`${edgeThreadTwoUrl}?rehydrate=true`);
	await expect
		.poll(() => highlightedText(page))
		.toContain("First paragraph closes.Second paragraph opens.Repeated anchor");
});
