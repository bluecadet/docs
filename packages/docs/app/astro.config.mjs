import { fileURLToPath } from "node:url";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { rehypeHeadingIds } from "@astrojs/markdown-remark";
import { createIndex } from "pagefind";
import { transformerMetaHighlight } from "@shikijs/transformers";
import { defineConfig } from "astro/config";
import { searchForWorkspaceRoot } from "vite";
import { remarkAlerts } from "./src/lib/remark-alerts";
import { rehypeCodeBlocks } from "./src/lib/rehype-code-blocks";
import { rehypeHeadingAnchors } from "./src/lib/rehype-heading-anchors";
import { rehypeTables } from "./src/lib/rehype-tables";

// Populated by the CLI (see ../src/build.ts / ../src/dev.ts) before this config loads. Pages and
// layouts read DOCS_TITLE/DOCS_REPO_URL directly from process.env server-side.
const base = process.env.DOCS_BASE;
const site = process.env.DOCS_SITE;
// Absolute path of the directory holding the consumer's docs.config.yaml. Backs the `@docs-src/`
// alias below; unset only when this app is run directly (`astro dev` in this repo), which no
// consumer content is synced into, so nothing can reference the alias either.
const configDir = process.env.DOCS_CONFIG_DIR?.replace(/\\/g, "/");
/** This app's own directory — the Astro `root` the CLI passes (see ../src/build.ts). */
const APP_ROOT = fileURLToPath(new URL(".", import.meta.url));

// Same `DOCS_CONFIG` payload app/src/lib/config.ts parses at runtime — read again here, config-
// build-side, only for the one field this file needs: whether "/" is a real landing page or the
// noindex redirect stub (see src/pages/index.astro / LandingRedirect.astro). Duplicated rather than
// imported because this file loads before the app's own module graph is available to it.
let hasLanding = true;
try {
	hasLanding = Boolean(JSON.parse(process.env.DOCS_CONFIG ?? "{}").hasLanding);
} catch {
	// Malformed DOCS_CONFIG is the CLI's problem to have caught already — fall back to including "/".
}

// The root URL sitemap() would otherwise list for "/" — used below to drop it when there's no real
// landing page, since that route is just a noindex meta-refresh to the first sidebar page.
const rootUrl = site ? new URL(base || "/", site).href : undefined;

/**
 * Builds a Pagefind search index over the static build output once Astro finishes writing it,
 * and writes it into the output dir under /pagefind/ so it ships alongside the rest of the site.
 *
 * `createIndex` must be a static top-level import (not `await import("pagefind")` inside the
 * hook): once this config file itself imports local `.ts` modules (the remark/rehype plugins
 * below), Astro loads astro.config.mjs through Vite's SSR module runner to transpile those
 * imports, and that runner is already closed by the time `astro:build:done` fires — any dynamic
 * `import()` performed inside the hook throws "Vite module runner has been closed."
 *
 * Scoping: every doc page and the landing page wrap their real content in a `data-pagefind-body`
 * element (see src/pages/[...slug].astro and src/pages/index.astro). Pagefind's opt-in rule is
 * global once ANY page in the site declares `data-pagefind-body`, every page WITHOUT one is
 * dropped from the index entirely — which is exactly what keeps 404.html (which declares none)
 * out, without having to special-case it here. Without that marker, Pagefind falls back to
 * indexing the whole `<html>`, which on this site means the sidebar nav and the always-rendered
 * mobile NavSheet (both a full list of every page title) plus header/footer/search-modal chrome,
 * duplicated into every single page's index entry. `excludeSelectors` additionally trims the
 * mobile "on this page" disclosure that's nested inside the article itself (SidebarNav/NavSheet/
 * Header/Footer/SearchModal/Toc-aside are untouched here — they're already outside the marked
 * body element, not swept in by a selector).
 */
function pagefindIndex() {
	return {
		name: "pagefind-index",
		hooks: {
			"astro:build:done": async ({ dir, logger }) => {
				const outDir = fileURLToPath(dir);

				const { index, errors: createErrors } = await createIndex({
					excludeSelectors: [".toc-disclosure"],
				});
				if (createErrors.length > 0) {
					logger.error(`pagefind: failed to create index: ${createErrors.join(", ")}`);
					return;
				}

				const { errors: addErrors, page_count: pageCount } = await index.addDirectory({
					path: outDir,
				});
				if (addErrors.length > 0) {
					logger.error(`pagefind: failed to index directory: ${addErrors.join(", ")}`);
				}

				const { errors: writeErrors } = await index.writeFiles({
					outputPath: `${outDir}/pagefind`,
				});
				if (writeErrors.length > 0) {
					logger.error(`pagefind: failed to write index: ${writeErrors.join(", ")}`);
				}

				logger.info(`pagefind: indexed ${pageCount} page(s)`);
			},
		},
	};
}

