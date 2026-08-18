import path from "node:path";
import type { Definition, Heading, Image, Link, Root } from "mdast";
import { toString as mdastToString } from "mdast-util-to-string";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import type { Parent } from "unist";
import { visit } from "unist-util-visit";
import { toPosix } from "./path-utils.js";
import type { AssetMap, RouteMap } from "./types.js";

const IMAGE_EXT = /\.(png|jpe?g|gif|svg|webp|avif|ico|bmp)$/i;
// External schemes ("https:", "mailto:") and bare fragments ("#x") — never touched.
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|#)/i;

export interface RewriteContext {
	/** Directory the source markdown file lives in; relative links resolve against this. */
	fromAbsDir: string;
	/** Path relative to the config file's directory, for warning messages. */
	fromLabel: string;
	routes: RouteMap;
	/** Every published asset, keyed by absolute source path (see `AssetMap`). */
	assets: AssetMap;
	/** Directory holding `docs.config.yaml`; GitHub blob URLs are built relative to it. */
	configDir: string;
	repoUrl: string | undefined;
	branch: string;
	/** Deployed base path, e.g. "/launchpad/". Defaults to "/". */
	base: string;
}

export interface TransformResult {
	title: string | undefined;
	body: string;
	warnings: string[];
}

const processor = unified()
	.use(remarkParse)
	.use(remarkGfm)
	.use(remarkStringify, { bullet: "-", fences: true, incrementListMarker: true });

/**
 * Parses a markdown body, optionally lifts the title out of the first `#` heading, and rewrites
 * relative links/images to site routes or asset paths. Reference-style links/images are handled
 * via `definition` nodes. Raw HTML `<img src>`/`<a href>` (double-quoted only) get a best-effort
 * regex pass since they aren't part of the markdown AST.
 */
export function transformMarkdown(
	raw: string,
	ctx: RewriteContext,
	existingTitle: string | undefined,
): TransformResult {
	const tree = processor.parse(raw) as Root;
	const warnings: string[] = [];

	let title = existingTitle;
	if (!title) {
		const idx = tree.children.findIndex((n) => n.type === "heading" && (n as Heading).depth === 1);
		if (idx !== -1) {
			title = mdastToString(tree.children[idx]).trim();
			tree.children.splice(idx, 1);
		}
	}

	rewriteTree(tree, ctx, warnings);

	const body = processor.stringify(tree).trim();
	return { title, body, warnings };
}

function rewriteTree(tree: Root, ctx: RewriteContext, warnings: string[]): void {
	visit(tree, "image", (node) => {
		const image = node as Image;
		image.url = resolveAsset(image.url, ctx, warnings);
	});

	// Reference-style links/images (`[text][id]` + `[id]: url`) carry their url on the
	// `definition` node. We can't tell here whether `id` is used as a link or an image, so we
	// fall back to the extension heuristic used elsewhere in this file.
	visit(tree, "definition", (node) => {
		const def = node as Definition;
		def.url = resolveLinkOrAsset(def.url, ctx, warnings);
	});

	visit(tree, "html", (node) => {
		const html = node as { type: "html"; value: string };
		html.value = rewriteRawHtml(html.value, ctx, warnings);
	});

	visit(tree, "link", (node, index, parent) => {
		const link = node as Link;
		if (EXTERNAL.test(link.url)) return;
		if (isRootRelative(link.url)) {
			link.url = withBase(link.url, ctx.base);
			return;
		}
		if (IMAGE_EXT.test(splitUrl(link.url).pathPart)) {
			link.url = resolveAsset(link.url, ctx, warnings);
			return;
		}
		const resolved = resolveDocLink(link.url, ctx, warnings);
		if (resolved) {
			link.url = resolved;
			return;
		}
		// Unresolvable and no repoUrl to fall back to: drop the hyperlink, keep the text.
		if (parent && typeof index === "number") {
			(parent as Parent).children.splice(index, 1, ...link.children);
			return index;
		}
	});
}

/** Resolves a relative doc-to-doc link to its site route, or a GitHub blob URL, or `null`. */
function resolveDocLink(rawUrl: string, ctx: RewriteContext, warnings: string[]): string | null {
	const { pathPart, suffix } = splitUrl(rawUrl);
	const abs = path.resolve(ctx.fromAbsDir, pathPart);
	const route = ctx.routes.get(abs);
	if (route) return withBase(route, ctx.base) + suffix;
	if (ctx.repoUrl) {
		const relFromRoot = toPosix(path.relative(ctx.configDir, abs));
		if (!relFromRoot.startsWith("..")) {
			return `${ctx.repoUrl}/blob/${ctx.branch}/${relFromRoot}${suffix}`;
		}
	}
	warnings.push(`${ctx.fromLabel}: unresolved link -> ${rawUrl}`);
	return null;
}

