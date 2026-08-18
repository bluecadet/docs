import { describe, expect, it } from "vitest";
import type { RewriteContext } from "../links.js";
import { transformMarkdown } from "../links.js";
import type { AssetMap, RouteMap } from "../types.js";

const CONFIG_DIR = "/repo";
const DOCS_DIR = "/repo/docs";

function makeCtx(overrides: Partial<RewriteContext> = {}): RewriteContext {
	return {
		fromAbsDir: DOCS_DIR,
		fromLabel: "docs/index.md",
		routes: new Map(),
		assets: new Map(),
		configDir: CONFIG_DIR,
		repoUrl: undefined,
		branch: "main",
		...overrides,
	};
}

describe("transformMarkdown - relative link resolution", () => {
	it("resolves a link across nested directories", () => {
		const routes: RouteMap = new Map([["/repo/docs/reference/foo.md", "/reference/foo/"]]);
		const ctx = makeCtx({ fromAbsDir: "/repo/docs/how-to", routes });
		const { body } = transformMarkdown("[foo](../reference/foo.md)", ctx, undefined);
		expect(body).toContain("(/reference/foo/)");
	});

	it("resolves a link that traverses out of docs/ into a monorepo content-glob file", () => {
		const routes: RouteMap = new Map([["/repo/Packages/foo/README.md", "/packages/foo/"]]);
		const ctx = makeCtx({ fromAbsDir: "/repo/docs/how-to", routes });
		const { body } = transformMarkdown("[foo pkg](../../Packages/foo/README.md)", ctx, undefined);
		expect(body).toContain("(/packages/foo/)");
	});

	it("resolves an index.md file up to its parent directory route", () => {
		const routes: RouteMap = new Map([["/repo/docs/reference/index.md", "/reference/"]]);
		const ctx = makeCtx({ fromAbsDir: DOCS_DIR, routes });
		const { body } = transformMarkdown("[ref](reference/index.md)", ctx, undefined);
		expect(body).toContain("(/reference/)");
	});
});

describe("transformMarkdown - reference-style links/images", () => {
	it("rewrites a reference-style link definition", () => {
		const routes: RouteMap = new Map([["/repo/docs/how-to/install.md", "/how-to/install/"]]);
		const ctx = makeCtx({ routes });
		const raw = ["[install guide][install-ref]", "", "[install-ref]: ./how-to/install.md"].join(
			"\n",
		);
		const { body } = transformMarkdown(raw, ctx, undefined);
		expect(body).toContain("/how-to/install/");
	});

	it("rewrites a reference-style image definition to its published asset path", () => {
		const assets: AssetMap = new Map([["/repo/docs/assets/diagram.png", "assets/diagram.png"]]);
		const ctx = makeCtx({ assets });
		const raw = ["![a diagram][diagram-ref]", "", "[diagram-ref]: ./assets/diagram.png"].join("\n");
		const { body, warnings } = transformMarkdown(raw, ctx, undefined);
		expect(body).toContain("/assets/diagram.png");
		expect(warnings).toEqual([]);
	});
});

describe("transformMarkdown - asset publishing", () => {
	it("rewrites an image to the single path its assets glob published it at", () => {
		const assets: AssetMap = new Map([["/repo/docs/img/x.png", "packages/foo/img/x.png"]]);
		const { body, warnings } = transformMarkdown(
			"![alt](img/x.png)",
			makeCtx({ assets }),
			undefined,
		);
		expect(body).toContain("(/packages/foo/img/x.png)");
		expect(warnings).toEqual([]);
	});

	it("warns naming the page and the file when no assets glob published it", () => {
		const { warnings } = transformMarkdown("![alt](img/x.png)", makeCtx(), undefined);
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain("docs/index.md");
		expect(warnings[0]).toContain("/repo/docs/img/x.png");
	});

	it("still rewrites an unpublished asset to a root-relative path, so Astro can finish the build", () => {
		// A relative url here would make Astro resolve it against its own content dir and abort with
		// ImageNotFound; a "/"-rooted one is treated as a public-dir path and left alone.
		const { body } = transformMarkdown("![alt](img/x.png)", makeCtx(), undefined);
		expect(body).toContain("(/docs/img/x.png)");
	});

	it("leaves an unpublished asset outside the config directory untouched", () => {
		const ctx = makeCtx({ fromAbsDir: "/repo" });
		const { body, warnings } = transformMarkdown("![alt](../outside/x.png)", ctx, undefined);
		expect(body).toContain("(../outside/x.png)");
		expect(warnings).toHaveLength(1);
	});

	it("preserves a query string on a published asset path", () => {
		const assets: AssetMap = new Map([["/repo/docs/img/x.png", "img/x.png"]]);
		const { body } = transformMarkdown(
			"[full size](img/x.png?w=2000)",
			makeCtx({ assets }),
			undefined,
		);
		expect(body).toContain("(/img/x.png?w=2000)");
	});
});

