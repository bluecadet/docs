// Consumer `.astro` pages, synced verbatim by the CLI into `src/astro-pages/` (see
// ../../../src/sync.ts's `writeAstroPage`) under route-normalized paths — the on-disk path
// already *is* the route id, index-collapsed and lowercased. This module globs them eagerly at
// build time, reads each module's exports, and enforces the small contract consumer pages must
// follow:
//
//   export const layout: "docs" | "raw" = "docs"  // optional, defaults to "docs"
//   export const title: string                     // required when layout is "docs"
//   export const description: string                // optional, "docs" layout only — feeds the
//                                                     // same places a markdown page's frontmatter
//                                                     // description does (lead, pagination, meta)
//
// "docs" pages render inside the normal chrome (BaseLayout, breadcrumb, pagination, prose
// article) exactly like a synced markdown page, and join the nav tree (see ./nav.ts). "raw" pages
// own their entire `<html>` document — [...slug].astro renders `<Page />` bare — and are excluded
// from nav/sidebar/breadcrumb/pagination/search entirely. Contract violations throw here, at
// module init, so they fail the build immediately and name the offending route.
import type { AstroComponentFactory } from "astro/runtime/server/index.js";

export type AstroPageLayout = "docs" | "raw";

export interface AstroPage {
	/** Route id, e.g. "how-to/demo" — same shape as a content-collection entry id. */
	id: string;
	layout: AstroPageLayout;
	/** Required, "docs" layout only. Always undefined for "raw" pages (title export is ignored there). */
	title: string | undefined;
	/** "docs" layout only. */
	description: string | undefined;
	Component: AstroComponentFactory;
}

interface AstroPageModule {
	default: AstroComponentFactory;
	layout?: unknown;
	title?: unknown;
	description?: unknown;
}

const modules = import.meta.glob<AstroPageModule>("../astro-pages/**/*.astro", { eager: true });

function idFromModulePath(modulePath: string): string {
	// "../astro-pages/how-to/demo.astro" -> "how-to/demo"
	return modulePath.replace(/^\.\.\/astro-pages\//, "").replace(/\.astro$/, "");
}

function toAstroPage(id: string, mod: AstroPageModule): AstroPage {
	const route = `/${id}/`;
	const layout = mod.layout ?? "docs";
	if (layout !== "docs" && layout !== "raw") {
		throw new Error(
			`astro-pages${route}: invalid \`layout\` export ${JSON.stringify(layout)} — must be "docs" or "raw" (or omitted, which defaults to "docs").`,
		);
	}
	if (layout === "docs" && typeof mod.title !== "string") {
		throw new Error(
			`astro-pages${route}: \`export const title: string\` is required for layout "docs".`,
		);
	}
	if (mod.description !== undefined && typeof mod.description !== "string") {
		throw new Error(`astro-pages${route}: \`description\` export must be a string.`);
	}
	return {
		id,
		layout,
		title: layout === "docs" ? (mod.title as string) : undefined,
		description: typeof mod.description === "string" ? mod.description : undefined,
		Component: mod.default,
	};
}

/** Every synced consumer `.astro` page, validated. Empty when the consumer has none. */
export const astroPages: AstroPage[] = Object.entries(modules).map(([modulePath, mod]) =>
	toAstroPage(idFromModulePath(modulePath), mod),
);

/** `layout: "docs"` pages — these join the nav tree and render inside the normal chrome. */
export const docsAstroPages: AstroPage[] = astroPages.filter((page) => page.layout === "docs");

/** `layout: "raw"` pages — these render bare, entirely outside nav/chrome/search. */
export const rawAstroPages: AstroPage[] = astroPages.filter((page) => page.layout === "raw");

/** Looks up a single astro page by route id, regardless of layout. */
export function findAstroPage(id: string): AstroPage | undefined {
	return astroPages.find((page) => page.id === id);
}
