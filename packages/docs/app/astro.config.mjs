import { fileURLToPath } from "node:url";
import mdx from "@astrojs/mdx";
import { createIndex } from "pagefind";
import { defineConfig } from "astro/config";
import { remarkAlerts } from "./src/lib/remark-alerts";
import { rehypeCodeBlocks } from "./src/lib/rehype-code-blocks";
import { rehypeTables } from "./src/lib/rehype-tables";

// Populated by the CLI (see ../src/build.ts / ../src/dev.ts) before this config loads. Pages and
// layouts read DOCS_TITLE/DOCS_REPO_URL directly from process.env server-side.
const base = process.env.DOCS_BASE;
const site = process.env.DOCS_SITE;

/**
 * Builds a Pagefind search index over the static build output once Astro finishes writing it,
 * and writes it into the output dir under /pagefind/ so it ships alongside the rest of the site.
 *
 * `createIndex` must be a static top-level import (not `await import("pagefind")` inside the
 * hook): once this config file itself imports local `.ts` modules (the remark/rehype plugins
 * below), Astro loads astro.config.mjs through Vite's SSR module runner to transpile those
 * imports, and that runner is already closed by the time `astro:build:done` fires — any dynamic
 * `import()` performed inside the hook throws "Vite module runner has been closed."
 */
function pagefindIndex() {
	return {
		name: "pagefind-index",
		hooks: {
			"astro:build:done": async ({ dir, logger }) => {
				const outDir = fileURLToPath(dir);

				const { index, errors: createErrors } = await createIndex({});
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
	integrations: [mdx(), pagefindIndex(), codeCopyScript()],
	markdown: {
		remarkPlugins: [remarkAlerts],
		rehypePlugins: [rehypeCodeBlocks, rehypeTables],
		shikiConfig: {
			theme: "css-variables",
		},
	},
});
