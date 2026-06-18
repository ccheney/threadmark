import { expect, test } from "./fixtures";

test.skip(
	process.env.THREADMARK_REAL_CHATGPT_SMOKE !== "1",
	"Set THREADMARK_REAL_CHATGPT_SMOKE=1 to run against live chatgpt.com.",
);

test("loads the content script on live chatgpt.com", async ({ context }) => {
	const page = await context.newPage();
	const consoleMessages: string[] = [];

	page.on("console", (message) => {
		consoleMessages.push(message.text());
	});

	await page.goto("https://chatgpt.com/", {
		waitUntil: "domcontentloaded",
		timeout: 30_000,
	});

	await expect
		.poll(() =>
			consoleMessages.some((message) =>
				message.includes("Threadmark: Content script loaded"),
			),
		)
		.toBe(true);
});
