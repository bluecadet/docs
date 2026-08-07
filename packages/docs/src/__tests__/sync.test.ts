import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildRouteMap, discoverContent, syncContent } from "../sync.js";
import type { ResolvedConfig } from "../types.js";

let root: string;

beforeEach(() => {
	root = fs.mkdtempSync(path.join(os.tmpdir(), "docs-sync-test-"));
});

afterEach(() => {
	fs.rmSync(root, { recursive: true, force: true });
});

function write(relPath: string, content = "# Title\n\nBody.\n"): string {
	const abs = path.join(root, relPath);
	fs.mkdirSync(path.dirname(abs), { recursive: true });
	fs.writeFileSync(abs, content);
	return abs;
}

describe("discoverContent - landing precedence", () => {
	it("uses README.md when it's the only candidate", () => {
		const readme = write("README.md");
		const { landing, displaced, notices } = discoverContent(root, []);
		expect(landing).toBe(readme);
		expect(displaced).toBeUndefined();
		expect(notices).toEqual([]);
	});

	it("uses docs/index.md when there's no README", () => {
		const indexMd = write("docs/index.md");
		const { landing } = discoverContent(root, []);
		expect(landing).toBe(indexMd);
	});

	it("uses docs/index.mdx alone with no README and no docs/index.md (MDX-only repo)", () => {
		const indexMdx = write("docs/index.mdx", "---\ntitle: Splash\n---\nBody\n");
		const { landing, displaced } = discoverContent(root, []);
		expect(landing).toBe(indexMdx);
		expect(displaced).toBeUndefined();
	});

	it("prefers docs/index.mdx over README.md and displaces the README to /overview/", () => {
		const readme = write("README.md");
		const indexMdx = write("docs/index.mdx", "---\ntitle: Splash\n---\nBody\n");
		const { landing, displaced, notices } = discoverContent(root, []);
		expect(landing).toBe(indexMdx);
		expect(displaced).toBe(readme);
		expect(notices).toHaveLength(1);
		expect(notices[0]).toContain("docs/index.mdx");
		expect(notices[0]).toContain("README.md");
	});

	it("prefers docs/index.md over README.md and displaces the README to /overview/", () => {
		const readme = write("README.md");
		const indexMd = write("docs/index.md");
		const { landing, displaced } = discoverContent(root, []);
		expect(landing).toBe(indexMd);
		expect(displaced).toBe(readme);
	});

	it("errors when docs/index.md and docs/index.mdx both exist", () => {
		write("docs/index.md");
		write("docs/index.mdx", "---\ntitle: Splash\n---\nBody\n");
		expect(() => discoverContent(root, [])).toThrow(/mutually exclusive/);
	});

	it("has no landing page when none of the three candidates exist", () => {
		write("docs/how-to/foo.md");
		const { landing, displaced } = discoverContent(root, []);
		expect(landing).toBeUndefined();
		expect(displaced).toBeUndefined();
	});
});

describe("discoverContent - extra content globs", () => {
	it("includes files matched by an extra glob pattern", () => {
		write("README.md");
		write("Packages/foo/README.md");
		const { files } = discoverContent(root, ["Packages/*/README.md"]);
		expect(files).toContain(path.join(root, "Packages/foo/README.md"));
	});
});

describe("buildRouteMap", () => {
	it("routes docs/ files relative to docs/, collapsing index/README basenames", () => {
		const readme = write("README.md");
		const howTo = write("docs/how-to/foo.md");
		const { landing, displaced, docsDir, files } = discoverContent(root, []);
		const routes = buildRouteMap(root, docsDir, landing, displaced, files);
		expect(routes.get(readme)).toBe("/");
		expect(routes.get(howTo)).toBe("/how-to/foo/");
	});

	it("displaces the losing landing candidate to /overview/", () => {
		const readme = write("README.md");
		const indexMdx = write("docs/index.mdx", "---\ntitle: Splash\n---\nBody\n");
		const { landing, displaced, docsDir, files } = discoverContent(root, []);
		const routes = buildRouteMap(root, docsDir, landing, displaced, files);
		expect(routes.get(indexMdx)).toBe("/");
		expect(routes.get(readme)).toBe("/overview/");
	});

	it("throws naming both files when two files map to the same route", () => {
		write("README.md");
		const flat = write("docs/how-to.md");
		const nested = write("docs/how-to/index.md");
		const { landing, displaced, docsDir, files } = discoverContent(root, []);
		let thrown: Error | undefined;
		try {
			buildRouteMap(root, docsDir, landing, displaced, files);
		} catch (err) {
			thrown = err as Error;
		}
		expect(thrown?.message).toContain(flat);
		expect(thrown?.message).toContain(nested);
	});
});

describe("syncContent - sourcePath frontmatter", () => {
	it("injects the repo-root-relative source path into every synced page's frontmatter", () => {
		write("README.md");
		write("docs/how-to/foo.md", "# Foo\n\nBody.\n");

		const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), "docs-sync-app-test-"));
		try {
			const cfg: ResolvedConfig = {
				root,
				out: path.join(root, "dist"),
				title: "Test",
				branch: "main",
				content: [],
			};
			syncContent(cfg, appRoot);

			const synced = fs.readFileSync(
				path.join(appRoot, "src", "content", "docs", "how-to", "foo.md"),
				"utf8",
			);
			expect(synced).toContain("sourcePath: docs/how-to/foo.md");

			const landing = fs.readFileSync(
				path.join(appRoot, "src", "content", "docs", "index.md"),
				"utf8",
			);
			expect(landing).toContain("sourcePath: README.md");
		} finally {
			fs.rmSync(appRoot, { recursive: true, force: true });
		}
	});
});
