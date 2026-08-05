import { describe, expect, it } from "vitest";
import type { RewriteContext } from "../links.js";
import { transformMarkdown } from "../links.js";
import type { RouteMap } from "../types.js";

const REPO_ROOT = "/repo";
const DOCS_DIR = "/repo/docs";

function makeCtx(overrides: Partial<RewriteContext> = {}): RewriteContext {
	return {
		fromAbsDir: DOCS_DIR,
		fromLabel: "docs/index.md",
		routes: new Map(),
		docsDir: DOCS_DIR,
		repoRoot: REPO_ROOT,
		repoUrl: undefined,
		branch: "main",
		base: "/",
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

	it("rewrites a reference-style image definition to a published asset path", () => {
		const ctx = makeCtx();
		const raw = ["![a diagram][diagram-ref]", "", "[diagram-ref]: ./assets/diagram.png"].join("\n");
		const { body, assets } = transformMarkdown(raw, ctx, undefined);
		expect(body).toContain("/assets/diagram.png");
		expect(assets).toEqual([{ from: "/repo/docs/assets/diagram.png", to: "assets/diagram.png" }]);
	});
});

describe("transformMarkdown - raw HTML", () => {
	it("rewrites <img src> and <a href> inside a raw HTML block (double-quoted)", () => {
		const routes: RouteMap = new Map([["/repo/docs/how-to/install.md", "/how-to/install/"]]);
		const ctx = makeCtx({ routes });
		const raw = [
			'<p align="center">',
			'  <img src="assets/header.gif" alt="header" />',
			'  <a href="./how-to/install.md">Install</a>',
			"</p>",
		].join("\n");
		const { body, assets } = transformMarkdown(raw, ctx, undefined);
		expect(body).toContain('src="/assets/header.gif"');
		expect(body).toContain('href="/how-to/install/"');
		expect(assets).toEqual([{ from: "/repo/docs/assets/header.gif", to: "assets/header.gif" }]);
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

describe("transformMarkdown - base path prefixing", () => {
	it("prefixes a resolved doc-to-doc link with the configured base", () => {
		const routes: RouteMap = new Map([["/repo/docs/reference/config.md", "/reference/config/"]]);
		const { body } = transformMarkdown(
			"[cfg](reference/config.md)",
			makeCtx({ routes, base: "/launchpad/" }),
			undefined,
		);
		expect(body).toContain("(/launchpad/reference/config/)");
	});

	it("prefixes a resolved asset path with the configured base", () => {
		const { body } = transformMarkdown(
			"![alt](assets/x.png)",
			makeCtx({ base: "/launchpad/" }),
			undefined,
		);
		expect(body).toContain("(/launchpad/assets/x.png)");
	});

	it("treats a hand-authored root-relative link as site-root-relative and base-prefixes it", () => {
		const { body } = transformMarkdown(
			"[abs](/how-to/foo/)",
			makeCtx({ base: "/launchpad/" }),
			undefined,
		);
		expect(body).toContain("(/launchpad/how-to/foo/)");
	});

	it("treats a hand-authored root-relative image as site-root-relative and base-prefixes it", () => {
		const { body } = transformMarkdown(
			"![alt](/assets/x.png)",
			makeCtx({ base: "/launchpad/" }),
			undefined,
		);
		expect(body).toContain("(/launchpad/assets/x.png)");
	});

	it("base-prefixes a root-relative href inside raw HTML", () => {
		const { body } = transformMarkdown(
			'<a href="/how-to/foo/">Foo</a>',
			makeCtx({ base: "/launchpad/" }),
			undefined,
		);
		expect(body).toContain('href="/launchpad/how-to/foo/"');
	});

	it('does not double-prefix when base is the default "/"', () => {
		const { body } = transformMarkdown("[abs](/how-to/foo/)", makeCtx({ base: "/" }), undefined);
		expect(body).toContain("(/how-to/foo/)");
	});

	it("does not prefix a protocol-relative URL", () => {
		const { body } = transformMarkdown(
			"![alt](//cdn.example.com/x.png)",
			makeCtx({ base: "/launchpad/" }),
			undefined,
		);
		expect(body).toContain("(//cdn.example.com/x.png)");
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