/**
 * Rewrites a relative asset reference to the path the asset is actually published at. Publishing is
 * driven entirely by the `assets` globs in `docs.config.yaml`, so this is a lookup: an asset no glob
 * covers has no published path to point at, and gets a warning naming the page and the file rather
 * than a silently broken `<img>`.
 *
 * An unpublished asset is still rewritten, to the site-root path it *would* occupy. Leaving the
 * original relative url in place is not an option: Astro resolves relative image urls in synced
 * markdown against its own content directory and aborts the whole build with `ImageNotFound`, so a
 * missing `assets:` glob would surface as a stack trace from deep inside Astro instead of the
 * warning above. A `/`-rooted url is treated as a public-dir path and left alone, which keeps the
 * build finishing and leaves one visibly-broken image plus a warning that says what to add.
 */
function resolveAsset(rawUrl: string, ctx: RewriteContext, warnings: string[]): string {
	if (EXTERNAL.test(rawUrl) || rawUrl.startsWith("data:")) return rawUrl;
	if (isRootRelative(rawUrl)) return withBase(rawUrl, ctx.base);
	const { pathPart, suffix } = splitUrl(rawUrl);
	const abs = path.resolve(ctx.fromAbsDir, pathPart);

	const published = ctx.assets.get(abs);
	if (published !== undefined) return withBase(`/${published}`, ctx.base) + suffix;

	warnings.push(
		`${ctx.fromLabel}: asset not published -> ${rawUrl} (add a glob covering ${abs} to an \`assets\` key in docs.config.yaml)`,
	);
	const fallback = toPosix(path.relative(ctx.configDir, abs));
	// Outside the config's own directory there's no sensible site path to invent; leave it be.
	if (fallback.startsWith("..")) return rawUrl;
	return withBase(`/${fallback}`, ctx.base) + suffix;
}

/**
 * Prefixes a `/`-rooted path with the deployed base path (e.g. "/launchpad/foo" from "/foo").
 * Used both for paths we construct ourselves and for hand-authored `/`-rooted links already
 * present in source markdown, which we treat as site-root-relative rather than rewriting further.
 */
function withBase(urlPath: string, base: string): string {
	if (base === "/" || base === "") return urlPath;
	const trimmed = base.endsWith("/") ? base.slice(0, -1) : base;
	return `${trimmed}${urlPath}`;
}

/** A `/`-rooted path, but not a protocol-relative URL like `//cdn.example.com/x`. */
function isRootRelative(url: string): boolean {
	return url.startsWith("/") && !url.startsWith("//");
}

/** Reference-definition variant: guesses image vs. doc-link from the file extension. */
function resolveLinkOrAsset(rawUrl: string, ctx: RewriteContext, warnings: string[]): string {
	if (EXTERNAL.test(rawUrl) || rawUrl.startsWith("data:")) return rawUrl;
	if (isRootRelative(rawUrl)) return withBase(rawUrl, ctx.base);
	if (IMAGE_EXT.test(splitUrl(rawUrl).pathPart)) return resolveAsset(rawUrl, ctx, warnings);
	return resolveDocLink(rawUrl, ctx, warnings) ?? rawUrl;
}

function rewriteRawHtml(value: string, ctx: RewriteContext, warnings: string[]): string {
	let out = value.replace(
		/(<img[^>]*\ssrc=")([^"]+)(")/gi,
		(_m, pre: string, url: string, post: string) => pre + resolveAsset(url, ctx, warnings) + post,
	);
	out = out.replace(
		/(<a[^>]*\shref=")([^"]+)(")/gi,
		(_m, pre: string, url: string, post: string) => {
			if (EXTERNAL.test(url)) return pre + url + post;
			if (isRootRelative(url)) return pre + withBase(url, ctx.base) + post;
			const resolved = IMAGE_EXT.test(splitUrl(url).pathPart)
				? resolveAsset(url, ctx, warnings)
				: (resolveDocLink(url, ctx, warnings) ?? url);
			return pre + resolved + post;
		},
	);
	return out;
}

/**
 * Splits a URL into its path (no query, no hash) and its `?query#hash` suffix (in whichever
 * combination is present), so route/extension lookups only ever see the bare path.
 */
function splitUrl(url: string): { pathPart: string; suffix: string } {
	const hashIndex = url.indexOf("#");
	const hash = hashIndex === -1 ? "" : url.slice(hashIndex);
	const beforeHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
	const queryIndex = beforeHash.indexOf("?");
	const pathPart = queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex);
	const query = queryIndex === -1 ? "" : beforeHash.slice(queryIndex);
	return { pathPart, suffix: query + hash };
}
