// Reads the `DOCS_CONFIG` JSON payload the CLI sets before running Astro (see
// ../../../src/build.ts's `applyEnv`). This is the app-side entry point for config-driven
// features (header/footer links, config-driven sidebar); components should prefer
// `getDocsConfig()` over reaching into `process.env` directly.
//
// The shape here is intentionally a duplicate of `DocsConfig`/`ResolvedConfig` in
// packages/docs/src/types.ts, not a shared import: the app is published as a standalone bundle
// (see packages/docs/package.json's `files`, which ships `app/src/lib` but not `src/`), so it
// can't reach across into the CLI package's source at runtime.

/** A single labeled link, e.g. in `header.links` or `footer.links`. */
export interface ConfigLink {
	label: string;
	href: string;
}

/** An optional set of extra links rendered in the header or footer chrome. */
export interface ConfigLinks {
	links?: ConfigLink[];
}

/** Footer chrome: optional links plus an optional right-aligned meta string. */
export interface FooterConfig extends ConfigLinks {
	/** e.g. `ISC licensed · builds to static files`. Rendered on every page. */
	meta?: string;
}

/** The "on this page" TOC's optional bottom meta block (aside/desktop variant only). */
export interface TocConfig {
	/** Short attention-accented note, e.g. `updated for 2.4`. */
	note?: string;
	/**
	 * URL template for the per-page "edit this page" link. `{path}` is replaced with the page's
	 * source path relative to the consumer repo root, e.g. `docs/how-to/foo.md`.
	 */
	editLink?: string;
}

/** A sidebar entry: either a synced page's content id, or a nested group. */
export type SidebarItem = string | SidebarGroup;

/** A labeled sidebar group containing pages and/or nested groups, in author-controlled order. */
export interface SidebarGroup {
	label: string;
	items: SidebarItem[];
	/** Optional content id the group's own heading links to, exactly like a leaf `SidebarItem` string. */
	link?: string;
}

/** The parsed shape of `DOCS_CONFIG`, with fallbacks already applied. */
export interface DocsAppConfig {
	title: string;
	repoUrl?: string;
	base?: string;
	site?: string;
	header?: ConfigLinks;
	footer?: FooterConfig;
	sidebar?: SidebarGroup[];
	/** Version string, e.g. `v2.4.1`. Rendered in the header and at the bottom of the sidebar. */
	version?: string;
	/** Multiline string; each non-empty line renders as its own row in the sidebar's bottom meta block. */
	sidebarMeta?: string;
	/** Optional bottom meta block for the desktop "on this page" TOC. */
	toc?: TocConfig;
}

function parseDocsConfig(): DocsAppConfig {
	const raw = process.env.DOCS_CONFIG;
	if (!raw) return { title: "docs" };
	try {
		const parsed = JSON.parse(raw) as Partial<DocsAppConfig>;
		return { title: "docs", ...parsed };
	} catch {
		return { title: "docs" };
	}
}

// Parsed once at module load — `DOCS_CONFIG` is set before the Astro process starts and never
// changes for the lifetime of a build/dev run.
const docsConfig = parseDocsConfig();

/** The CLI-provided config for this build, with a `title: "docs"` fallback. */
export function getDocsConfig(): DocsAppConfig {
	return docsConfig;
}

/**
 * True when `href` is an absolute `http(s)` URL pointing at a different origin than the
 * configured `site` — i.e. it should get the "leaves the site" (↗) affordance. Without a
 * configured `site` to compare against, any absolute `http(s)` URL is treated as external, since
 * there's no way to know our own origin otherwise.
 */
export function isExternalLink(href: string): boolean {
	if (!/^https?:\/\//i.test(href)) return false;
	const { site } = docsConfig;
	if (!site) return true;
	try {
		return new URL(href).origin !== new URL(site).origin;
	} catch {
		return true;
	}
}
