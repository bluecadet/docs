import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discoverContent, syncContent } from "../sync.js";
import type { ContentEntry, ResolvedConfig } from "../types.js";

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

/** A content entry with every field defaulted the way `validateConfig` would leave it. */
function entry(overrides: Partial<ContentEntry> = {}): ContentEntry {
	return { base: ".", files: ["**/*.md"], route: "", assets: [], ...overrides };
}

describe("discoverContent - route derivation", () => {
	it("routes files relative to the entry's base, extension stripped and lowercased", () => {
		const foo = write("docs/How-To/Foo.md");
		const { routes } = discoverContent(root, [entry({ base: "docs" })], undefined);
		expect(routes.get(foo)).toBe("/how-to/foo/");
	});

	it("collapses a trailing index segment onto its directory", () => {
		const index = write("docs/reference/index.md");
		const { routes } = discoverContent(root, [entry({ base: "docs" })], undefined);
		expect(routes.get(index)).toBe("/reference/");
	});

	it("collapses a trailing README segment onto its directory", () => {
		const readme = write("packages/docs/README.md");
		const { routes } = discoverContent(
			root,
			[entry({ files: ["packages/*/README.md"] })],
			undefined,
		);
		expect(routes.get(readme)).toBe("/packages/docs/");
	});

	it("prefixes every route in an entry with its route key", () => {
		const readme = write("packages/docs/README.md");
		const { routes } = discoverContent(
			root,
			[entry({ base: "packages", files: ["*/README.md"], route: "pkg" })],
			undefined,
		);
		expect(routes.get(readme)).toBe("/pkg/docs/");
	});

	it("supports a multi-segment route prefix", () => {
		const foo = write("extra/foo.md");
		const { routes } = discoverContent(
			root,
			[entry({ base: "extra", route: "reference/api" })],
			undefined,
		);
		expect(routes.get(foo)).toBe("/reference/api/foo/");
	});

	it("resolves a base that climbs out of the config directory with ..", () => {
		const sibling = path.join(root, "sibling");
		fs.mkdirSync(path.join(sibling, "notes"), { recursive: true });
		fs.writeFileSync(path.join(sibling, "notes", "a.md"), "# A\n");
		const configDir = path.join(root, "site");
		fs.mkdirSync(configDir, { recursive: true });

		const { routes } = discoverContent(
			configDir,
			[entry({ base: "../sibling/notes", route: "notes" })],
			undefined,
		);
		expect(routes.get(path.join(sibling, "notes", "a.md"))).toBe("/notes/a/");
	});

	it("errors naming both files when two files resolve to the same route", () => {
		const flat = write("docs/how-to.md");
		const nested = write("docs/how-to/index.md");
		let thrown: Error | undefined;
		try {
			discoverContent(root, [entry({ base: "docs" })], undefined);
		} catch (err) {
			thrown = err as Error;
		}
		expect(thrown?.message).toContain(flat);
		expect(thrown?.message).toContain(nested);
	});

	it("errors naming both entries when two entries match the same file", () => {
		const foo = write("docs/foo.md");
		let thrown: Error | undefined;
		try {
			discoverContent(
				root,
				[entry({ base: "docs" }), entry({ base: "docs", files: ["foo.md"], route: "extra" })],
				undefined,
			);
		} catch (err) {
			thrown = err as Error;
		}
		expect(thrown?.message).toContain(foo);
		expect(thrown?.message).toContain("content[0]");
		expect(thrown?.message).toContain("content[1]");
	});

	it("errors when a files pattern climbs out of its base", () => {
		write("outside.md");
		fs.mkdirSync(path.join(root, "docs"), { recursive: true });
		expect(() =>
			discoverContent(root, [entry({ base: "docs", files: ["../outside.md"] })], undefined),
		).toThrowError(/outside/);
	});

	it("errors when base does not exist", () => {
		expect(() => discoverContent(root, [entry({ base: "nope" })], undefined)).toThrowError(
			/does not exist/,
		);
	});

	it("errors when nothing at all is published", () => {
		fs.mkdirSync(path.join(root, "docs"), { recursive: true });
		expect(() => discoverContent(root, [entry({ base: "docs" })], undefined)).toThrowError(
			/No pages to publish/,
		);
	});
});

