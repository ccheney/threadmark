import {
	getSettings,
	type Settings,
	saveSettings,
} from "../../settings/storage";
import { purgeAllBookmarks, purgePageBookmarks } from "./bookmarks";
import { applyTheme, updateShowAllButton } from "./theme";

export async function initOptionsPanel() {
	const optionsPanel = document.getElementById("options-panel");
	const optionsBtn = document.getElementById("options-toggle-btn");
	const showAllBtn = document.getElementById(
		"show-all-btn",
	) as HTMLButtonElement;
	const autoHighlightCheck = document.getElementById(
		"auto-highlight-check",
	) as HTMLInputElement;
	const themeSelect = document.getElementById(
		"theme-select",
	) as HTMLSelectElement;

	if (optionsPanel && optionsBtn && autoHighlightCheck && themeSelect) {
		// Load initial state
		const settings = await getSettings();

		// FORCE ENABLE Auto-Highlight for now
		autoHighlightCheck.checked = true;
		autoHighlightCheck.disabled = true;
		if (!settings.autoHighlight) {
			await saveSettings({ autoHighlight: true });
		}

		themeSelect.value = settings.theme || "system";

		// Initial button state
		if (showAllBtn) updateShowAllButton(showAllBtn, true);

		applyTheme(settings.theme || "system");

		// Toggle panel
		optionsBtn.addEventListener("click", () => {
			const isHidden = optionsPanel.style.display === "none";
			optionsPanel.style.display = isHidden ? "block" : "none";
		});

		themeSelect.addEventListener("change", async () => {
			const newTheme = themeSelect.value as Settings["theme"];
			await saveSettings({ theme: newTheme });
			applyTheme(newTheme);
		});

		const purgeBtn = document.getElementById("purge-btn");
		if (purgeBtn) {
			purgeBtn.addEventListener("click", purgePageBookmarks);
		}

		const purgeAllBtn = document.getElementById("purge-all-btn");
		if (purgeAllBtn) {
			purgeAllBtn.addEventListener("click", purgeAllBookmarks);
		}
	}
}
