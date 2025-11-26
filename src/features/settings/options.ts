import { getSettings, saveSettings } from "./storage";

document.addEventListener("DOMContentLoaded", async () => {
	const statusDiv = document.getElementById("storage-status");
	const btn = document.getElementById("request-persist");
	const autoHighlightCheckbox = document.getElementById(
		"auto-highlight",
	) as HTMLInputElement | null;

	if (!statusDiv || !btn) {
		console.error("Required elements not found in DOM");
		return;
	}

	// Load Settings
	const settings = await getSettings();
	if (autoHighlightCheckbox) {
		autoHighlightCheckbox.checked = settings.autoHighlight;

		autoHighlightCheckbox.addEventListener("change", async () => {
			await saveSettings({ autoHighlight: autoHighlightCheckbox.checked });
			// Optional: notify other parts of the app
		});
	}

	async function checkPersistence() {
		if (navigator.storage?.persisted) {
			const isPersisted = await navigator.storage.persisted();
			updateUI(isPersisted);
		} else {
			if (statusDiv)
				statusDiv.textContent = "Storage persistence API not supported.";
		}
	}

	function updateUI(isPersisted: boolean) {
		if (!statusDiv || !btn) return;
		if (isPersisted) {
			statusDiv.textContent = "Storage is Persistent ✅";
			statusDiv.className = "status granted";
			btn.style.display = "none";
		} else {
			statusDiv.textContent =
				"Storage is NOT Persistent (Browser may clear data if low on space) ⚠️";
			statusDiv.className = "status denied";
			btn.style.display = "block";
		}
		// Cache status
		saveSettings({ storagePersistent: isPersisted });
	}

	btn.addEventListener("click", async () => {
		if (navigator.storage?.persist) {
			const isPersisted = await navigator.storage.persist();
			updateUI(isPersisted);
		}
	});

	checkPersistence();
});
