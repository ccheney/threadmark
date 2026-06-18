import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "tests/e2e",
	testMatch: "**/*.playwright.ts",
	fullyParallel: false,
	workers: 1,
	timeout: 45_000,
	reporter: "list",
	use: {
		trace: "retain-on-failure",
	},
});
