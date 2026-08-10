import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { RewriteContext } from "./links.js";
import { transformMarkdown } from "./links.js";
import type { AssetMap, ContentEntry, ResolvedConfig, RouteMap } from "./types.js";

const H1 = /^#[ \t]+(.+?)[ \t]*$/m;
const ASTRO_EXT = /\.astro$/i;
/** Extensions that become pages rather than published assets. */
const ROUTABLE_EXT = /\.(md|mdx|astro)$/i;

export interface SyncResult {
	pageCount: number;
	assetCount: number;
	warnings: string[];
	notices: string[];
}

/**
 * Syncs the configured content into the bundled Astro app: markdown into `src/content/docs/`,
 * `.astro` pages verbatim into `src/astro-pages/`, and each entry's `assets` globs into `public/`.
 * Must run before every `astro build`/`astro dev` — Astro's `docsLoader()` reads from disk, it
 * doesn't see the consumer repo directly (see package README, "Copy, don't glob-load in place").
 *
 * Everything published here comes from `cfg.content` and `cfg.landing`. There is no discovery by
 * convention: no `docs/` directory is special, no `README.md` is read implicitly, and nothing is
 * copied to `public/` that an `assets` glob didn't name.
 */
export function syncContent(cfg: ResolvedConfig, appRoot: string): SyncResult {
	const contentDir = path.join(appRoot, "src", "content", "docs");
	const astroPagesDir = path.join(appRoot, "src", "astro-pages");
	const publicDir = path.join(appRoot, "public");
	fs.rmSync(contentDir, { recursive: true, force: true });
	fs.mkdirSync(contentDir, { recursive: true });
	fs.rmSync(astroPagesDir, { recursive: true, force: true });
	fs.mkdirSync(astroPagesDir, { recursive: true });
	resetPublicDir(publicDir);

	const { pages, routes, assets, notices } = discoverContent(
		cfg.configDir,
		cfg.content,
		cfg.landing,
	);

	const warnings: string[] = [];
	let pageCount = 0;

	for (const absPath of pages) {
		const route = routes.get(absPath);
		if (!route) continue;
		if (ASTRO_EXT.test(absPath)) {
			writeAstroPage(absPath, route, astroPagesDir);
		} else {
			writePage(absPath, route, { cfg, routes, assets, contentDir, warnings });
		}
		pageCount++;
	}

	const assetCount = publishAssets(assets, publicDir);

	return { pageCount, assetCount, warnings, notices };
}

interface WriteCtx {
	cfg: ResolvedConfig;
	routes: RouteMap;
	assets: AssetMap;
	contentDir: string;
	warnings: string[];
}