describe("transformMarkdown - raw HTML", () => {
	it("rewrites <img src> and <a href> inside a raw HTML block (double-quoted)", () => {
		const routes: RouteMap = new Map([["/repo/docs/how-to/install.md", "/how-to/install/"]]);
		const assets: AssetMap = new Map([["/repo/docs/assets/header.gif", "assets/header.gif"]]);
		const ctx = makeCtx({ routes, assets });
		const raw = [
			'<p align="center">',
			'  <img src="assets/header.gif" alt="header" />',
			'  <a href="./how-to/install.md">Install</a>',
			"</p>",
		].join("\n");
		const { body, warnings } = transformMarkdown(raw, ctx, undefined);
		expect(body).toContain('src="/assets/header.gif"');
		expect(body).toContain('href="/how-to/install/"');
		expect(warnings).toEqual([]);
	});

	it("does not rewrite single-quoted HTML attributes (documented limitation)", () => {
		const routes: RouteMap = new Map([["/repo/docs/how-to/install.md", "/how-to/install/"]]);
		const ctx = makeCtx({ routes });
		const raw = "<a href='./how-to/install.md'>Install</a>";
		const { body } = transformMarkdown(raw, ctx, undefined);
		expect(body).toContain("href='./how-to/install.md'");
	});
});

describe("transformMarkdown - anchors and query strings", () => {
	const routes: RouteMap = new Map([["/repo/docs/reference/config.md", "/reference/config/"]]);

	it("preserves a hash fragment", () => {
		const { body } = transformMarkdown(
			"[cfg](reference/config.md#section)",
			makeCtx({ routes }),
			undefined,
		);
		expect(body).toContain("(/reference/config/#section)");
	});

	it("preserves a query string", () => {
		const { body } = transformMarkdown(
			"[cfg](reference/config.md?x=1)",
			makeCtx({ routes }),
			undefined,
		);
		expect(body).toContain("(/reference/config/?x=1)");
	});

	it("preserves a query string and hash fragment together, in order", () => {
		const { body } = transformMarkdown(
			"[cfg](reference/config.md?x=1#section)",
			makeCtx({ routes }),
			undefined,
		);
		expect(body).toContain("(/reference/config/?x=1#section)");
	});
});

describe("transformMarkdown - out-of-tree links", () => {
	it("rewrites an unresolvable link to a GitHub blob URL when repoUrl is known", () => {
		const ctx = makeCtx({ repoUrl: "https://github.com/example/repo", branch: "main" });
		const { body, warnings } = transformMarkdown("[license](../LICENSE)", ctx, undefined);
		expect(body).toContain("(https://github.com/example/repo/blob/main/LICENSE)");
		expect(warnings).toEqual([]);
	});

	it("preserves a hash fragment on a GitHub blob URL", () => {
		const ctx = makeCtx({ repoUrl: "https://github.com/example/repo", branch: "main" });
		const { body } = transformMarkdown("[license](../LICENSE#section)", ctx, undefined);
		expect(body).toContain("(https://github.com/example/repo/blob/main/LICENSE#section)");
	});

	it("unwraps an unresolvable link to plain text when no repoUrl is configured", () => {
		const ctx = makeCtx({ repoUrl: undefined });
		const { body, warnings } = transformMarkdown(
			"See [notes](../NOTES.md) for context.",
			ctx,
			undefined,
		);
		expect(body).toBe("See notes for context.");
		expect(warnings).toEqual(["docs/index.md: unresolved link -> ../NOTES.md"]);
	});
});

describe("transformMarkdown - title extraction", () => {
	it("lifts the first h1 into the title and strips it from the body", () => {
		const { title, body } = transformMarkdown(
			"# My Title\n\nSome body text.",
			makeCtx(),
			undefined,
		);
		expect(title).toBe("My Title");
		expect(body).not.toContain("# My Title");
		expect(body).toContain("Some body text.");
	});

	it("prefers an existing frontmatter title over the h1", () => {
		const { title, body } = transformMarkdown("# My Title\n\nBody.", makeCtx(), "Existing Title");
		expect(title).toBe("Existing Title");
		expect(body).toContain("# My Title");
	});
});
