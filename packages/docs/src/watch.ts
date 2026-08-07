import path from "node:path";

/** Directory names that are never content: VCS metadata, dependencies, build caches/output. */
const IGNORED_DIR_NAMES = new Set(["node_modules", ".git", ".astro", ".cache"]);

/**
 * True if a path change (relative to the watched repo root) is noise we should never react to:
 * inside a directory we always ignore (`node_modules`, `.git`, build caches), inside a hidden
 * directory (editor/tool state like `.vscode`), or inside one of the caller-supplied
 * `ignoredRelPrefixes` — paths (relative to that same repo root) the caller itself writes to and
 * so must never treat as a content change (e.g. the configured build output dir, or the bundled
 * Astro app dir when it's nested inside the watched root).
 */
export function shouldIgnoreWatchPath(relPath: string, ignoredRelPrefixes: string[]): boolean {
	const segments = relPath.split(path.sep).filter(Boolean);
	if (segments.some((s) => IGNORED_DIR_NAMES.has(s) || s.startsWith("."))) return true;
	return ignoredRelPrefixes.some(
		(prefix) => prefix !== "" && (relPath === prefix || relPath.startsWith(`${prefix}${path.sep}`)),
	);
}

/**
 * Collapses bursts of calls into one trailing call `ms` after the last one — editors/OSes often
 * fire several fs events for what's conceptually a single save.
 */
export function debounce(fn: () => void, ms: number): (() => void) & { cancel(): void } {
	let timer: NodeJS.Timeout | undefined;
	const debounced = (): void => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => {
			timer = undefined;
			fn();
		}, ms);
	};
	debounced.cancel = (): void => {
		if (timer) clearTimeout(timer);
		timer = undefined;
	};
	return debounced;
}
