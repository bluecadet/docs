// LLM-friendly copies of the built site: a Markdown twin of every page (`/foo/bar/` ->
// `/foo/bar.md`), an llms.txt index (https://llmstxt.org) in sidebar order, and llms-full.txt, every
// page's Markdown concatenated in that same order. Run from astro.config.mjs's `astro:build:done`.
//
// Everything is derived from the *built HTML*, not the source md/mdx: MDX components, `.astro`
// pages and sync's link rewriting have all already resolved to plain markup there, so one
// HTML -> Markdown pass covers every page kind identically. The sidebar order comes from the
// rendered sidebar for the same reason — nav.ts's tree lives behind `astro:content`, which isn't
// reachable from an integration hook.
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Element, ElementContent, Root } from "hast";
import { select, selectAll } from "hast-util-select";
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { textContent } from "./hast-text.js";

/**
 * Page chrome inside `data-pagefind-body` with no place in a text copy: heading "#" anchors, the
 * code-block language/copy bar, the mobile "on this page" disclosure, the lead (re-emitted as the
 * `> description` line), and anything interactive or explicitly decorative.
 */
const CHROME = [
	"script",
	"style",
	"template",
	"button",
	"[aria-hidden='true']",
	".heading-anchor",
	".code-block-header",
	".toc-disclosure",
	"p.lead",
].join(", ");

/** Shiki's name for a fence with no language — dropped rather than emitted as ```plaintext. */
const NO_LANGUAGE = new Set(["plaintext", "text", "txt"]);

const htmlParser = unified().use(rehypeParse);
const toMarkdown = unified()
	.use(rehypeRemark)
	.use(remarkGfm)
	.use(remarkStringify, { bullet: "-", fences: true, listItemIndent: "one", rule: "-" });

/** `/foo/bar/` -> `/foo/bar.md`, `/` -> `/index.md`. The one URL scheme every output shares. */
export function markdownUrl(pathname: string): string {
	return `${pathname.replace(/\/$/, "") || "/index"}.md`;
}

export interface PageMarkdown {
	title: string;
	description?: string;
	markdown: string;
}

/**
 * Converts one built page to Markdown: its `data-pagefind-body` content, headed by `# Title` and a
 * `> description` line. Undefined for pages with no such body (404, raw astro pages, the
 * no-landing redirect) — the same rule that keeps them out of the search index.
 */
export async function pageToMarkdown(html: string): Promise<PageMarkdown | undefined> {
	return convertPage(htmlParser.parse(html));
}

async function convertPage(tree: Root): Promise<PageMarkdown | undefined> {
	const body = select("[data-pagefind-body]", tree);
	if (!body) return undefined;

	// The page's own title, as pinned for search — not <title>, which carries the site name.
	const meta = String(body.properties.dataPagefindMeta ?? "");
	const title = meta.startsWith("title:") ? meta.slice("title:".length) : textContent(body).trim();
	const content = select("meta[name='description']", tree)?.properties.content;
	const description = typeof content === "string" && content ? content : undefined;

	// The article's own first <h1> is the title, re-emitted above.
	removeNodes(body, [...selectAll(CHROME, body), select("h1", body)]);
	rewriteCodeBlocks(body);
	rewriteCallouts(body);

	const mdast = await toMarkdown.run({ type: "root", children: body.children });
	const markdown = toMarkdown
		.stringify(mdast as Parameters<typeof toMarkdown.stringify>[0])
		// The `[!NOTE]` marker is plain text to remark-stringify, which escapes its bracket.
		.replace(/^> \\\[!(\w+)\]\n>\n/gm, "> [!$1]\n")
		.trim();

	const head = [`# ${title}`, ...(description ? [`> ${description}`] : [])].join("\n\n");
	return { title, description, markdown: markdown ? `${head}\n\n${markdown}\n` : `${head}\n` };
}

function removeNodes(root: Element, nodes: (Element | undefined)[]): void {
	const doomed = new Set<ElementContent | undefined>(nodes);
	visit(root, "element", (node: Element) => {
		node.children = node.children.filter((child) => !doomed.has(child));
	});
}

/**
 * Shiki puts the language on the `<pre>` (`data-language`); hast-util-to-mdast reads it from the
 * `<code>` child's `language-*` class, which is where plain markdown output would have it.
 */
function rewriteCodeBlocks(root: Element): void {
	for (const pre of selectAll("pre[data-language]", root)) {
		const lang = String(pre.properties.dataLanguage);
		const code = select("code", pre);
		if (code && !NO_LANGUAGE.has(lang)) code.properties.className = [`language-${lang}`];
	}
}

/**
 * Turns remark-alerts.ts's callouts back into GitHub alert blockquotes, keyed off the original
 * keyword it records in `data-alert` (the visible label collapses three of them into "HEADS UP").
 */
function rewriteCallouts(root: Element): void {
	for (const callout of selectAll(".callout[data-alert]", root)) {
		const marker: Element = {
			type: "element",
			tagName: "p",
			properties: {},
			children: [{ type: "text", value: `[!${String(callout.properties.dataAlert)}]` }],
		};
		callout.tagName = "blockquote";
		callout.properties = {};
		callout.children = [marker, ...(select(".callout-body", callout)?.children ?? [])];
	}
}

export interface LlmsLink {
	title: string;
	url: string;
	description?: string;
}

export interface LlmsSection {
	title: string;
	links: LlmsLink[];
}

