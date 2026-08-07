import fs from "node:fs";
import path from "node:path";
import { dev as astroDev } from "astro";
import { APP_ROOT, applyEnv, logSyncResult } from "./build.js";
import type { CliOverrides } from "./config.js";
import { resolveConfig } from "./config.js";
import { syncContent } from "./sync.js";
import type { ResolvedConfig } from "./types.js";
import { debounce, shouldIgnoreWatchPath } from "./watch.js";

const CONFIG_FILENAME = "docs.config.yaml";
const WATCH_DEBOUNCE_MS = 200;

/**
 * `target`'s path relative to `root`, or `undefined` if `target` isn't inside `root` (or is
 * `root` itself). Used to find which of the dev process's own write targets — build out-dir,
 * bundled Astro app dir — fall inside the watched root and so need to be ignored by the watcher.
 */
function relPrefixIfInside(root: string, target: string): string | undefined {
	const rel = path.relative(root, target);
	if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) return undefined;
	return rel;
}

/**
 * Syncs the consumer repo's markdown into the bundled app, starts Astro's dev server, then
 * watches the consumer repo for changes: markdown/asset edits trigger a debounced re-sync (Astro's
 * own dev server watches the synced copy and HMRs on top of that), and edits to `docs.config.yaml`
 * re-resolve the config, re-sync, and restart the Astro dev server so the new config takes effect.
 *
 * Known limitation: uses `fs.watch(root, { recursive: true })`, which is only reliably recursive
 * on macOS and Windows — on Linux it watches the root directory non-recursively, so edits in
 * subdirectories won't be picked up there (restart `docs dev` to pick up edits in that case).
 */
export async function runDev(overrides: CliOverrides): Promise<void> {
	let cfg = resolveConfig(overrides);

	const sync = (): void => {
		try {
			const result = syncContent(cfg, APP_ROOT);
			logSyncResult(result);
		} catch (err) {
			console.error(`[docs] sync failed: ${(err as Error).message}`);
		}
	};

	sync();
	applyEnv(cfg);
	let server = await startAstroServer();

	const resync = debounce(sync, WATCH_DEBOUNCE_MS);
	const reloadConfig = debounce(() => {
		void handleConfigChange();
	}, WATCH_DEBOUNCE_MS);

	async function handleConfigChange(): Promise<void> {
		console.log(`[docs] ${CONFIG_FILENAME} changed — reloading config...`);
		let nextCfg: ResolvedConfig;
		try {
			nextCfg = resolveConfig(overrides);
		} catch (err) {
			console.error(
				`[docs] failed to load ${CONFIG_FILENAME}, keeping previous config running: ${(err as Error).message}`,
			);
			return;
		}
		cfg = nextCfg;
		sync();
		applyEnv(cfg);
		try {
			await server.stop();
			server = await startAstroServer();
			console.log("[docs] dev server restarted with new config.");
		} catch (err) {
			console.error(`[docs] failed to restart dev server: ${(err as Error).message}`);
		}
	}

	async function startAstroServer(): Promise<Awaited<ReturnType<typeof astroDev>>> {
		return astroDev({
			root: APP_ROOT,
			cacheDir: path.join(APP_ROOT, ".cache"),
		});
	}

	// Paths the dev process itself writes to, which must never be treated as watched content
	// changes (otherwise a sync/build write is picked up by the watcher and triggers another
	// sync — an infinite loop). Only relevant when they land inside the watched root, which
	// happens when a consumer repo IS the monorepo root the docs package lives in.
	const ignoredRelPrefixes = [
		relPrefixIfInside(cfg.root, cfg.out), // build output dir
		relPrefixIfInside(cfg.root, APP_ROOT), // bundled Astro app: content/public sync destination, .cache, etc.
	].filter((p): p is string => p !== undefined);

	fs.watch(cfg.root, { recursive: true }, (_event, filename) => {
		if (!filename) return;
		const relPath = filename.toString();
		if (relPath === CONFIG_FILENAME) {
			reloadConfig();
			return;
		}
		if (shouldIgnoreWatchPath(relPath, ignoredRelPrefixes)) return;
		resync();
	});

	console.log(
		`[docs] watching ${cfg.root} for content changes and ${CONFIG_FILENAME} for config changes.`,
	);
}
