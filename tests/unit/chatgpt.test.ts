import { describe, expect, test } from "bun:test";
import {
	getChatGptConversationId,
	getThreadIdForUrl,
	normalizeThreadUrl,
	urlsReferToSameThread,
} from "../../src/shared/chatgpt";

describe("ChatGPT thread identity", () => {
	test("extracts conversation IDs from normal ChatGPT conversation URLs", () => {
		expect(
			getChatGptConversationId("https://chatgpt.com/c/thread-123?model=gpt-4o"),
		).toBe("thread-123");
	});

	test("extracts conversation IDs from nested GPT conversation URLs", () => {
		expect(
			getChatGptConversationId(
				"https://chatgpt.com/g/g-example-name/c/thread-456?foo=bar#frag",
			),
		).toBe("thread-456");
	});

	test("normalizes transient query and hash state", () => {
		expect(
			normalizeThreadUrl(
				"https://chatgpt.com/c/thread-123?model=gpt-4o#latest",
			),
		).toBe("https://chatgpt.com/c/thread-123");
	});

	test("uses a stable thread key for ChatGPT conversations", () => {
		expect(getThreadIdForUrl("https://chatgpt.com/c/thread-123?foo=bar")).toBe(
			"chatgpt:thread-123",
		);
	});

	test("matches new stable IDs with legacy full-URL thread IDs", () => {
		expect(
			urlsReferToSameThread(
				"https://chatgpt.com/c/thread-123?new=query",
				"https://chatgpt.com/c/thread-123?old=query",
			),
		).toBe(true);

		expect(
			urlsReferToSameThread(
				"https://chatgpt.com/c/thread-123",
				"chatgpt:thread-123",
			),
		).toBe(true);
	});
});
