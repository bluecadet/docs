import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	buildLlmsTxt,
	markdownUrl,
	pageToMarkdown,
	parseSidebar,
	writeLlmsFiles,
} from "../../app/src/lib/llms.js";

/** A built doc page, trimmed to the markup [...slug].astro and the rehype plugins produce. */
function docPage(body: string, description?: string): string {
	return `<!doctype html><html><head><title>CLI — Site</title>${
		description ? `<meta name="description" content="${description}">` : ""
	}</head><body><article class="prose" data-pagefind-body data-pagefind-meta="title:CLI"><h1>CLI</h1>${
		description ? `<p class="lead">${description}</p>` : ""
	}${body}</article></body></html>`;
}

describe("markdownUrl", () => {
	it("maps a directory route to a sibling .md file", () => {
		expect(markdownUrl("/reference/cli/")).toBe("/reference/cli.md");
	});

	it("maps the root to /index.md", () => {
		expect(markdownUrl("/")).toBe("/index.md");
	});
});

describe("pageToMarkdown", () => {
	it("heads the page with its title and description, not the article's own h1/lead", async () => {
		const page = await pageToMarkdown(docPage("<p>Body.</p>", "Lists every flag."));
		expect(page?.markdown).toBe("# CLI\n\n> Lists every flag.\n\nBody.\n");
	});

	it("omits the description line when the page has none", async () => {
		const page = await pageToMarkdown(docPage("<p>Body.</p>"));
		expect(page?.markdown).toBe("# CLI\n\nBody.\n");
	});

	it("returns undefined for a page with no data-pagefind-body", async () => {
		expect(await pageToMarkdown("<html><body><p>404</p></body></html>")).toBeUndefined();
	});

	it("strips heading anchors, the TOC disclosure, scripts and buttons", async () => {
		const page = await pageToMarkdown(
			docPage(
				`<details class="toc-disclosure"><summary>on this page</summary><a href="#flags">Flags</a></details>
				<script type="module">init()</script>
				<h2 id="flags" aria-label="Flags"><a class="heading-anchor" href="#flags" aria-label="Link to this section"></a>Flags</h2>
				<p>Text <button type="button">⧉</button><span aria-hidden="true">▾</span></p>`,
			),
		);
		expect(page?.markdown).toBe("# CLI\n\n## Flags\n\nText\n");
	});

	it("turns a Shiki block into a fenced block with its language and no copy bar", async () => {
		const page = await pageToMarkdown(
			docPage(
				`<div class="code-block"><div class="code-block-header"><span class="code-block-lang">sh</span><button type="button" class="code-copy">copy</button></div><pre class="astro-code" data-language="sh"><code><span class="line"><span>npx</span><span> docs</span></span>
<span class="line"><span>ls</span></span></code></pre></div>`,
			),
		);
		expect(page?.markdown).toBe("# CLI\n\n```sh\nnpx docs\nls\n```\n");
	});

	it("leaves a plaintext block's fence bare", async () => {
		const page = await pageToMarkdown(
			docPage(`<pre class="astro-code" data-language="plaintext"><code>hi</code></pre>`),
		);
		expect(page?.markdown).toBe("# CLI\n\n```\nhi\n```\n");
	});

	it("restores a callout as a GitHub alert from its original keyword", async () => {
		const page = await pageToMarkdown(
			docPage(
				`<div class="callout callout--attention" data-alert="WARNING"><div class="callout-label">HEADS UP</div><div class="callout-body"><p>Careful.</p></div></div>`,
			),
		);
		expect(page?.markdown).toBe("# CLI\n\n> [!WARNING]\n> Careful.\n");
	});

	it("keeps tables as GFM tables", async () => {
		const page = await pageToMarkdown(
			docPage(
				`<div class="table-wrap"><table><thead><tr><th>Flag</th></tr></thead><tbody><tr><td data-label="Flag"><code>--out</code></td></tr></tbody></table></div>`,
			),
		);
		expect(page?.markdown).toBe("# CLI\n\n| Flag    |\n| ------- |\n| `--out` |\n");
	});
});

describe("parseSidebar", () => {
	const sidebar = (inner: string) =>
		`<html><body><nav id="sidebar-nav"><div class="sidebar-list">${inner}</div><div class="sidebar-meta">v1</div></nav></body></html>`;

	it("opens a section per root group, in sidebar order", () => {
		const sections = parseSidebar(
			sidebar(
				`<div class="sidebar-label">Tutorials/</div>
				<div class="sidebar-list"><a class="sidebar-item" href="/tutorials/start/">Start</a></div>
				<a class="sidebar-item sidebar-item--section" href="/reference/">Reference</a>
				<div class="sidebar-list is-nested"><a class="sidebar-item" href="/reference/cli/">CLI</a></div>`,
			),
		);
		expect(sections).toEqual([
			{ title: "Tutorials", links: [{ title: "Start", url: "/tutorials/start/" }] },
			{
				title: "Reference",
				links: [
					{ title: "Reference", url: "/reference/" },
					{ title: "CLI", url: "/reference/cli/" },
				],
			},
		]);
	});

	it("collects root-level pages under Docs", () => {
		const sections = parseSidebar(
			sidebar(
				`<a class="sidebar-item" href="/changelog/">Changelog</a><a class="sidebar-item" href="/start/">Start</a>`,
			),
		);
		expect(sections).toEqual([
			{
				title: "Docs",
				links: [
					{ title: "Changelog", url: "/changelog/" },
					{ title: "Start", url: "/start/" },
				],
			},
		]);
	});

	it("lists a nested group that links to its first page only once", () => {
		const sections = parseSidebar(
			sidebar(
				`<div class="sidebar-label">Guides/</div>
				<div class="sidebar-list"><a class="sidebar-item" href="/guides/a/">Advanced</a><div class="sidebar-list is-nested"><a class="sidebar-item" href="/guides/a/">A</a><a class="sidebar-item" href="/guides/b/">B</a></div></div>`,
			),
		);
		expect(sections[0]?.links.map((link) => link.url)).toEqual(["/guides/a/", "/guides/b/"]);
	});
});