describe("discoverContent - .astro via content globs", () => {
	it("publishes an .astro file matched by a files glob", () => {
		const demo = write("docs/how-to/demo.astro", "<h1>Demo</h1>\n");
		const { pages, routes } = discoverContent(
			root,
			[entry({ base: "docs", files: ["**/*.{md,astro}"] })],
			undefined,
		);
		expect(pages).toContain(demo);
		expect(routes.get(demo)).toBe("/how-to/demo/");
	});

	it("collapses index.astro onto its parent directory route", () => {
		const index = write("docs/how-to/index.astro", "<h1>How To</h1>\n");
		const { routes } = discoverContent(
			root,
			[entry({ base: "docs", files: ["**/*.astro"] })],
			undefined,
		);
		expect(routes.get(index)).toBe("/how-to/");
	});

	it("errors when a .md file and an .astro file collide on the same route", () => {
		const md = write("docs/how-to.md");
		const astro = write("docs/how-to/index.astro", "<h1>How To</h1>\n");
		let thrown: Error | undefined;
		try {
			discoverContent(root, [entry({ base: "docs", files: ["**/*.{md,astro}"] })], undefined);
		} catch (err) {
			thrown = err as Error;
		}
		expect(thrown?.message).toContain(md);
		expect(thrown?.message).toContain(astro);
	});

	it("rejects an .astro file that resolves to the landing route (/)", () => {
		write("docs/index.astro", "<h1>Home</h1>\n");
		expect(() =>
			discoverContent(root, [entry({ base: "docs", files: ["**/*.astro"] })], undefined),
		).toThrowError(/landing page/);
	});
});

describe("discoverContent - landing page", () => {
	it("publishes the configured landing file at /", () => {
		const landing = write("docs/index.mdx", "---\ntitle: Splash\n---\nBody\n");
		write("docs/how-to/foo.md");
		const { routes } = discoverContent(root, [entry({ base: "docs" })], landing);
		expect(routes.get(landing)).toBe("/");
	});

	it("skips the landing file when a content glob also matches it, with a notice", () => {
		const landing = write("docs/index.md");
		write("docs/how-to/foo.md");
		const { routes, pages, notices } = discoverContent(root, [entry({ base: "docs" })], landing);
		expect(routes.get(landing)).toBe("/");
		expect(pages.filter((p) => p === landing)).toHaveLength(1);
		expect(notices).toHaveLength(1);
		expect(notices[0]).toContain("docs/index.md");
	});

	it("leaves / unclaimed when no landing is configured", () => {
		write("docs/how-to/foo.md");
		const { routes } = discoverContent(root, [entry({ base: "docs" })], undefined);
		expect([...routes.values()]).not.toContain("/");
	});

	it("errors when a content file collides with the landing page on /", () => {
		const landing = write("landing.md");
		const other = write("docs/index.md");
		let thrown: Error | undefined;
		try {
			discoverContent(root, [entry({ base: "docs" })], landing);
		} catch (err) {
			thrown = err as Error;
		}
		expect(thrown?.message).toContain(landing);
		expect(thrown?.message).toContain(other);
	});
});

