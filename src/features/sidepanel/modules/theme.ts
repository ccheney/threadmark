import type { Settings } from "../../settings/storage";

export function applyTheme(theme: Settings["theme"]) {
	const body = document.body;

	if (theme === "dark") {
		body.classList.add("theme-dark");
	} else if (theme === "light") {
		body.classList.remove("theme-dark");
	} else {
		// System
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		if (mq.matches) body.classList.add("theme-dark");
		else body.classList.remove("theme-dark");

		mq.onchange = (e) => {
			const currentVal = (
				document.getElementById("theme-select") as HTMLSelectElement
			)?.value;
			if (currentVal === "system") {
				if (e.matches) body.classList.add("theme-dark");
				else body.classList.remove("theme-dark");
			}
		};
	}
}

export function updateShowAllButton(
	btn: HTMLButtonElement,
	hasCurrentBookmarks: boolean,
) {
	btn.textContent = "Highlight all";

	if (hasCurrentBookmarks) {
		btn.disabled = false;
		btn.title = "Highlight all bookmarks in this chat";
	} else {
		btn.disabled = true;
		btn.title = "No bookmarks in the current chat";
	}
}