describe("buildLlmsTxt", () => {
	it("renders the llmstxt.org layout", () => {
		const txt = buildLlmsTxt("Site", "What it is.", [
			{
				title: "Reference",
				links: [
					{ title: "CLI", url: "https://example.com/reference/cli.md", description: "Flags." },
					{ title: "Search", url: "https://example.com/reference/search.md" },
				],
			},
		]);
		expect(txt).toBe(
			"# Site\n\n> What it is.\n\n## Reference\n\n- [CLI](https://example.com/reference/cli.md): Flags.\n- [Search](https://example.com/reference/search.md)\n",
		);
	});

	it("omits the summary when there is none", () => {
		expect(buildLlmsTxt("Site", undefined, [])).toBe("# Site\n");
	});
});

describe("writeLlmsFiles", () => {
	let outDir: string;

	beforeEach(() => {
		outDir = fs.mkdtempSync(path.join(os.tmpdir(), "docs-llms-test-"));
	});

	afterEach(() => {
		fs.rmSync(outDir, { recursive: true, force: true });
	});

	function write(relPath: string, content: string): void {
		const abs = path.join(outDir, relPath);
		fs.mkdirSync(path.dirname(abs), { recursive: true });
		fs.writeFileSync(abs, content);
	}

	/** A built landing page with `data-pagefind-body` (real landing, not a redirect). */
	const landingHtml = `<!doctype html><html><head><title>My Docs</title><meta name="description" content="All the docs."></head><body><div class="landing-body" data-pagefind-body data-pagefind-meta="title:My Docs"><p>Welcome.</p></div></body></html>`;

	/** A no-landing redirect — no `data-pagefind-body`, so `convertPage` returns undefined. */
	const redirectHtml =
		"<!doctype html><html><head><title>My Docs</title></head><body><p>Redirecting</p></body></html>";

	/** A built doc page with a sidebar. */
	const cliHtml =
		`<!doctype html><html><head><title>CLI — My Docs</title><meta name="description" content="All CLI flags."></head><body>` +
		`<nav id="sidebar-nav"><div class="sidebar-list"><a class="sidebar-item" href="/reference/cli/">CLI</a></div></nav>` +
		`<article class="prose" data-pagefind-body data-pagefind-meta="title:CLI"><h1>CLI</h1><p>Flags.</p></article></body></html>`;

	it("writes index.md for a real landing page", async () => {
		write("index.html", landingHtml);
		write("reference/cli/index.html", cliHtml);
		await writeLlmsFiles({ outDir, title: "My Docs" });
		expect(fs.existsSync(path.join(outDir, "index.md"))).toBe(true);
		const md = fs.readFileSync(path.join(outDir, "index.md"), "utf8");
		expect(md).toMatch(/^# My Docs\n/);
	});

	it("does not write index.md for a no-landing redirect", async () => {
		write("index.html", redirectHtml);
		write("reference/cli/index.html", cliHtml);
		await writeLlmsFiles({ outDir, title: "My Docs" });
		expect(fs.existsSync(path.join(outDir, "index.md"))).toBe(false);
	});

	it("uses the landing description as the llms.txt summary and omits the landing from navigation", async () => {
		write("index.html", landingHtml);
		write("reference/cli/index.html", cliHtml);
		await writeLlmsFiles({ outDir, title: "My Docs" });
		const txt = fs.readFileSync(path.join(outDir, "llms.txt"), "utf8");
		expect(txt).toContain("> All the docs.");
		expect(txt).not.toContain("/index.md");
	});

	it("excludes the landing page from llms-full.txt", async () => {
		write("index.html", landingHtml);
		write("reference/cli/index.html", cliHtml);
		await writeLlmsFiles({ outDir, title: "My Docs" });
		const full = fs.readFileSync(path.join(outDir, "llms-full.txt"), "utf8");
		expect(full).not.toContain("Welcome.");
		expect(full).toContain("# CLI");
	});

	it("counts index.md in the returned page count when a landing page is present", async () => {
		write("index.html", landingHtml);
		write("reference/cli/index.html", cliHtml);
		const count = await writeLlmsFiles({ outDir, title: "My Docs" });
		expect(count).toBe(2);
	});

	it("does not count the redirect in the returned page count when no landing is configured", async () => {
		write("index.html", redirectHtml);
		write("reference/cli/index.html", cliHtml);
		const count = await writeLlmsFiles({ outDir, title: "My Docs" });
		expect(count).toBe(1);
	});
});
