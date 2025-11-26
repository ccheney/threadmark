import { existsSync } from "node:fs";
import { cp, mkdir, rm } from "node:fs/promises";
import { build } from "bun";

console.log("Building Threadmark (Feature Slices)...");

// Clean dist
if (existsSync("dist")) {
	await rm("dist", { recursive: true, force: true });
}
await mkdir("dist");

// Build
const result = await build({
	entrypoints: [
		"src/background.ts",
		"src/features/capture/content.ts",
		"src/features/settings/options.ts",
		"src/features/sidepanel/sidepanel.ts",
	],
	outdir: "dist",
	target: "browser",
	minify: false,
});

if (!result.success) {
	console.error("Build failed!");
	for (const message of result.logs) {
		console.error(message);
	}
	process.exit(1);
}

// Copy manifest & static files
// Note: Bun build preserves folder structure for JS files.
// We need to manually mirror that for HTML files if they are not imported by JS (which they aren't in this context).
await cp("src/manifest.json", "dist/manifest.json");

// Ensure directories exist for static files
await mkdir("dist/features/settings", { recursive: true });
await mkdir("dist/features/sidepanel", { recursive: true });

await cp(
	"src/features/settings/options.html",
	"dist/features/settings/options.html",
);
await cp(
	"src/features/sidepanel/sidepanel.html",
	"dist/features/sidepanel/sidepanel.html",
);

// Generate Icons
const proc = Bun.spawn(["python3", "scripts/generate_icons.py"], {
	stdout: "inherit",
	stderr: "inherit",
});
await proc.exited;

console.log("Build complete! Load 'dist' folder in Chrome.");
