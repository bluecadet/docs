import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import docsTheme from "@bluecadet/docs-theme";

// Populated by the CLI (see ../src/build.ts / ../src/dev.ts) before this config loads.
const title = process.env.DOCS_TITLE ?? "Docs";
const repoUrl = process.env.DOCS_REPO_URL;
const base = process.env.DOCS_BASE;
const site = process.env.DOCS_SITE;

export default defineConfig({
	...(site ? { site } : {}),
	...(base ? { base } : {}),
	integrations: [
		starlight({
			title,
			// Sidebar is intentionally omitted: Starlight autogenerates it from the content
			// collection's directory structure. An explicit `autogenerate` config here silently
			// empties the sidebar or hard-errors, depending on shape (see package README).
			plugins: [docsTheme()],
			...(repoUrl ? { social: [{ icon: "github", label: "GitHub", href: repoUrl }] } : {}),
		}),
	],
});
