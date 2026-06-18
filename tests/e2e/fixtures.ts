import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { type BrowserContext, test as base, chromium } from "@playwright/test";

type ExtensionFixtures = {
	context: BrowserContext;
	extensionId: string;
};

const repoRoot = path.resolve(import.meta.dirname, "../..");
const extensionPath = path.join(repoRoot, "dist");

export const test = base.extend<ExtensionFixtures>({
	context: async ({ browserName: _browserName }, use) => {
		const userDataDir = await mkdtemp(path.join(tmpdir(), "threadmark-"));
		const context = await chromium.launchPersistentContext(userDataDir, {
			channel: "chromium",
			headless: false,
			args: [
				`--disable-extensions-except=${extensionPath}`,
				`--load-extension=${extensionPath}`,
			],
		});

		try {
			await use(context);
		} finally {
			await context.close();
			await rm(userDataDir, { recursive: true, force: true });
		}
	},

	extensionId: async ({ context }, use) => {
		let [serviceWorker] = context.serviceWorkers();
		if (!serviceWorker) {
			serviceWorker = await context.waitForEvent("serviceworker");
		}

		const extensionId = serviceWorker.url().split("/")[2];
		if (!extensionId) {
			throw new Error(
				`Could not derive extension ID from ${serviceWorker.url()}`,
			);
		}

		await use(extensionId);
	},
});

export { expect } from "@playwright/test";