describe("discoverContent - assets", () => {
	it("publishes only files matched by an assets glob", () => {
		write("docs/index.md");
		const png = write("docs/img/logo.png", "png");
		write("docs/img/notes.txt", "txt");
		const { assets } = discoverContent(
			root,
			[entry({ base: "docs", assets: ["**/*.png"] })],
			undefined,
		);
		expect([...assets.entries()]).toEqual([[png, "img/logo.png"]]);
	});

	it("publishes nothing when an entry has no assets glob", () => {
		write("docs/index.md");
		write("docs/img/logo.png", "png");
		const { assets } = discoverContent(root, [entry({ base: "docs" })], undefined);
		expect(assets.size).toBe(0);
	});

	it("publishes assets under the entry's route prefix", () => {
		write("pkg/foo/README.md");
		const png = write("pkg/foo/diagram.png", "png");
		const { assets } = discoverContent(
			root,
			[entry({ base: "pkg", files: ["*/README.md"], route: "packages", assets: ["**/*.png"] })],
			undefined,
		);
		expect(assets.get(png)).toBe("packages/foo/diagram.png");
	});

	it("never publishes md/mdx/astro as raw assets, even under a catch-all glob", () => {
		write("docs/index.md");
		write("docs/page.mdx", "body\n");
		write("docs/widget.astro", "<p/>\n");
		const png = write("docs/logo.png", "png");
		const { assets } = discoverContent(
			root,
			[entry({ base: "docs", files: ["**/*.md"], assets: ["**/*"] })],
			undefined,
		);
		expect([...assets.keys()]).toEqual([png]);
	});
});