function writePage(absPath: string, route: string, ctx: WriteCtx): void {
	const raw = fs.readFileSync(absPath, "utf8");
	const label = toPosix(path.relative(ctx.cfg.configDir, absPath));
	const isMdx = /\.mdx$/i.test(absPath);
	const parsed = matter(raw);
	let title = typeof parsed.data.title === "string" ? parsed.data.title : undefined;
	let body: string;

	if (isMdx) {
		// Passed through untransformed: MDX may hold JSX/component imports that a plain markdown
		// AST pass would corrupt. Title is still derived (frontmatter, then a naive leading-`#`
		// match) since the app's content schema requires one, but the heading itself is left in
		// the body and links/images are not rewritten.
		body = parsed.content.trim();
		if (!title) {
			const match = body.match(H1);
			title = match?.[1]?.replace(/[`*_]/g, "").trim();
		}
	} else {
		const rewriteCtx: RewriteContext = {
			fromAbsDir: path.dirname(absPath),
			fromLabel: label,
			routes: ctx.routes,
			assets: ctx.assets,
			configDir: ctx.cfg.configDir,
			repoUrl: ctx.cfg.repoUrl,
			branch: ctx.cfg.branch,
			base: ctx.cfg.base ?? "/",
		};
		const result = transformMarkdown(parsed.content, rewriteCtx, title);
		body = result.body;
		title = result.title;
		ctx.warnings.push(...result.warnings);
	}

	title = title || titleCaseFromFilename(absPath);

	const outPath = contentPathFor(ctx.contentDir, route, isMdx);
	fs.mkdirSync(path.dirname(outPath), { recursive: true });
	// sourcePath is this file's path relative to the config file's directory (e.g.
	// "docs/how-to/foo.md") — the same `label` used for the GitHub blob URL rewriting above. It lets
	// `toc.editLink` templates resolve a per-page edit URL without the app needing to know anything
	// about the consumer repo's layout (see content.config.ts and pages/[...slug].astro).
	fs.writeFileSync(outPath, matter.stringify(body, { ...parsed.data, title, sourcePath: label }));
}

/**
 * Copies a consumer `.astro` page verbatim (no frontmatter injection, no link/asset rewriting —
 * `.astro` files aren't markdown and may hold arbitrary components/imports) into `astro-pages/`,
 * written under its route-normalized path. The written path *is* the slug the app will derive
 * routes from once it globs this directory, so it must exactly mirror `route`, e.g. `/how-to/demo/`
 * becomes `astro-pages/how-to/demo.astro`.
 */
function writeAstroPage(absPath: string, route: string, astroPagesDir: string): void {
	const outPath = path.join(astroPagesDir, `${route.slice(1, -1)}.astro`);
	fs.mkdirSync(path.dirname(outPath), { recursive: true });
	fs.copyFileSync(absPath, outPath);
}

export interface DiscoveredContent {
	/** Every page to publish, landing page first, then entries in config order. */
	pages: string[];
	routes: RouteMap;
	assets: AssetMap;
	notices: string[];
}

/**
 * Expands `content` (and the optional `landing`) into the exact set of pages and assets to publish.
 *
 * Route ids come from each file's path relative to its entry's `base`, prefixed with the entry's
 * `route`, extension stripped and lowercased. Two naming conventions survive from the old
 * discovery-based model because they're about naming, not discovery: a trailing `index` or `README`
 * segment collapses onto its parent directory, so `reference/index.md` is `/reference/` and
 * `packages/docs/README.md` is `/packages/docs/`.
 *
 * A configured `landing` always owns `/`. If a `content` glob also matches it, the page is skipped
 * there (it's already published) and a notice explains why rather than failing the build.
 */
export function discoverContent(
	configDir: string,
	content: ContentEntry[],
	landing: string | undefined,
): DiscoveredContent {
	const pages: string[] = [];
	const routes: RouteMap = new Map();
	const assets: AssetMap = new Map();
	const notices: string[] = [];
	/** Route id -> the file that claimed it, so a collision can name both sources. */
	const claimedBy = new Map<string, string>();
	/** Absolute file -> the entry that published it, so a double-claim can name both entries. */
	const claimedFrom = new Map<string, string>();

	if (landing) {
		pages.push(landing);
		routes.set(landing, "/");
		claimedBy.set("/", landing);
		claimedFrom.set(landing, "landing");
	}

	for (const [i, entry] of content.entries()) {
		const label = `content[${i}]`;
		const baseDir = path.resolve(configDir, entry.base);
		if (!fs.existsSync(baseDir)) {
			throw new Error(`${label}.base resolves to ${baseDir}, which does not exist.`);
		}

		for (const absPath of globFiles(baseDir, entry.files, label, "files")) {
			if (!ROUTABLE_EXT.test(absPath)) continue;
			if (absPath === landing) {
				notices.push(
					`${toPosix(path.relative(configDir, absPath))} is the landing page (/), so it is skipped where ${label} also matches it.`,
				);
				continue;
			}
			const route = routeFor(entry, baseDir, absPath);
			if (ASTRO_EXT.test(absPath) && route === "/") {
				throw new Error(
					`${absPath} resolves to the landing route (/), but .astro pages can't be the landing page — set \`landing:\` to a .md/.mdx file instead, or give this entry a \`route\`.`,
				);
			}
			// One file can only have one route: link rewriting maps a source path to a single route, so
			// two entries matching the same file is an ambiguity to report, not one to pick a winner for.
			const owner = claimedFrom.get(absPath);
			if (owner) {
				throw new Error(
					`${absPath} is matched by both ${owner} and ${label}. A file can only be published once — narrow one entry's \`files\` glob.`,
				);
			}
			const claimant = claimedBy.get(route);
			if (claimant) {
				throw new Error(
					`Two source files map to the same route "${route}":\n  - ${claimant}\n  - ${absPath}`,
				);
			}
			claimedBy.set(route, absPath);
			claimedFrom.set(absPath, label);
			routes.set(absPath, route);
			pages.push(absPath);
		}

		for (const absPath of globFiles(baseDir, entry.assets, label, "assets")) {
			// Pages are published as pages, never as raw downloadable source, so a broad assets glob
			// like "**/*" stays safe to write.
			if (ROUTABLE_EXT.test(absPath)) continue;
			if (assets.has(absPath)) continue;
			const rel = toPosix(path.relative(baseDir, absPath));
			assets.set(absPath, entry.route === "" ? rel : `${entry.route}/${rel}`);
		}
	}

	if (pages.length === 0) {
		throw new Error(
			"No pages to publish: no `content` glob matched a .md/.mdx/.astro file and no `landing` is set.",
		);
	}

	return { pages, routes, assets, notices };
}

