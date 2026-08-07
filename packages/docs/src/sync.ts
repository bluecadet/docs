import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { RewriteContext } from "./links.js";
import { transformMarkdown } from "./links.js";
import type { AssetCopy, ResolvedConfig, RouteMap } from "./types.js";

const H1 = /^#[ \t]+(.+?)[ \t]*$/m;
const MD_EXT = /\.(md|mdx)$/i;

export interface SyncResult {
	pageCount: number;
	assetCount: number;
	warnings: string[];
	notices: string[];
}

/**
 * Syncs a consumer repo's markdown into the bundled Astro app's `src/content/docs/` and copies
 * referenced assets into its `public/`. Must run before every `astro build`/`astro dev` — Astro's
 * `docsLoader()` reads from disk, it doesn't see the consumer repo directly (see package README,
 * "Copy, don't glob-load in place").
 */
export function syncContent(cfg: ResolvedConfig, appRoot: string): SyncResult {
	const contentDir = path.join(appRoot, "src", "content", "docs");
	const publicDir = path.join(appRoot, "public");
	fs.rmSync(contentDir, { recursive: true, force: true });
	fs.mkdirSync(contentDir, { recursive: true });
	resetPublicDir(publicDir);

	const { docsDir, landing, displaced, notices, files } = discoverContent(cfg.root, cfg.content);
	if (!landing) {
		throw new Error(
			`No landing page found under ${cfg.root}. Add a README.md at the repo root, a docs/index.md, or a docs/index.mdx.`,
		);
	}
	const routes = buildRouteMap(cfg.root, docsDir, landing, displaced, files);

	const warnings: string[] = [];
	const pendingAssets: AssetCopy[] = [];
	let pageCount = 0;

	for (const absPath of files) {
		const route = routes.get(absPath);
		if (!route) continue;
		writePage(absPath, route, { cfg, docsDir, routes, contentDir, pendingAssets, warnings });
		pageCount++;
	}

	let assetCount = 0;
	if (docsDir) assetCount += blindCopyDocsAssets(docsDir, cfg.root, publicDir);
	assetCount += flushAssetCopies(pendingAssets, publicDir);

	return { pageCount, assetCount, warnings, notices };
}

interface WriteCtx {
	cfg: ResolvedConfig;
	docsDir: string | undefined;
	routes: RouteMap;
	contentDir: string;
	pendingAssets: AssetCopy[];
	warnings: string[];
}

function writePage(absPath: string, route: string, ctx: WriteCtx): void {
	const raw = fs.readFileSync(absPath, "utf8");
	const label = toPosix(path.relative(ctx.cfg.root, absPath));
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
			docsDir: ctx.docsDir,
			repoRoot: ctx.cfg.root,
			repoUrl: ctx.cfg.repoUrl,
			branch: ctx.cfg.branch,
			base: ctx.cfg.base ?? "/",
		};
		const result = transformMarkdown(parsed.content, rewriteCtx, title);
		body = result.body;
		title = result.title;
		ctx.pendingAssets.push(...result.assets);
		ctx.warnings.push(...result.warnings);
	}

	title = title || titleCaseFromFilename(absPath);

	const outPath = contentPathFor(ctx.contentDir, route, isMdx);
	fs.mkdirSync(path.dirname(outPath), { recursive: true });
	// sourcePath is the repo-root-relative path to this file (e.g. "docs/how-to/foo.md") — the
	// same `label` used for the GitHub blob URL rewriting above. It lets `toc.editLink` templates
	// resolve a per-page edit URL without the app needing to know anything about the consumer
	// repo's directory layout (see content.config.ts and pages/[...slug].astro).
	fs.writeFileSync(outPath, matter.stringify(body, { ...parsed.data, title, sourcePath: label }));
}

/**
 * Finds the docs/ tree, the landing page, and every markdown file that should be published.
 *
 * Landing precedence: `docs/index.mdx` > `docs/index.md` > root `README.md`. `docs/index.md` and
 * `docs/index.mdx` are mutually exclusive (an error, not a precedence rule — a repo authoring a
 * rich MDX landing page has no reason to also keep a plain `index.md` around). Whichever of
 * `docs/index.*`/`README.md` loses out to the other still gets published, at `/overview/` instead
 * of colliding at `/`.
 */