/** The `# title`, `> summary`, `## section` / `- [title](url): description` llms.txt layout. */
export function buildLlmsTxt(title: string, summary: string | undefined, sections: LlmsSection[]) {
	const blocks = [`# ${title}`];
	if (summary) blocks.push(`> ${summary}`);
	for (const section of sections) {
		const links = section.links.map(
			(link) => `- [${link.title}](${link.url})${link.description ? `: ${link.description}` : ""}`,
		);
		blocks.push(`## ${section.title}\n\n${links.join("\n")}`);
	}
	return `${blocks.join("\n\n")}\n`;
}

/** Section name for sidebar pages that sit at the root, outside any group. */
const UNGROUPED = "Docs";
/** llmstxt.org's name for links a reader may skip — here, published pages the sidebar omits. */
const UNLISTED = "Optional";

/**
 * Reads the sidebar's sections from a built page's `#sidebar-nav` (see SidebarNav.astro): a root
 * `.sidebar-label` (or `.sidebar-item--section`, when the group has its own page) opens a section,
 * every link in the nested list after it belongs to that section, and root-level pages outside any
 * group collect under "Docs". Returns hrefs; the caller maps them to Markdown URLs.
 */
export function parseSidebar(html: string): LlmsSection[] {
	return sidebarSections(htmlParser.parse(html));
}

function sidebarSections(tree: Root): LlmsSection[] {
	const root = select("#sidebar-nav > .sidebar-list", tree);
	if (!root) return [];

	const sections: LlmsSection[] = [];
	// A nested group with no page of its own links to its first descendant, so hrefs repeat.
	const seen = new Set<string>();
	let current: LlmsSection | undefined;
	const add = (link: Element) => {
		const url = String(link.properties.href);
		if (seen.has(url)) return;
		seen.add(url);
		if (!current) {
			current = { title: UNGROUPED, links: [] };
			sections.push(current);
		}
		current.links.push({ title: textContent(link).trim(), url });
	};

	for (const node of root.children) {
		if (node.type !== "element") continue;
		const classes = (node.properties.className as string[] | undefined) ?? [];
		if (classes.includes("sidebar-label") || classes.includes("sidebar-item--section")) {
			current = { title: textContent(node).trim().replace(/\/$/, ""), links: [] };
			sections.push(current);
			if (node.tagName === "a") add(node);
		} else if (node.tagName === "a") {
			if (current?.title !== UNGROUPED) current = undefined;
			add(node);
		} else {
			for (const link of selectAll("a[href]", node)) add(link);
		}
	}
	return sections.filter((section) => section.links.length > 0);
}

interface WriteOptions {
	/** Astro's output directory. */
	outDir: string;
	/** Site title, for llms.txt's H1. */
	title: string;
	/** Absolute site root (with trailing slash), when `site` is configured. */
	rootUrl?: string;
}

/** Writes every page's `.md`, then llms.txt and llms-full.txt. Returns the page count. */
export async function writeLlmsFiles({ outDir, title, rootUrl }: WriteOptions): Promise<number> {
	const htmlFiles = (await readdir(outDir, { recursive: true }))
		.filter((file) => file.endsWith(".html"))
		.sort();

	const pages = new Map<string, PageMarkdown>();
	let sections: LlmsSection[] = [];
	let summary: string | undefined;
	let landingWritten = false;
	for (const file of htmlFiles) {
		const tree = htmlParser.parse(await readFile(path.join(outDir, file), "utf8"));
		const page = await convertPage(tree);
		if (!page) continue;

		const pathname = `/${file.split(path.sep).join("/")}`.replace(/index\.html$/, "");
		// The landing page writes index.md and supplies llms.txt's summary line, but stays
		// out of the sidebar navigation listing and llms-full.txt.
		if (pathname === "/") {
			summary = page.description;
			await writeFile(path.join(outDir, markdownUrl(pathname).slice(1)), page.markdown, "utf8");
			landingWritten = true;
			continue;
		}
		if (sections.length === 0) sections = sidebarSections(tree);

		pages.set(pathname, page);
		await writeFile(path.join(outDir, markdownUrl(pathname).slice(1)), page.markdown, "utf8");
	}

	const listed = new Set(sections.flatMap((section) => section.links.map((link) => link.url)));
	const unlisted = [...pages.keys()].filter((pathname) => !listed.has(pathname));
	if (unlisted.length > 0) {
		sections.push({
			title: UNLISTED,
			links: unlisted.map((url) => ({ title: (pages.get(url) as PageMarkdown).title, url })),
		});
	}

	const toUrl = (pathname: string) =>
		rootUrl ? new URL(markdownUrl(pathname).slice(1), rootUrl).href : markdownUrl(pathname);
	const ordered = sections.map((section) => ({
		title: section.title,
		links: section.links.flatMap((link) => {
			const page = pages.get(link.url);
			return page ? [{ ...link, url: toUrl(link.url), description: page.description }] : [];
		}),
	}));

	await writeFile(path.join(outDir, "llms.txt"), buildLlmsTxt(title, summary, ordered), "utf8");
	const full = sections.flatMap((section) =>
		section.links.flatMap((link) => pages.get(link.url)?.markdown ?? []),
	);
	await writeFile(path.join(outDir, "llms-full.txt"), full.join("\n"), "utf8");

	return pages.size + (landingWritten ? 1 : 0);
}