/**
 * Resolves glob patterns against `baseDir`, returning absolute paths of regular files in a stable
 * (sorted, deduped) order. Matches are required to stay inside `baseDir`: a pattern that climbs out
 * with `..` would produce route ids containing `..`, and `base` already exists for that job.
 */
function globFiles(
	baseDir: string,
	patterns: string[],
	label: string,
	field: "files" | "assets",
): string[] {
	const found = new Set<string>();
	for (const pattern of patterns) {
		for (const rel of fs.globSync(pattern, { cwd: baseDir })) {
			if (rel.split(path.sep).includes("..")) {
				throw new Error(
					`${label}.${field} pattern "${pattern}" matches "${rel}", which is outside ${baseDir}. Point \`base\` at that directory instead of climbing out of it with "..".`,
				);
			}
			const abs = path.join(baseDir, rel);
			if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
			found.add(abs);
		}
	}
	return [...found].sort();
}

/** Route for `absPath` within `entry`: `route` prefix + base-relative path, index/README collapsed. */
function routeFor(entry: ContentEntry, baseDir: string, absPath: string): string {
	const segments = toPosix(path.relative(baseDir, absPath))
		.replace(ROUTABLE_EXT, "")
		.split("/")
		.filter(Boolean);
	const last = (segments.at(-1) ?? "").toLowerCase();
	if (last === "index" || last === "readme") segments.pop();
	const prefix = entry.route === "" ? [] : entry.route.split("/");
	const id = [...prefix, ...segments].join("/").toLowerCase();
	return id === "" ? "/" : `/${id}/`;
}

function contentPathFor(contentDir: string, route: string, isMdx: boolean): string {
	const ext = isMdx ? ".mdx" : ".md";
	if (route === "/") return path.join(contentDir, `index${ext}`);
	return path.join(contentDir, `${route.slice(1, -1)}${ext}`);
}

function titleCaseFromFilename(absPath: string): string {
	const stem = path.basename(absPath, path.extname(absPath)).replace(/[-_]/g, " ");
	return stem.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Copies every asset named by an `assets` glob to its single published path under `public/`. */
function publishAssets(assets: AssetMap, publicDir: string): number {
	let count = 0;
	for (const [from, to] of assets) {
		copyInto(from, path.join(publicDir, to));
		count++;
	}
	return count;
}

/** Static files the app ships with (e.g. a default favicon) that must survive re-syncs. */
const STATIC_PUBLIC_FILES = new Set(["favicon.svg"]);

function resetPublicDir(publicDir: string): void {
	if (!fs.existsSync(publicDir)) {
		fs.mkdirSync(publicDir, { recursive: true });
		return;
	}
	for (const name of fs.readdirSync(publicDir)) {
		if (STATIC_PUBLIC_FILES.has(name)) continue;
		fs.rmSync(path.join(publicDir, name), { recursive: true, force: true });
	}
}

function copyInto(from: string, to: string): void {
	fs.mkdirSync(path.dirname(to), { recursive: true });
	fs.copyFileSync(from, to);
}

function toPosix(p: string): string {
	return p.split(path.sep).join("/");
}
