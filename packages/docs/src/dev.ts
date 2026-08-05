import path from "node:path";
import { dev as astroDev } from "astro";
import { APP_ROOT, applyEnv, logSyncResult } from "./build.js";
import { syncContent } from "./sync.js";
import type { ResolvedConfig } from "./types.js";

/**
 * Syncs the consumer repo's markdown into the bundled app once, then runs Astro's dev server.
 *
 * Known limitation: content is synced only at startup. Editing markdown in the consumer repo
 * while `docs dev` is running does not re-trigger a sync — restart the command to pick up edits.
 */
export async function runDev(cfg: ResolvedConfig): Promise<void> {
	const result = syncContent(cfg, APP_ROOT);
	logSyncResult(result);
	console.log("[docs] content is synced once at startup; restart `docs dev` to pick up edits.");
	applyEnv(cfg);

	await astroDev({
		root: APP_ROOT,
		cacheDir: path.join(APP_ROOT, ".cache"),
	});
}
