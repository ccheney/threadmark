export interface Settings {
	autoHighlight: boolean;
	theme: "light" | "dark" | "system";
	storagePersistent: boolean; // Read-only mostly, but stored here for caching status
}

export const DEFAULT_SETTINGS: Settings = {
	autoHighlight: true,
	theme: "system",
	storagePersistent: false,
};

export async function getSettings(): Promise<Settings> {
	const data = await chrome.storage.local.get("settings");
	return { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
}

export async function saveSettings(settings: Partial<Settings>) {
	const current = await getSettings();
	const updated = { ...current, ...settings };
	await chrome.storage.local.set({ settings: updated });
	return updated;
}
