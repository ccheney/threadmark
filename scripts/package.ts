import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";

const distDir = "dist";
const outDir = "releases";

if (!existsSync(distDir)) {
	console.error("Error: dist folder not found. Run 'bun run build' first.");
	process.exit(1);
}

// Read version from manifest
const manifest = JSON.parse(
	await readFile(join(distDir, "manifest.json"), "utf-8"),
);
const version = manifest.version;
const zipName = `threadmark-v${version}.zip`;
const zipPath = join(outDir, zipName);

// Create releases directory if it doesn't exist
if (!existsSync(outDir)) {
	await Bun.spawn(["mkdir", "-p", outDir]).exited;
}

// Remove existing zip if present
if (existsSync(zipPath)) {
	await rm(zipPath);
}

// Create zip archive
console.log(`Packaging extension v${version}...`);
const proc = Bun.spawn(["zip", "-r", `../${outDir}/${zipName}`, "."], {
	cwd: distDir,
	stdout: "inherit",
	stderr: "inherit",
});

const exitCode = await proc.exited;

if (exitCode !== 0) {
	console.error("Failed to create zip archive");
	process.exit(1);
}

console.log(`\nPackage created: ${zipPath}`);
console.log("Ready for Chrome Web Store upload!");