/**
 * Loads the copy-button client script (app/src/scripts/code-copy.ts) on every page. There's no
 * layout component in this package to hang a <script> tag off directly, so this is done via the
 * integration API instead: `injectScript("page", ...)` bundles the given module through Vite and
 * includes it in every page's client JS.
 */
function codeCopyScript() {
	return {
		name: "code-copy-script",
		hooks: {
			"astro:config:setup": ({ injectScript }) => {
				const scriptPath = fileURLToPath(new URL("./src/scripts/code-copy.ts", import.meta.url));
				injectScript("page", `import ${JSON.stringify(scriptPath)};`);
			},
		},
	};
}

export default defineConfig({
	...(site ? { site } : {}),
	...(base ? { base } : {}),
	integrations: [
		mdx(),
		pagefindIndex(),
		codeCopyScript(),
		// Requires `site` (it warns and no-ops without one — see its own astro:build:done hook), so
		// only registered when the CLI's `site` config option is set. It already excludes /404 (and
		// /500) on its own; the extra `filter` below additionally drops "/" when there's no real
		// landing page, since that route is a noindex redirect stub, not content worth indexing.
		...(site ? [sitemap({ filter: hasLanding ? undefined : (page) => page !== rootUrl })] : []),
	],
	vite: {
		resolve: {
			/**
			 * `@docs-src/<path>` resolves against the directory holding the consumer's
			 * docs.config.yaml — the one import specifier a synced page can use to reach a component
			 * in the consumer's own repo.
			 *
			 * Relative specifiers can't do this job: sync *copies* markdown/MDX into
			 * src/content/docs/ and `.astro` pages into src/astro-pages/ under route-normalized
			 * paths, so `./Table.astro` resolves next to the copy, where that file has never existed
			 * (`docs dev` only appears to work — Vite's dev resolver falls back to cwd, which is the
			 * consumer's directory only because that's where the CLI happened to be invoked).
			 *
			 * Aliasing rather than copying the component is the point: it stays in the consumer's
			 * tree, so bare specifiers inside it (`@bluecadet/docs/components`) resolve from its own
			 * location, which reaches the consumer's install of this package, and nothing about its
			 * own repo layout has to be restated. A component reading files at build time must anchor
			 * on `process.env.DOCS_CONFIG_DIR` (set by the CLI, see ../src/build.ts) rather than
			 * `import.meta.url`: the build bundles it into a chunk under this app, so `import.meta.url`
			 * points at the chunk, not at the source file.
			 *
			 * Regex `find` so the alias only ever matches as a path prefix.
			 */
			alias: configDir ? [{ find: /^@docs-src\//, replacement: `${configDir}/` }] : [],
		},
		// The alias gets Vite to *find* the file; dev additionally refuses to *serve* anything outside
		// the project root without this. Declaring `fs.allow` REPLACES Vite's default entry rather
		// than adding to it, so the workspace root has to be restated here — without it the dev
		// server 403s on the app's own stylesheets and bundled fonts. `searchForWorkspaceRoot` is the
		// same function Vite computes that default with, and it resolves both install layouts: the
		// docs monorepo for a workspace/`file:` link, the consumer's project root (i.e. the
		// node_modules holding this package) for a published install.
		server: configDir
			? { fs: { allow: [searchForWorkspaceRoot(APP_ROOT), configDir] } }
			: {},
	},
	markdown: {
		remarkPlugins: [remarkAlerts],
		// `rehypeHeadingIds` is Astro's own built-in slugger — it's listed here *again*, ahead of
		// `rehypeHeadingAnchors`, because Astro always re-runs it once more after every plugin in
		// this array (unconditionally, to guarantee every heading gets an id); running it early too
		// gives `rehypeHeadingAnchors` a real id to read instead of re-slugging. See
		// `rehype-heading-anchors.ts` for the full ordering rationale.
		rehypePlugins: [rehypeCodeBlocks, rehypeTables, rehypeHeadingIds, rehypeHeadingAnchors],
		shikiConfig: {
			theme: "css-variables",
			// Enables the standard ```lang {2,5-7} meta syntax: adds a "highlighted" class to the
			// matching `.line` spans (see article.css for the tint that reads it).
			transformers: [transformerMetaHighlight()],
		},
	},
});
