import { readFile, writeFile } from "node:fs/promises";

const args = process.argv.slice(2);
const validTypes = ["major", "minor", "patch"] as const;
type BumpType = (typeof validTypes)[number];

const bumpType = (args[0] as BumpType) || "patch";

if (!validTypes.includes(bumpType)) {
	console.error(`Usage: bun run bump [major|minor|patch]`);
	console.error(`  major: 1.0.0 -> 2.0.0`);
	console.error(`  minor: 1.0.0 -> 1.1.0`);
	console.error(`  patch: 1.0.0 -> 1.0.1 (default)`);
	process.exit(1);
}

function bumpVersion(version: string, type: BumpType): string {
	const [major, minor, patch] = version.split(".").map(Number);

	switch (type) {
		case "major":
			return `${major + 1}.0.0`;
		case "minor":
			return `${major}.${minor + 1}.0`;
		case "patch":
			return `${major}.${minor}.${patch + 1}`;
	}
}

// Read and update package.json
const pkgPath = "package.json";
const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
const oldVersion = pkg.version;
const newVersion = bumpVersion(oldVersion, bumpType);
pkg.version = newVersion;
await writeFile(pkgPath, `${JSON.stringify(pkg, null, "\t")}\n`);

// Read and update manifest.json
const manifestPath = "src/manifest.json";
const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
manifest.version = newVersion;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, "\t")}\n`);

console.log(`Bumped version: ${oldVersion} -> ${newVersion}`);