describe("syncContent", () => {
	function makeCfg(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
		return {
			configPath: path.join(root, "docs.config.yaml"),
			configDir: root,
			out: path.join(root, "dist"),
			title: "Test",
			branch: "main",
			content: [entry({ base: "docs" })],
			...overrides,
		};
	}

	function withAppRoot(fn: (appRoot: string) => void): void {
		const appRoot = fs.mkdtempSync(path.join(os.tmpdir(), "docs-sync-app-test-"));
		try {
			fn(appRoot);
		} finally {
			fs.rmSync(appRoot, { recursive: true, force: true });
		}
	}

	it("copies an .astro file verbatim to astro-pages/, written under its route path", () => {
		write("docs/index.md");
		write("docs/how-to/demo.astro", "<h1>Demo</h1>\n<p>Raw markup, untouched.</p>\n");

		withAppRoot((appRoot) => {
			const result = syncContent(
				makeCfg({ content: [entry({ base: "docs", files: ["**/*.{md,astro}"] })] }),
				appRoot,
			);
			const outPath = path.join(appRoot, "src", "astro-pages", "how-to", "demo.astro");
			const written = fs.readFileSync(outPath, "utf8");
			expect(written).toBe("<h1>Demo</h1>\n<p>Raw markup, untouched.</p>\n");
			expect(written).not.toContain("sourcePath");
			expect(result.pageCount).toBe(2); // index.md + demo.astro
		});
	});

	it("wipes astro-pages/ on every sync, preserving nothing from a previous run", () => {
		write("docs/index.md");
		write("docs/how-to/demo.astro", "<h1>Demo</h1>\n");
		const cfg = makeCfg({ content: [entry({ base: "docs", files: ["**/*.{md,astro}"] })] });

		withAppRoot((appRoot) => {
			syncContent(cfg, appRoot);
			const staleDir = path.join(appRoot, "src", "astro-pages", "stale");
			fs.mkdirSync(staleDir, { recursive: true });
			fs.writeFileSync(path.join(staleDir, "old.astro"), "<p>old</p>\n");

			fs.rmSync(path.join(root, "docs", "how-to", "demo.astro"));
			syncContent(cfg, appRoot);

			expect(fs.existsSync(staleDir)).toBe(false);
			expect(fs.existsSync(path.join(appRoot, "src", "astro-pages", "how-to"))).toBe(false);
		});
	});

	it("publishes an asset to public/ under its route-prefixed path", () => {
		write("pkg/foo/README.md");
		write("pkg/foo/diagram.png", "png");

		withAppRoot((appRoot) => {
			const result = syncContent(
				makeCfg({
					content: [
						entry({
							base: "pkg",
							files: ["*/README.md"],
							route: "packages",
							assets: ["**/*.png"],
						}),
					],
				}),
				appRoot,
			);
			expect(result.assetCount).toBe(1);
			expect(fs.existsSync(path.join(appRoot, "public", "packages", "foo", "diagram.png"))).toBe(
				true,
			);
		});
	});

	it("does not ship .astro source to public/, even under a catch-all assets glob", () => {
		write("docs/index.md");
		write("docs/how-to/demo.astro", "<h1>Demo</h1>\n");

		withAppRoot((appRoot) => {
			syncContent(
				makeCfg({
					content: [entry({ base: "docs", files: ["**/*.{md,astro}"], assets: ["**/*"] })],
				}),
				appRoot,
			);
			expect(fs.existsSync(path.join(appRoot, "public", "how-to", "demo.astro"))).toBe(false);
		});
	});

	it("rewrites a markdown link to an .astro page to its site route", () => {
		write("docs/index.md");
		write("docs/how-to/demo.astro", "<h1>Demo</h1>\n");
		write("docs/how-to/guide.md", "# Guide\n\nSee [the demo](./demo.astro).\n");

		withAppRoot((appRoot) => {
			syncContent(
				makeCfg({ content: [entry({ base: "docs", files: ["**/*.{md,astro}"] })] }),
				appRoot,
			);
			const synced = fs.readFileSync(
				path.join(appRoot, "src", "content", "docs", "how-to", "guide.md"),
				"utf8",
			);
			expect(synced).toContain("(/how-to/demo/)");
		});
	});

	it("rewrites an image reference to its published asset path", () => {
		write("docs/how-to/guide.md", "# Guide\n\n![logo](../img/logo.png)\n");
		write("docs/img/logo.png", "png");

		withAppRoot((appRoot) => {
			const result = syncContent(
				makeCfg({ content: [entry({ base: "docs", assets: ["**/*.png"] })] }),
				appRoot,
			);
			const synced = fs.readFileSync(
				path.join(appRoot, "src", "content", "docs", "how-to", "guide.md"),
				"utf8",
			);
			expect(synced).toContain("(/img/logo.png)");
			expect(result.warnings).toEqual([]);
		});
	});

	it("warns naming the page and the asset when no assets glob covers a referenced file", () => {
		write("docs/how-to/guide.md", "# Guide\n\n![logo](../img/logo.png)\n");
		write("docs/img/logo.png", "png");

		withAppRoot((appRoot) => {
			const result = syncContent(makeCfg(), appRoot);
			expect(result.assetCount).toBe(0);
			expect(result.warnings).toHaveLength(1);
			expect(result.warnings[0]).toContain("docs/how-to/guide.md");
			expect(result.warnings[0]).toContain("logo.png");

			// Rewritten anyway, root-relative: a leftover relative url aborts Astro's build with
			// ImageNotFound, which would bury the warning above under a stack trace.
			const synced = fs.readFileSync(
				path.join(appRoot, "src", "content", "docs", "how-to", "guide.md"),
				"utf8",
			);
			expect(synced).toContain("(/docs/img/logo.png)");
		});
	});

	it("injects the config-relative source path into every synced page's frontmatter", () => {
		const landing = write("docs/index.mdx", "---\ntitle: Splash\n---\nBody\n");
		write("docs/how-to/foo.md", "# Foo\n\nBody.\n");

		withAppRoot((appRoot) => {
			syncContent(makeCfg({ landing }), appRoot);

			const synced = fs.readFileSync(
				path.join(appRoot, "src", "content", "docs", "how-to", "foo.md"),
				"utf8",
			);
			expect(synced).toContain("sourcePath: docs/how-to/foo.md");

			const index = fs.readFileSync(
				path.join(appRoot, "src", "content", "docs", "index.mdx"),
				"utf8",
			);
			expect(index).toContain("sourcePath: docs/index.mdx");
		});
	});
});
