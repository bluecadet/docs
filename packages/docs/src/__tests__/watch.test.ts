import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { debounce, shouldIgnoreWatchPath } from "../watch.js";

describe("shouldIgnoreWatchPath", () => {
	it("ignores node_modules and .git regardless of depth", () => {
		expect(shouldIgnoreWatchPath(path.join("node_modules", "foo", "index.js"), [])).toBe(true);
		expect(shouldIgnoreWatchPath(path.join("packages", "app", ".git", "HEAD"), [])).toBe(true);
	});

	it("ignores hidden directories like .astro/.cache/.vscode", () => {
		expect(shouldIgnoreWatchPath(path.join(".astro", "types.d.ts"), [])).toBe(true);
		expect(shouldIgnoreWatchPath(path.join(".cache", "data"), [])).toBe(true);
		expect(shouldIgnoreWatchPath(path.join(".vscode", "settings.json"), [])).toBe(true);
	});

	it("ignores paths inside a single configured prefix (e.g. out dir)", () => {
		expect(shouldIgnoreWatchPath(path.join("dist", "index.html"), ["dist"])).toBe(true);
		expect(shouldIgnoreWatchPath("dist", ["dist"])).toBe(true);
	});

	it("does not ignore content markdown or asset paths", () => {
		expect(shouldIgnoreWatchPath(path.join("docs", "guide.md"), ["dist"])).toBe(false);
		expect(shouldIgnoreWatchPath("README.md", ["dist"])).toBe(false);
		expect(shouldIgnoreWatchPath(path.join("docs", "img", "diagram.png"), ["dist"])).toBe(false);
	});

	it("does not confuse a similarly-named dir with an ignored prefix", () => {
		// "dist-notes" should not be treated as inside "dist"
		expect(shouldIgnoreWatchPath(path.join("dist-notes", "README.md"), ["dist"])).toBe(false);
	});

	it("ignores paths inside the sync destination when it's nested in the watched root", () => {
		// Mirrors `docs dev --root .` in this repo: the bundled app (and thus the sync destination
		// inside it) lives under the same root that's being watched for content changes.
		const appPrefix = path.join("packages", "docs", "app");
		expect(
			shouldIgnoreWatchPath(path.join(appPrefix, "src", "content", "docs", "index.md"), [
				appPrefix,
			]),
		).toBe(true);
		expect(shouldIgnoreWatchPath(path.join(appPrefix, "public", "logo.png"), [appPrefix])).toBe(
			true,
		);
		expect(shouldIgnoreWatchPath(appPrefix, [appPrefix])).toBe(true);
	});

	it("honors multiple ignored prefixes at once (out dir + app dir)", () => {
		const prefixes = ["dist", path.join("packages", "docs", "app")];
		expect(shouldIgnoreWatchPath(path.join("dist", "index.html"), prefixes)).toBe(true);
		expect(
			shouldIgnoreWatchPath(path.join("packages", "docs", "app", ".cache", "data"), prefixes),
		).toBe(true);
		expect(shouldIgnoreWatchPath(path.join("docs", "guide.md"), prefixes)).toBe(false);
	});

	it("does not ignore a sibling path that merely shares a prefix as a substring", () => {
		const appPrefix = path.join("packages", "docs", "app");
		expect(
			shouldIgnoreWatchPath(path.join("packages", "docs", "app-notes", "README.md"), [appPrefix]),
		).toBe(false);
	});

	it("treats an empty ignored-prefix entry as a no-op rather than matching everything", () => {
		expect(shouldIgnoreWatchPath("README.md", [""])).toBe(false);
	});
});

describe("debounce", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("collapses a burst of calls into a single trailing call", () => {
		const fn = vi.fn();
		const debounced = debounce(fn, 200);

		debounced();
		debounced();
		debounced();
		expect(fn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(200);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("restarts the timer on each call", () => {
		const fn = vi.fn();
		const debounced = debounce(fn, 200);

		debounced();
		vi.advanceTimersByTime(150);
		debounced();
		vi.advanceTimersByTime(150);
		expect(fn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(50);
		expect(fn).toHaveBeenCalledTimes(1);
	});

	it("cancel() prevents a pending call from firing", () => {
		const fn = vi.fn();
		const debounced = debounce(fn, 200);

		debounced();
		debounced.cancel();
		vi.advanceTimersByTime(200);
		expect(fn).not.toHaveBeenCalled();
	});
});
