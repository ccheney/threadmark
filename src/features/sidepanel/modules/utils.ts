export function decodeHtmlEntities(text: string): string {
	const textArea = document.createElement("textarea");
	textArea.innerHTML = text;
	return textArea.value;
}

export function escapeHtml(text: string): string {
	const div = document.createElement("div");
	div.innerText = text;
	return div.innerHTML;
}

export function truncate(str: string, n: number) {
	return str.length > n ? `${str.slice(0, n - 1)}…` : str;
}

export function sendMessageWithRetry(
	tabId: number,
	message: unknown,
	retries = 3,
) {
	chrome.tabs.sendMessage(tabId, message, (_response) => {
		if (chrome.runtime.lastError) {
			if (retries > 0) {
				setTimeout(
					() => sendMessageWithRetry(tabId, message, retries - 1),
					500,
				);
			} else {
				console.log(
					`Threadmark: Could not send highlight message to tab ${tabId}`,
				);
			}
		}
	});
}
