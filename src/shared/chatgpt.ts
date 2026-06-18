const CHATGPT_THREAD_PREFIX = "chatgpt:";

export function getChatGptConversationId(rawUrl: string): string | null {
	try {
		const url = new URL(rawUrl);
		if (!url.hostname.endsWith("chatgpt.com")) return null;

		const segments = url.pathname.split("/").filter(Boolean);
		const conversationMarkerIndex = segments.indexOf("c");
		const conversationId =
			conversationMarkerIndex >= 0
				? segments[conversationMarkerIndex + 1]
				: undefined;

		return conversationId || null;
	} catch {
		return null;
	}
}

export function getThreadIdForUrl(rawUrl: string): string {
	if (rawUrl.startsWith(CHATGPT_THREAD_PREFIX)) return rawUrl;

	const conversationId = getChatGptConversationId(rawUrl);
	if (conversationId) return `${CHATGPT_THREAD_PREFIX}${conversationId}`;

	return normalizeThreadUrl(rawUrl);
}

export function normalizeThreadUrl(rawUrl: string): string {
	try {
		const url = new URL(rawUrl);
		const conversationId = getChatGptConversationId(rawUrl);

		url.hash = "";
		url.search = "";

		if (conversationId) {
			url.pathname = `/c/${conversationId}`;
		}

		return url.toString();
	} catch {
		return rawUrl;
	}
}

export function urlsReferToSameThread(left: string, right: string): boolean {
	return getThreadIdForUrl(left) === getThreadIdForUrl(right);
}
