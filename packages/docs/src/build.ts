import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as astroBuild } from "astro";
import { syncContent } from "./sync.js";
import type { ResolvedConfig } from "./types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
/** The bundled Astro app, shipped alongside `dist/` in the published package. */
export const APP_ROOT = path.join(here, "..", "app");

/** Syncs the consumer repo's markdown into the bundled app, then runs a static Astro build. */
export async function runBuild(cfg: ResolvedConfig): Promise<void> {
	const result = syncContent(cfg, APP_ROOT);
	logSyncResult(result);
	applyEnv(cfg);

	// cacheDir must live outside outDir: Astro clears outDir *after* the content sync writes its
	// data-store.json there, which would silently produce an empty build.
	await astroBuild({
		root: APP_ROOT,
		outDir: cfg.out,
		cacheDir: path.join(APP_ROOT, ".cache"),
		logLevel: "info",
	});
}

export function logSyncResult(result: {
	pageCount: number;
	assetCount: number;
	warnings: string[];
	notices: string[];
}): void {
	console.log(`[docs] synced ${result.pageCount} page(s), ${result.assetCount} asset(s)`);
	for (const notice of result.notices) console.log(`[docs] ${notice}`);
	if (result.warnings.length > 0) {
		const unique = [...new Set(result.warnings)];
		console.log(
			`[docs] ${unique.length} link(s) could not be resolved and were left as-is or unwrapped:`,
		);
		for (const w of unique.slice(0, 10)) console.log(`  - ${w}`);
		if (unique.length > 10) console.log(`  ...and ${unique.length - 10} more`);
	}
}

export function applyEnv(cfg: ResolvedConfig): void {
	process.env.DOCS_TITLE = cfg.title;
	if (cfg.repoUrl) process.env.DOCS_REPO_URL = cfg.repoUrl;
	if (cfg.base) process.env.DOCS_BASE = cfg.base;
	if (cfg.site) process.env.DOCS_SITE = cfg.site;
}
