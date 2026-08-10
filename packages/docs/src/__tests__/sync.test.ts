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

describe("discoverContent - .astro files", () => {
	it("includes .astro files under docs/ in the file set", () => {
		write("docs/how-to/demo.astro", "<h1>Demo</h1>\n");
		const { files } = discoverContent(root, []);
		expect(files).toContain(path.join(root, "docs/how-to/demo.astro"));
	});

	it("does not pick up .astro files matched by an extra content glob", () => {
		write("Packages/foo/widget.astro", "<h1>Widget</h1>\n");
		const { files } = discoverContent(root, ["Packages/*/*.astro"]);
		expect(files).not.toContain(path.join(root, "Packages/foo/widget.astro"));
	});
});

describe("buildRouteMap - .astro routing", () => {
	it("strips .astro exactly like .md, including nesting and case normalization", () => {
		const demo = write("docs/How-To/Demo.astro", "<h1>Demo</h1>\n");
		write("README.md");
		const { landing, displaced, docsDir, files } = discoverContent(root, []);
		const routes = buildRouteMap(root, docsDir, landing, displaced, files);
		expect(routes.get(demo)).toBe("/how-to/demo/");
	});

	it("collapses index.astro onto its parent directory route", () => {
		const index = write("docs/how-to/index.astro", "<h1>How To</h1>\n");
		write("README.md");
		const { landing, displaced, docsDir, files } = discoverContent(root, []);
		const routes = buildRouteMap(root, docsDir, landing, displaced, files);
		expect(routes.get(index)).toBe("/how-to/");
	});

	it("throws when a .md file and a .astro file collide on the same route", () => {
		write("README.md");
		const md = write("docs/how-to.md");
		const astro = write("docs/how-to/index.astro", "<h1>How To</h1>\n");
		const { landing, displaced, docsDir, files } = discoverContent(root, []);
		let thrown: Error | undefined;
		try {
			buildRouteMap(root, docsDir, landing, displaced, files);
		} catch (err) {
			thrown = err as Error;
		}
		expect(thrown?.message).toContain(md);
		expect(thrown?.message).toContain(astro);
	});

	it("rejects an .astro file that resolves to the landing route (/)", () => {
		write("README.md");
		write("docs/index.astro", "<h1>Home</h1>\n");
		const { landing, displaced, docsDir, files } = discoverContent(root, []);
		expect(() => buildRouteMap(root, docsDir, landing, displaced, files)).toThrow(
			/landing page/,
		);
	});
});

describe("syncContent - .astro pages", () => {
	function makeCfg(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
		return { root, out: path.join(root, "dist"), title: "Test", branch: "main", content: [], ...overrides };
	}

	it("copies an .astro file verbatim to astro-pages/, written under its route path", () => {
		write("README.md");
		write("docs/how-to/demo.astro", "<h1>Demo</h1>\n<p>Raw markup, untouched.</p>\n");

		const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), "docs-sync-app-test-"));
		try {
			const result = syncContent(makeCfg(), appRoot);
			const outPath = path.join(appRoot, "src", "astro-pages", "how-to", "demo.astro");
			expect(fs.existsSync(outPath)).toBe(true);
			const written = fs.readFileSync(outPath, "utf8");
			expect(written).toBe("<h1>Demo</h1>\n<p>Raw markup, untouched.</p>\n");
			expect(written).not.toContain("sourcePath");
			expect(result.pageCount).toBe(2); // README.md + demo.astro
		} finally {
			fs.rmSync(appRoot, { recursive: true, force: true });
		}
	});

	it("wipes astro-pages/ on every sync, preserving nothing from a previous run", () => {
		write("README.md");
		write("docs/how-to/demo.astro", "<h1>Demo</h1>\n");

		const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), "docs-sync-app-test-"));
		try {
			syncContent(makeCfg(), appRoot);
			const staleDir = path.join(appRoot, "src", "astro-pages", "stale");
			fs.mkdirSync(staleDir, { recursive: true });
			fs.writeFileSync(path.join(staleDir, "old.astro"), "<p>old</p>\n");

			fs.rmSync(path.join(root, "docs", "how-to", "demo.astro"));
			syncContent(makeCfg(), appRoot);

			expect(fs.existsSync(staleDir)).toBe(false);
			expect(fs.existsSync(path.join(appRoot, "src", "astro-pages", "how-to"))).toBe(false);
		} finally {
			fs.rmSync(appRoot, { recursive: true, force: true });
		}
	});

	it("excludes .astro files from blindCopyDocsAssets (no raw source shipped to public/)", () => {
		write("README.md");
		write("docs/how-to/demo.astro", "<h1>Demo</h1>\n");

		const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), "docs-sync-app-test-"));
		try {
			syncContent(makeCfg(), appRoot);
			expect(fs.existsSync(path.join(appRoot, "public", "how-to", "demo.astro"))).toBe(false);
			expect(fs.existsSync(path.join(appRoot, "public", "demo.astro"))).toBe(false);
		} finally {
			fs.rmSync(appRoot, { recursive: true, force: true });
		}
	});

	it("rewrites a markdown link to an .astro page to its site route", () => {
		write("README.md");
		write("docs/how-to/demo.astro", "<h1>Demo</h1>\n");
		write("docs/how-to/guide.md", "# Guide\n\nSee [the demo](./demo.astro).\n");

		const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), "docs-sync-app-test-"));
		try {
			syncContent(makeCfg(), appRoot);
			const synced = fs.readFileSync(
				path.join(appRoot, "src", "content", "docs", "how-to", "guide.md"),
				"utf8",
			);
			expect(synced).toContain("(/how-to/demo/)");
		} finally {
			fs.rmSync(appRoot, { recursive: true, force: true });
		}
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