export function discoverContent(
	root: string,
	extraGlobs: string[],
): {
	docsDir: string | undefined;
	landing: string | undefined;
	displaced: string | undefined;
	notices: string[];
	files: string[];
} {
	const docsDirCandidate = path.join(root, "docs");
	const docsDir =
		fs.existsSync(docsDirCandidate) && fs.statSync(docsDirCandidate).isDirectory()
			? docsDirCandidate
			: undefined;

	const files = new Set<string>();
	if (docsDir) {
		for (const rel of fs.globSync("**/*.{md,mdx}", { cwd: docsDir })) {
			files.add(path.join(docsDir, rel));
		}
	}

	const readmePath = path.join(root, "README.md");
	const hasReadme = fs.existsSync(readmePath);
	const docsIndexMdPath = docsDir ? path.join(docsDir, "index.md") : undefined;
	const docsIndexMdxPath = docsDir ? path.join(docsDir, "index.mdx") : undefined;
	const hasDocsIndexMd = docsIndexMdPath !== undefined && fs.existsSync(docsIndexMdPath);
	const hasDocsIndexMdx = docsIndexMdxPath !== undefined && fs.existsSync(docsIndexMdxPath);

	if (hasDocsIndexMd && hasDocsIndexMdx) {
		throw new Error(
			"docs/index.md and docs/index.mdx cannot both exist — they're mutually exclusive landing pages. Delete one.",
		);
	}
	const docsIndexPath = hasDocsIndexMdx
		? docsIndexMdxPath
		: hasDocsIndexMd
			? docsIndexMdPath
			: undefined;

	if (hasReadme) files.add(readmePath);

	let landing: string | undefined;
	let displaced: string | undefined;
	const notices: string[] = [];
	if (docsIndexPath) {
		landing = docsIndexPath;
		if (hasReadme) {
			displaced = readmePath;
			notices.push(
				`${toPosix(path.relative(root, docsIndexPath))} is the landing page (/); README.md moved to /overview/ to avoid a collision.`,
			);
		}
	} else if (hasReadme) {
		landing = readmePath;
	}

	for (const pattern of extraGlobs) {
		for (const rel of fs.globSync(pattern, { cwd: root })) {
			if (MD_EXT.test(rel)) files.add(path.join(root, rel));
		}
	}

	return { docsDir, landing, displaced, notices, files: [...files] };
}

/**
 * Maps every discovered file to a site route. `index`/`README` basenames collapse onto their
 * parent directory. The landing page always wins `/`; a displaced file (see `discoverContent`)
 * moves to `/overview/` instead. Fails loudly if any two files still end up mapped to the same
 * route (e.g. `docs/how-to.md` and `docs/how-to/index.md` both naturally routing to `/how-to/`).
 */
export function buildRouteMap(
	root: string,
	docsDir: string | undefined,
	landing: string | undefined,
	displaced: string | undefined,
	files: string[],
): RouteMap {
	const routes: RouteMap = new Map();
	for (const absPath of files) {
		const base = docsDir && !path.relative(docsDir, absPath).startsWith("..") ? docsDir : root;
		routes.set(absPath, routeFromRelPath(path.relative(base, absPath)));
	}
	if (displaced) routes.set(displaced, "/overview/");
	if (landing) routes.set(landing, "/");
	assertNoRouteCollisions(routes);
	return routes;
}

function assertNoRouteCollisions(routes: RouteMap): void {
	const byRoute = new Map<string, string[]>();
	for (const [absPath, route] of routes) {
		const list = byRoute.get(route);
		if (list) list.push(absPath);
		else byRoute.set(route, [absPath]);
	}
	for (const [route, absPaths] of byRoute) {
		if (absPaths.length > 1) {
			throw new Error(
				`Multiple source files map to the same route "${route}":\n${absPaths.map((p) => `  - ${p}`).join("\n")}`,
			);
		}
	}
}

function routeFromRelPath(relWithExt: string): string {
	let r = toPosix(relWithExt).replace(MD_EXT, "");
	const parts = r.split("/");
	const base = (parts.at(-1) ?? "").toLowerCase();
	if (base === "index" || base === "readme") {
		parts.pop();
		r = parts.join("/");
	}
	r = r.toLowerCase();
	return r === "" ? "/" : `/${r}/`;
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

/**
 * Copies every non-markdown file under `docs/` into `public/`, duplicated under both its
 * docs-relative path and its repo-root-relative path, so images resolve whether they're
 * referenced from a `docs/*.md` page (docs-relative) or from the root README (repo-root-relative).
 */
function blindCopyDocsAssets(docsDir: string, repoRoot: string, publicDir: string): number {
	let count = 0;
	for (const dirent of fs.globSync("**/*", { cwd: docsDir, withFileTypes: true })) {
		if (!dirent.isFile()) continue;
		const absSrc = path.join(dirent.parentPath, dirent.name);
		if (MD_EXT.test(absSrc)) continue;

		const docsRel = path.relative(docsDir, absSrc);
		copyInto(absSrc, path.join(publicDir, docsRel));

		const rootRel = path.relative(repoRoot, absSrc);
		if (!rootRel.startsWith("..")) copyInto(absSrc, path.join(publicDir, rootRel));

		count++;
	}
	return count;
}

/** Copies every asset referenced by a rewritten link/image, deduped by destination path. */
function flushAssetCopies(pending: AssetCopy[], publicDir: string): number {
	const seen = new Set<string>();
	let count = 0;
	for (const { from, to } of pending) {
		const dest = path.join(publicDir, to);
		if (seen.has(dest)) continue;
		seen.add(dest);
		if (!fs.existsSync(from)) continue;
		if (fs.existsSync(dest)) continue; // already published by the blind docs/ copy pass
		copyInto(from, dest);
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
