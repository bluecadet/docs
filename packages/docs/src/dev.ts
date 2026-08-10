import fs from "node:fs";
import path from "node:path";
import { dev as astroDev } from "astro";
import { APP_ROOT, applyEnv, logSyncResult } from "./build.js";
import type { CliOverrides } from "./config.js";
import { resolveConfig } from "./config.js";
import { syncContent } from "./sync.js";
import type { ResolvedConfig } from "./types.js";
import { debounce, shouldIgnoreWatchPath } from "./watch.js";

const WATCH_DEBOUNCE_MS = 200;

/**
 * `target`'s path relative to `root`, or `undefined` if `target` isn't inside `root` (or is
 * `root` itself). Used to find which of the dev process's own write targets — build out-dir,
 * bundled Astro app dir — fall inside a watched directory and so need to be ignored by the watcher.
 */
function relPrefixIfInside(root: string, target: string): string | undefined {
	const rel = path.relative(root, target);
	if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) return undefined;
	return rel;
}

/**
 * Every directory the dev server needs to watch: the config file's directory, plus the resolved
 * `base` of any content entry that lives outside it (a `base: "../sibling"` entry is legitimate,
 * and editing files there should still trigger a re-sync). Deduped, and a base already covered by
 * an ancestor in the list is dropped so one edit doesn't fire two watchers.
 */
function watchDirs(cfg: ResolvedConfig): string[] {
	const candidates = [
		cfg.configDir,
		...cfg.content.map((e) => path.resolve(cfg.configDir, e.base)),
	];
	const dirs: string[] = [];
	for (const dir of candidates) {
		if (!fs.existsSync(dir)) continue;
		if (
			dirs.some((existing) => relPrefixIfInside(existing, dir) !== undefined || existing === dir)
		) {
			continue;
		}
		dirs.push(dir);
	}
	return dirs;
}

/**
 * Syncs the configured content into the bundled app, starts Astro's dev server, then watches the
 * config file's directory (and any content `base` outside it) for changes: content/asset edits
 * trigger a debounced re-sync (Astro's own dev server watches the synced copy and HMRs on top of
 * that), and edits to the config file re-resolve the config, re-sync, and restart the Astro dev
 * server so the new config takes effect.
 *
 * Known limitation: uses `fs.watch(dir, { recursive: true })`, which is only reliably recursive
 * on macOS and Windows — on Linux it watches each directory non-recursively, so edits in
 * subdirectories won't be picked up there (restart `docs dev` to pick up edits in that case).
 */
export async function runDev(overrides: CliOverrides): Promise<void> {
	let cfg = resolveConfig(overrides);
	const configName = path.basename(cfg.configPath);

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
		console.log(`[docs] ${configName} changed — reloading config...`);
		let nextCfg: ResolvedConfig;
		try {
			nextCfg = resolveConfig(overrides);
		} catch (err) {
			console.error(
				`[docs] failed to load ${configName}, keeping previous config running: ${(err as Error).message}`,
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

	// Content `base` dirs are only re-read on the next sync, so a new one added to the config won't
	// be watched until the dev server is restarted — the initial set is what we watch for this run.
	for (const dir of watchDirs(cfg)) {
		// Paths the dev process itself writes to, which must never be treated as watched content
		// changes (otherwise a sync/build write is picked up by the watcher and triggers another
		// sync — an infinite loop). Only relevant when they land inside a watched directory, which
		// happens when the config sits in the monorepo root the docs package itself lives in.
		const ignoredRelPrefixes = [
			relPrefixIfInside(dir, cfg.out), // build output dir
			relPrefixIfInside(dir, APP_ROOT), // bundled Astro app: content/public sync destination, .cache, etc.
		].filter((p): p is string => p !== undefined);

		const watchesConfigFile = dir === cfg.configDir;

		fs.watch(dir, { recursive: true }, (_event, filename) => {
			if (!filename) return;
			const relPath = filename.toString();
			if (watchesConfigFile && relPath === configName) {
				reloadConfig();
				return;
			}
			if (shouldIgnoreWatchPath(relPath, ignoredRelPrefixes)) return;
			resync();
		});

		console.log(`[docs] watching ${dir} for content changes.`);
	}

	console.log(`[docs] watching ${cfg.configPath} for config changes.`);
}
