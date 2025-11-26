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
	autoHighlight: boolean,
) {
	if (autoHighlight) {
		btn.disabled = true;
		btn.style.opacity = "0.5";
		btn.style.cursor = "not-allowed";
		btn.title = "Auto-highlight is enabled";
	} else {
		btn.disabled = false;
		btn.style.opacity = "1";
		btn.style.cursor = "pointer";
		btn.title = "Show all bookmarks on page";
	}
}
