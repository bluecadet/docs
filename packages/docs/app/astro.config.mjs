import { fileURLToPath } from "node:url";
import mdx from "@astrojs/mdx";
import { defineConfig } from "astro/config";

// Populated by the CLI (see ../src/build.ts / ../src/dev.ts) before this config loads. Pages and
// layouts read DOCS_TITLE/DOCS_REPO_URL directly from process.env server-side.
const base = process.env.DOCS_BASE;
const site = process.env.DOCS_SITE;

/**
 * Builds a Pagefind search index over the static build output once Astro finishes writing it,
 * and writes it into the output dir under /pagefind/ so it ships alongside the rest of the site.
 */
function pagefindIndex() {
	return {
		name: "pagefind-index",
		hooks: {
			"astro:build:done": async ({ dir, logger }) => {
				const { createIndex } = await import("pagefind");
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

export default defineConfig({
	...(site ? { site } : {}),
	...(base ? { base } : {}),
	integrations: [mdx(), pagefindIndex()],
});
